/**
 * Replenishment Service — Motor de recomendação de reabastecimento (Fase 6)
 *
 * Tipos de recomendação:
 *   central_to_store — estoque central tem saldo suficiente
 *   inter_store_transfer — outra loja tem excesso/subproduto compatível
 *   purchase_needed — nenhuma fonte interna atende
 *   no_action — estoque saudável
 *
 * Regras:
 *   1. Verificar saúde do estoque
 *   2. Se stockout/critical/low:
 *      a. Procurar no central warehouse (store=null)
 *      b. Procurar em outras lojas com excesso + compatibleOperations
 *      c. Se nenhum → purchase_needed
 *   3. Respeitar compatibilidade operacional (Fase 5.1D)
 *   4. Bloquear waste items
 */

const mongoose = require('mongoose');
const StockBalance = mongoose.model('StockBalance');
const StockLocation = mongoose.model('StockLocation');
const StockPolicy = mongoose.model('StockPolicy');
const GlobalIngredient = mongoose.model('GlobalIngredient');
const Store = mongoose.model('Store');
const StockMovement = mongoose.model('StockMovement');
const stockHealthService = require('./stockHealthService');

/**
 * Gera recomendação de reabastecimento para um ingrediente específico.
 */
const generateReplenishmentRecommendation = async ({ storeId, ingredientId, locationId }) => {
    const ingredient = await GlobalIngredient.findById(ingredientId)
        .select('name category baseUnit itemType productionState isByproduct compatibleOperations isActive')
        .lean();

    if (!ingredient) {
        throw new Error('Ingredient not found');
    }
    if (!ingredient.isActive) {
        return { type: 'no_action', reason: 'Ingredient is not active' };
    }
    if (ingredient.productionState === 'waste') {
        return { type: 'no_action', reason: 'Cannot replenish waste items' };
    }

    // Location da loja
    let locId = locationId;
    if (!locId) {
        const loc = await StockLocation.findOne({ store: storeId, type: 'STORE', isActive: true }).select('_id');
        if (!loc) {
            return { type: 'no_action', reason: 'No active STORE location found' };
        }
        locId = loc._id.toString();
    }

    // Saúde atual
    const health = await stockHealthService.calculateStockHealth({
        storeId,
        locationId: locId,
        ingredientId
    });

    // Se estoque está saudável, sem ação
    if (health.status === 'ok') {
        return {
            type: 'no_action',
            priority: 'none',
            storeId,
            ingredient: { id: ingredientId, name: ingredient.name },
            currentBalance: health.balance,
            unit: health.unit,
            status: health.status,
            justification: `Stock is healthy (${health.balance}${health.unit}). No action needed.`
        };
    }

    // Se no_policy, não temos como recomendar
    if (health.status === 'no_policy') {
        return {
            type: 'no_action',
            priority: 'low',
            storeId,
            ingredient: { id: ingredientId, name: ingredient.name },
            currentBalance: health.balance,
            unit: health.unit,
            status: health.status,
            justification: 'No stock policy defined. Cannot generate replenishment recommendation. Define a StockPolicy first.'
        };
    }

    const store = await Store.findById(storeId).select('name operationType').lean();
    const destOperationType = store?.operationType || 'geral';
    const compatibleOps = ingredient.compatibleOperations || ['geral'];
    const suggestedQuantity = health.deficitToIdeal || health.policy?.reorderPoint || 0;

    // Determinar prioridade
    let priority;
    if (health.status === 'stockout') priority = 'critical';
    else if (health.status === 'critical') priority = 'high';
    else if (health.status === 'low') priority = 'medium';
    else priority = 'low';

    // 1. Verificar estoque central compartilhado
    const centralRecommendation = await _checkCentralWarehouse(ingredientId, suggestedQuantity, health, store, ingredient, priority, locId);
    if (centralRecommendation) {
        return centralRecommendation;
    }

    // 2. Verificar transferências inter-store
    const interStoreRecommendation = await _checkInterStoreTransfers(
        ingredientId, storeId, suggestedQuantity, health, store, ingredient, priority, locId, destOperationType, compatibleOps
    );
    if (interStoreRecommendation) {
        return interStoreRecommendation;
    }

    // 3. Nenhuma fonte interna → compra necessária
    return {
        type: 'purchase_needed',
        priority,
        storeId,
        storeName: store?.name,
        destinationLocationId: locId,
        ingredient: { id: ingredientId, name: ingredient.name },
        suggestedQuantity,
        unit: health.unit,
        currentBalance: health.balance,
        idealQuantity: health.policy?.idealQuantity,
        status: health.status,
        justification: `No internal source available for '${ingredient.name}'. Central warehouse is empty and no compatible inter-store transfer found. External purchase required.`,
        actionSuggested: `Purchase ${suggestedQuantity}${health.unit} of ${ingredient.name} from supplier.`,
        risks: [
            'External purchase has lead time — stockout may persist until delivery',
            `Current balance: ${health.balance}${health.unit} (${health.status})`,
            health.daysUntilStockout ? `Estimated ${health.daysUntilStockout} days until stockout based on avg consumption` : 'Consumption data insufficient for stockout projection'
        ],
        consumption: health.consumption,
        daysUntilStockout: health.daysUntilStockout,
        timestamp: new Date().toISOString()
    };
};

/**
 * Gera recomendações para toda uma loja.
 */
const generateStoreRecommendations = async (storeId, options = {}) => {
    const healthData = await stockHealthService.getStoreStockHealth(storeId);

    const recommendations = [];

    // Só gerar recomendações para itens com problemas
    const problematicIngredients = healthData.ingredients.filter(i =>
        !['ok', 'no_policy'].includes(i.status)
    );

    for (const ingredient of problematicIngredients) {
        try {
            const rec = await generateReplenishmentRecommendation({
                storeId,
                ingredientId: ingredient.ingredient.id,
                locationId: ingredient.location.id
            });
            if (rec.type !== 'no_action') {
                recommendations.push(rec);
            }
        } catch (err) {
            // Skip
        }
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    recommendations.sort((a, b) => (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4));

    return {
        storeId,
        storeName: healthData.ingredients[0]?.store?.name,
        totalRecommendations: recommendations.length,
        statusSummary: healthData.statusSummary,
        recommendations
    };
};

/**
 * Gera recomendações para toda a rede.
 */
const generateNetworkRecommendations = async () => {
    const stores = await Store.find({ isActive: true }).select('_id name').lean();
    const allRecommendations = [];

    for (const store of stores) {
        try {
            const recs = await generateStoreRecommendations(store._id);
            if (recs.recommendations.length > 0) {
                allRecommendations.push(recs);
            }
        } catch (err) {
            // Skip
        }
    }

    // Flatten and sort
    const flatRecs = allRecommendations.flatMap(r =>
        r.recommendations.map(rec => ({ ...rec, storeName: r.storeName }))
    );

    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    flatRecs.sort((a, b) => (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4));

    return {
        totalStores: stores.length,
        storesWithRecommendations: allRecommendations.length,
        totalRecommendations: flatRecs.length,
        recommendations: flatRecs
    };
};

// ========== HELPERS ==========

const _checkCentralWarehouse = async (ingredientId, suggestedQuantity, health, store, ingredient, priority, locId) => {
    // Buscar central warehouse compartilhado (store = null)
    const centralLocations = await StockLocation.find({
        type: 'CENTRAL_WAREHOUSE',
        store: null,
        isActive: true
    }).select('_id name');

    for (const centralLoc of centralLocations) {
        const centralBalance = await StockBalance.findOne({
            location: centralLoc._id,
            ingredient: ingredientId
        }).lean();

        if (centralBalance && centralBalance.balance > 0) {
            const availableQuantity = centralBalance.balance;
            const transferQuantity = Math.min(suggestedQuantity, availableQuantity);

            return {
                type: 'central_to_store',
                priority,
                storeId: store._id,
                storeName: store.name,
                destinationLocationId: locId,
                ingredient: { id: ingredientId, name: ingredient.name },
                suggestedQuantity: transferQuantity,
                unit: health.unit,
                currentBalance: health.balance,
                idealQuantity: health.policy?.idealQuantity,
                source: {
                    type: 'central_warehouse',
                    locationId: centralLoc._id.toString(),
                    locationName: centralLoc.name,
                    availableQuantity
                },
                status: health.status,
                justification: `Central warehouse '${centralLoc.name}' has ${availableQuantity}${health.unit} of '${ingredient.name}'. Transfer ${transferQuantity}${health.unit} to store '${store.name}'.`,
                actionSuggested: `Execute transfer: Central → ${store.name}, ${transferQuantity}${health.unit} of ${ingredient.name}.`,
                consumption: health.consumption,
                daysUntilStockout: health.daysUntilStockout,
                timestamp: new Date().toISOString()
            };
        }
    }

    return null;
};

const _checkInterStoreTransfers = async (ingredientId, destStoreId, suggestedQuantity, health, destStore, ingredient, priority, destLocId, destOperationType, compatibleOps) => {
    // Se ingrediente não é compatível com a loja destino, não recomendar
    if (!compatibleOps.includes('geral') && !compatibleOps.includes(destOperationType)) {
        return {
            type: 'no_action',
            priority: 'low',
            storeId: destStoreId,
            storeName: destStore?.name,
            ingredient: { id: ingredientId, name: ingredient.name },
            currentBalance: health.balance,
            unit: health.unit,
            status: health.status,
            justification: `Ingredient '${ingredient.name}' is not compatible with destination store operation type '${destOperationType}'. Compatible operations: [${compatibleOps.join(', ')}]. Cannot recommend transfer.`
        };
    }

    // Buscar outras lojas com estoque deste ingrediente
    const stores = await Store.find({
        isActive: true,
        _id: { $ne: destStoreId }
    }).select('_id name operationType').lean();

    const candidates = [];

    for (const otherStore of stores) {
        const otherLocation = await StockLocation.findOne({
            store: otherStore._id,
            type: 'STORE',
            isActive: true
        }).select('_id name');

        if (!otherLocation) continue;

        const otherBalance = await StockBalance.findOne({
            location: otherLocation._id,
            ingredient: ingredientId
        }).lean();

        if (!otherBalance || otherBalance.balance <= 0) continue;

        // Verificar se a outra loja tem excesso ou pelo menos pode compartilhar
        const otherHealth = await stockHealthService.calculateStockHealth({
            storeId: otherStore._id.toString(),
            locationId: otherLocation._id.toString(),
            ingredientId: ingredientId.toString()
        });

        // Só recomendar se a outra loja não estiver em stockout/critical
        if (['stockout', 'critical'].includes(otherHealth.status)) continue;

        // Calcular quantidade disponível (excesso acima do ideal ou metade do saldo se ok)
        let availableQty;
        if (otherHealth.status === 'excess' && otherHealth.excessOverMax > 0) {
            availableQty = otherHealth.excessOverMax;
        } else if (otherHealth.policy) {
            // Pode compartilhar até o saldo menos o ideal
            availableQty = Math.max(0, otherHealth.balance - otherHealth.policy.idealQuantity);
            // Se não tem excesso mas tem saldo, pode compartilhar metade
            if (availableQty <= 0) {
                availableQty = Math.floor(otherHealth.balance / 2);
            }
        } else {
            availableQty = Math.floor(otherHealth.balance / 2);
        }

        if (availableQty <= 0) continue;

        candidates.push({
            store: otherStore,
            location: otherLocation,
            health: otherHealth,
            availableQuantity: availableQty,
            currentBalance: otherHealth.balance
        });
    }

    if (candidates.length === 0) {
        return null;
    }

    // Escolher a melhor fonte (mais disponível)
    candidates.sort((a, b) => b.availableQuantity - a.availableQuantity);
    const best = candidates[0];
    const transferQuantity = Math.min(suggestedQuantity, best.availableQuantity);

    return {
        type: 'inter_store_transfer',
        priority,
        storeId: destStoreId,
        storeName: destStore?.name,
        destinationLocationId: destLocId,
        ingredient: { id: ingredientId, name: ingredient.name },
        suggestedQuantity: transferQuantity,
        unit: health.unit,
        currentBalance: health.balance,
        idealQuantity: health.policy?.idealQuantity,
        source: {
            type: 'inter_store',
            storeId: best.store._id.toString(),
            storeName: best.store.name,
            storeOperationType: best.store.operationType,
            locationId: best.location._id.toString(),
            locationName: best.location.name,
            availableQuantity: best.availableQuantity,
            currentBalance: best.currentBalance,
            sourceHealthStatus: best.health.status
        },
        status: health.status,
        justification: `'${best.store.name}' has ${best.currentBalance}${health.unit} of '${ingredient.name}' (${best.health.status}). Recommend transfer of ${transferQuantity}${health.unit} to '${destStore?.name}'. Compatible operations: [${compatibleOps.join(', ')}].`,
        actionSuggested: `Execute inter-store transfer: ${best.store.name} → ${destStore?.name}, ${transferQuantity}${health.unit} of ${ingredient.name}.`,
        compatibility: {
            destinationOperationType: destOperationType,
            ingredientCompatibleOperations: compatibleOps,
            isCompatible: true
        },
        risks: [
            `Source store '${best.store.name}' will have ${best.currentBalance - transferQuantity}${health.unit} after transfer`,
            `Source store health status: ${best.health.status}`
        ],
        consumption: health.consumption,
        daysUntilStockout: health.daysUntilStockout,
        timestamp: new Date().toISOString()
    };
};

module.exports = {
    generateReplenishmentRecommendation,
    generateStoreRecommendations,
    generateNetworkRecommendations
};
