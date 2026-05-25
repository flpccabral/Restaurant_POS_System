/**
 * Observability Service — Alertas operacionais e timeline unificada (Fase 6)
 *
 * Funções:
 *   generateAlerts(storeId) — varre estoques e gera alertas
 *   getAlerts(storeId, options) — lista alertas
 *   resolveAlert(alertId, userId) — resolve um alerta
 *   getOperationalTimeline(storeId, options) — timeline unificada
 */

const mongoose = require('mongoose');
require('../models/operationalAlertModel');
const OperationalAlert = mongoose.model('OperationalAlert');
const StockMovement = mongoose.model('StockMovement');
const ProductionBatch = mongoose.model('ProductionBatch');
const StockLocation = mongoose.model('StockLocation');
const StockBalance = mongoose.model('StockBalance');
const StockPolicy = mongoose.model('StockPolicy');
const GlobalIngredient = mongoose.model('GlobalIngredient');
const Store = mongoose.model('Store');
const stockHealthService = require('./stockHealthService');
const replenishmentService = require('./replenishmentService');

/**
 * Gera alertas operacionais para uma loja.
 * Varre todos os ingredientes com saldo e classifica por saúde.
 */
const generateAlerts = async (storeId) => {
    const healthData = await stockHealthService.getStoreStockHealth(storeId);
    const store = await Store.findById(storeId).select('name operationType').lean();

    const generatedAlerts = [];

    for (const ingredient of healthData.ingredients) {
        const alertData = _mapHealthToAlert(ingredient, store);
        if (alertData) {
            try {
                const alert = await OperationalAlert.findOrCreate(alertData);
                generatedAlerts.push(alert);
            } catch (err) {
                // Skip duplicates
            }
        }

        // Verificar subprodutos disponíveis para transferência
        if (ingredient.ingredient?.isByproduct && ingredient.status === 'ok' && ingredient.balance > 0) {
            const byproductAlert = await OperationalAlert.findOrCreate({
                type: 'byproduct_available',
                severity: 'info',
                store: storeId,
                location: ingredient.location?.id,
                ingredient: ingredient.ingredient?.id,
                status: 'new',
                message: `Subproduto '${ingredient.ingredient?.name}' disponivel (${ingredient.balance}${ingredient.unit}). Considere transferir para operacoes compativeis.`,
                currentValue: ingredient.balance,
                metadata: {
                    itemType: ingredient.ingredient?.itemType,
                    productionState: ingredient.ingredient?.productionState,
                    compatibleOperations: ingredient.ingredient?.compatibleOperations,
                    isByproduct: true
                }
            });
            generatedAlerts.push(byproductAlert);
        }
    }

    return {
        storeId,
        storeName: store?.name,
        alertCount: generatedAlerts.length,
        alerts: generatedAlerts
    };
};

/**
 * Lista alertas operacionais.
 */
const getAlerts = async (storeId, options = {}) => {
    const filter = {};
    if (storeId) filter.store = new mongoose.Types.ObjectId(storeId);
    if (options.status) filter.status = options.status;
    if (options.type) filter.type = options.type;
    if (options.severity) filter.severity = options.severity;
    if (options.ingredient) filter.ingredient = new mongoose.Types.ObjectId(options.ingredient);

    const alerts = await OperationalAlert.find(filter)
        .populate('ingredient', 'name category baseUnit')
        .populate('location', 'name type')
        .populate('store', 'name operationType')
        .sort({ severity: -1, createdAt: -1 })
        .limit(options.limit || 50);

    return {
        count: alerts.length,
        storeId,
        alerts
    };
};

/**
 * Dismiss (ignore) um alerta.
 */
/**
 * Find an alert by either ObjectId (_id) or UUID (alertId).
 */
const findAlertByIdentifier = async (identifier) => {
    // MongoDB ObjectId tem 24 caracteres hex
    const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
    if (isObjectId) {
        const alert = await OperationalAlert.findById(identifier);
        if (alert) return alert;
    }
    // Fallback: busca por UUID
    return OperationalAlert.findOne({ alertId: identifier });
};

const dismissAlert = async (alertUuid, userId, reason) => {
    const alert = await findAlertByIdentifier(alertUuid);
    if (!alert) {
        throw new Error('Alert not found');
    }
    if (alert.status === 'resolved' || alert.status === 'dismissed') {
        throw new Error(`Alert is already ${alert.status}`);
    }
    return alert.dismiss(userId, reason);
};

/**
 * Resolve um alerta.
 */
const resolveAlert = async (alertUuid, userId, notes) => {
    const alert = await findAlertByIdentifier(alertUuid);
    if (!alert) {
        throw new Error('Alert not found');
    }
    if (alert.status === 'resolved' || alert.status === 'dismissed') {
        throw new Error(`Alert is already ${alert.status}`);
    }
    return alert.resolve(userId, notes);
};

/**
 * Timeline operacional unificada por loja.
 * Consolida StockMovement + ProductionBatch + OperationalAlert.
 */
const getOperationalTimeline = async (storeId, options = {}) => {
    const { startDate, endDate, ingredientId, limit = 100 } = options;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    // Movements
    const movementFilter = {
        store: new mongoose.Types.ObjectId(storeId)
    };
    if (Object.keys(dateFilter).length) movementFilter.createdAt = dateFilter;
    if (ingredientId) movementFilter.ingredient = new mongoose.Types.ObjectId(ingredientId);

    const movements = await StockMovement.find(movementFilter)
        .populate('ingredient', 'name category')
        .populate('location', 'name type')
        .sort({ createdAt: -1 })
        .limit(limit);

    // Production batches
    const batchFilter = {
        store: new mongoose.Types.ObjectId(storeId),
        status: 'completed'
    };
    if (startDate) batchFilter.completedAt = { $gte: new Date(startDate) };
    if (endDate) {
        if (batchFilter.completedAt) batchFilter.completedAt.$lte = new Date(endDate);
        else batchFilter.completedAt = { $lte: new Date(endDate) };
    }

    const batches = await ProductionBatch.find(batchFilter)
        .populate('inputs.ingredient', 'name')
        .populate('outputs.ingredient', 'name')
        .populate('user', 'name')
        .sort({ completedAt: -1 })
        .limit(limit);

    // Alerts
    const alertFilter = { store: new mongoose.Types.ObjectId(storeId) };
    if (Object.keys(dateFilter).length) alertFilter.createdAt = dateFilter;
    if (ingredientId) alertFilter.ingredient = new mongoose.Types.ObjectId(ingredientId);

    const alerts = await OperationalAlert.find(alertFilter)
        .populate('ingredient', 'name')
        .sort({ createdAt: -1 })
        .limit(limit);

    // Merge and sort by timestamp
    const timeline = [];

    for (const m of movements) {
        timeline.push({
            type: 'movement',
            timestamp: m.createdAt,
            eventType: m.type,
            ingredient: m.ingredient?.name,
            location: m.location?.name,
            quantity: m.quantity,
            unit: m.unit,
            balanceBefore: m.balanceBefore,
            balanceAfter: m.balanceAfter,
            reason: m.reason,
            reference: m.reference,
            metadata: m.metadata
        });
    }

    for (const b of batches) {
        timeline.push({
            type: 'production',
            timestamp: b.completedAt || b.createdAt,
            eventType: `production_${b.status}`,
            batchId: b.batchId,
            inputs: b.inputs.map(i => ({
                ingredient: i.ingredient?.name,
                quantity: i.quantity,
                unit: i.unit
            })),
            outputs: b.outputs.map(o => ({
                ingredient: o.ingredient?.name,
                quantity: o.quantity,
                unit: o.unit,
                outputType: o.outputType
            })),
            yieldPercentage: b.yieldPercentage,
            user: b.user?.name
        });
    }

    for (const a of alerts) {
        timeline.push({
            type: 'alert',
            timestamp: a.createdAt,
            eventType: a.type,
            severity: a.severity,
            message: a.message,
            status: a.status,
            ingredient: a.ingredient?.name,
            currentValue: a.currentValue,
            thresholdValue: a.thresholdValue
        });
    }

    // Sort by timestamp descending
    timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
        storeId,
        eventCount: timeline.length,
        events: timeline.slice(0, limit)
    };
};

// ========== HELPERS ==========

const _mapHealthToAlert = (ingredient, store) => {
    const status = ingredient.status;
    const name = ingredient.ingredient?.name || 'Unknown';
    const balance = ingredient.balance;
    const unit = ingredient.unit;
    const policy = ingredient.policy;

    let type, severity, message;

    switch (status) {
        case 'stockout':
            type = 'stockout';
            severity = 'critical';
            message = `Estoque zerado: '${name}' com 0${unit} em ${store?.name || 'loja'}. Reabastecimento imediato necessario.`;
            break;
        case 'critical':
            type = 'critical_stock';
            severity = 'high';
            message = `Estoque critico: '${name}' com ${balance}${unit} (minimo: ${policy?.minQuantity}${unit}). Reabastecimento urgente necessario.`;
            break;
        case 'low':
            type = 'low_stock';
            severity = 'medium';
            message = `Estoque baixo: '${name}' com ${balance}${unit} (ponto de ressuprimento: ${policy?.reorderPoint}${unit}. Considere reabastecer.`;
            break;
        case 'excess':
            type = 'excess_stock';
            severity = 'low';
            message = `Estoque excedente: '${name}' com ${balance}${unit} (maximo: ${policy?.maxQuantity}${unit}). Considere transferir para outras lojas.`;
            break;
        case 'no_policy':
            type = 'no_policy';
            severity = 'info';
            message = `Nenhuma politica de estoque definida para '${name}'. Crie uma StockPolicy para melhor monitoramento.`;
            break;
        default:
            return null;
    }

    return {
        type,
        severity,
        store: ingredient.store?.id,
        location: ingredient.location?.id,
        ingredient: ingredient.ingredient?.id,
        status: 'new',
        message,
        currentValue: balance,
        thresholdValue: policy?.minQuantity || policy?.reorderPoint,
        metadata: {
            status,
            consumption24h: ingredient.consumption?.last24h?.netConsumption,
            consumption7d: ingredient.consumption?.last7d?.netConsumption,
            avgDailyConsumption: ingredient.consumption?.avgDailyConsumption,
            daysUntilStockout: ingredient.daysUntilStockout,
            policy: policy ? {
                min: policy.minQuantity,
                reorder: policy.reorderPoint,
                ideal: policy.idealQuantity,
                max: policy.maxQuantity
            } : null
        }
    };
};

/**
 * Registra uma compra (apenas nota/registro, sem criar ordem de compra real).
 */
const registerPurchase = async (storeId, data, userId) => {
    const alert = await OperationalAlert.create({
        type: 'purchase_registered',
        severity: 'info',
        store: storeId,
        ingredient: data.ingredientId,
        location: data.locationId,
        status: 'resolved',
        message: data.message || `Compra registrada para '${data.ingredientName || 'ingrediente'}' (${data.quantity || ''}${data.unit || ''})`,
        currentValue: data.quantity,
        metadata: {
            purchaseNotes: data.notes,
            quantity: data.quantity,
            unit: data.unit,
            registeredBy: userId
        },
        resolvedBy: userId,
        resolvedAt: new Date()
    });
    return alert;
};

/**
 * Gera alertas para produtos com regras de impacto em estoque ausentes ou incompletas (Fase 9.1A).
 *
 * Regras por stockImpactRule:
 *   recipe_composition  → verifica Recipe ativa; se faltar, cria product_without_recipe
 *   stock_item_direct   → verifica directStockItem + qty > 0 + unit; se faltar, cria product_missing_stock_rule
 *   no_stock_impact     → NÃO gera alerta (sem baixa intencional)
 *   combo_components    → NÃO gera alerta (não implementado — retorna incomplete_config no checkout)
 *   sem regra           → cria product_without_recipe (compatibilidade)
 */
const checkProductsWithoutRecipe = async (storeId) => {
    const Product = mongoose.model('Product');
    const Recipe = mongoose.model('Recipe');

    const products = await Product.find({ store: storeId, isActive: true })
        .populate('category', 'name')
        .select('name variations stockImpactRule directStockItem directStockQuantity directStockUnit');

    const recipes = await Recipe.find({ store: storeId, isActive: true })
        .select('product variation')
        .lean();

    // Build lookup map: "productId:variationSku" -> recipe
    const recipeMap = new Map();
    for (const r of recipes) {
        recipeMap.set(`${r.product.toString()}:${r.variation}`, r);
    }

    const issues = [];
    const productsWithoutRecipe = [];
    const productsMissingStockRule = [];

    for (const product of products) {
        const rule = product.stockImpactRule || 'recipe_composition';

        switch (rule) {
            case 'no_stock_impact':
                // Sem baixa intencional — não gerar alerta
                break;

            case 'combo_components':
                // Não implementado — o checkout já retorna incomplete_config
                break;

            case 'stock_item_direct': {
                const hasValidConfig = product.directStockItem &&
                    product.directStockQuantity > 0 &&
                    product.directStockUnit;

                if (!hasValidConfig) {
                    issues.push({
                        type: 'product_missing_stock_rule',
                        severity: 'high',
                        productId: product._id,
                        productName: product.name,
                        reason: 'stock_item_direct sem configuracao valida (directStockItem, quantidade ou unidade)'
                    });
                    productsMissingStockRule.push({
                        productId: product._id.toString(),
                        productName: product.name,
                        reason: 'missing_direct_config'
                    });
                }
                break;
            }

            case 'recipe_composition':
            default: {
                // Comportamento original: verificar Recipe ativa
                const vars = product.variations || [];
                let hasAnyRecipe = false;
                const missingVariations = [];

                if (vars.length === 0) {
                    missingVariations.push({ variationName: null, sku: null });
                } else {
                    for (const v of vars) {
                        if (!v.isActive) continue;
                        const key = `${product._id.toString()}:${v.sku}`;
                        if (recipeMap.has(key)) {
                            hasAnyRecipe = true;
                        } else {
                            missingVariations.push({
                                variationName: v.name,
                                sku: v.sku
                            });
                        }
                    }
                }

                if (!hasAnyRecipe) {
                    for (const mv of missingVariations) {
                        issues.push({
                            type: 'product_without_recipe',
                            severity: 'high',
                            productId: product._id,
                            productName: product.name,
                            variationName: mv.variationName,
                            sku: mv.sku,
                            reason: 'recipe_composition sem ficha tecnica ativa'
                        });
                        productsWithoutRecipe.push({
                            productId: product._id.toString(),
                            productName: product.name,
                            variationName: mv.variationName,
                            sku: mv.sku,
                            missingRecipe: true
                        });
                    }
                }
                break;
            }
        }
    }

    const generatedAlerts = [];
    const store = await mongoose.model('Store').findById(storeId).select('name').lean();

    for (const item of issues) {
        try {
            let message;
            if (item.type === 'product_missing_stock_rule') {
                message = `Produto '${item.productName}' possui regra stock_item_direct mas sem configuração válida em ${store?.name || 'loja'}. Defina directStockItem, quantidade e unidade para garantir baixa de estoque e CMV corretos.`;
            } else {
                message = `Produto '${item.productName}'${item.variationName ? ` (variação: ${item.variationName})` : ''} não possui ficha técnica ativa em ${store?.name || 'loja'}. Vendas deste produto não geram baixa de estoque nem CMV.`;
            }

            const alert = await OperationalAlert.findOrCreate({
                type: item.type,
                severity: item.severity,
                store: storeId,
                status: 'new',
                message,
                currentValue: 1,
                metadata: {
                    productId: item.productId?.toString(),
                    productName: item.productName,
                    variationName: item.variationName,
                    sku: item.sku,
                    stockImpactRule: item.rule,
                    reason: item.reason,
                    missingRecipe: item.type === 'product_without_recipe'
                }
            });
            generatedAlerts.push(alert);
        } catch (err) {
            // Skip duplicates silently
        }
    }

    return {
        storeId,
        storeName: store?.name,
        totalMissing: issues.length,
        productsWithoutRecipe,
        productsMissingStockRule,
        alertsCreated: generatedAlerts.length,
        alerts: generatedAlerts
    };
};

module.exports = {
    generateAlerts,
    getAlerts,
    resolveAlert,
    dismissAlert,
    registerPurchase,
    getOperationalTimeline,
    checkProductsWithoutRecipe
};
