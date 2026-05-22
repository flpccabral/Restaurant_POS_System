/**
 * Stock Health Service — Classifica saúde do estoque por loja/localização/ingrediente (Fase 6)
 *
 * Status:
 *   stockout: balance <= 0
 *   critical: balance <= minQuantity
 *   low: balance <= reorderPoint
 *   excess: balance > maxQuantity
 *   no_policy: sem política cadastrada
 *   ok: dentro da faixa normal
 *
 * Consumo:
 *   Agrega StockMovement types: recipe_deduction, production_consumption
 *   Subtrai: recipe_deduction_reversal
 *   Períodos: 24h, 7d
 */

const mongoose = require('mongoose');
require('../models/stockPolicyModel');
const StockBalance = mongoose.model('StockBalance');
const StockMovement = mongoose.model('StockMovement');
const StockLocation = mongoose.model('StockLocation');
const StockPolicy = mongoose.model('StockPolicy');
const GlobalIngredient = mongoose.model('GlobalIngredient');
const Store = mongoose.model('Store');

/**
 * Calcula consumo de um ingrediente em um período.
 */
const _calculateConsumption = async (storeId, locationId, ingredientId, hours) => {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Consumos (positivos)
    const consumptionMovements = await StockMovement.aggregate([
        {
            $match: {
                store: new mongoose.Types.ObjectId(storeId),
                location: new mongoose.Types.ObjectId(locationId),
                ingredient: new mongoose.Types.ObjectId(ingredientId),
                type: { $in: ['recipe_deduction', 'production_consumption'] },
                createdAt: { $gte: since }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$quantity' },
                count: { $sum: 1 }
            }
        }
    ]);

    // Reversões (subtrair do consumo)
    const reversalMovements = await StockMovement.aggregate([
        {
            $match: {
                store: new mongoose.Types.ObjectId(storeId),
                location: new mongoose.Types.ObjectId(locationId),
                ingredient: new mongoose.Types.ObjectId(ingredientId),
                type: 'recipe_deduction_reversal',
                createdAt: { $gte: since }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$quantity' }
            }
        }
    ]);

    const totalConsumed = consumptionMovements[0]?.total || 0;
    const totalReversed = reversalMovements[0]?.total || 0;
    const netConsumption = Math.max(0, totalConsumed - totalReversed);

    return {
        hours,
        netConsumption,
        grossConsumption: totalConsumed,
        reversedConsumption: totalReversed,
        transactionCount: consumptionMovements[0]?.count || 0,
        avgPerDay: hours > 0 ? (netConsumption / (hours / 24)) : 0
    };
};

/**
 * Calcula saúde do estoque para um ingrediente específico.
 *
 * @param {object} params
 * @param {string} params.storeId
 * @param {string} params.locationId
 * @param {string} params.ingredientId
 * @returns {Promise<object>} Health data
 */
const calculateStockHealth = async ({ storeId, locationId, ingredientId }) => {
    // Buscar saldo atual
    const balance = await StockBalance.findOne({
        location: locationId,
        ingredient: ingredientId
    }).lean();

    const currentBalance = balance?.balance || 0;
    const unit = balance?.unit || 'unknown';

    // Buscar política
    const policy = await StockPolicy.findOne({
        store: storeId,
        location: locationId,
        ingredient: ingredientId,
        isActive: true
    }).lean();

    // Calcular saúde
    let status;
    if (!policy) {
        status = currentBalance <= 0 ? 'stockout' : 'no_policy';
    } else if (currentBalance <= 0) {
        status = 'stockout';
    } else if (currentBalance <= policy.minQuantity) {
        status = 'critical';
    } else if (currentBalance <= policy.reorderPoint) {
        status = 'low';
    } else if (currentBalance > policy.maxQuantity) {
        status = 'excess';
    } else {
        status = 'ok';
    }

    // Consumo
    const consumption24h = await _calculateConsumption(storeId, locationId, ingredientId, 24);
    const consumption7d = await _calculateConsumption(storeId, locationId, ingredientId, 168);

    // Dias estimados até ruptura
    const avgDailyConsumption = consumption7d.avgPerDay || consumption24h.avgPerDay;
    let daysUntilStockout = null;
    if (avgDailyConsumption > 0 && currentBalance > 0) {
        daysUntilStockout = Math.round((currentBalance / avgDailyConsumption) * 10) / 10;
    }

    // Ingrediente info
    const ingredient = await GlobalIngredient.findById(ingredientId).select('name category baseUnit itemType productionState isByproduct compatibleOperations').lean();

    // Localização info
    const location = await StockLocation.findById(locationId).select('name type').lean();

    // Store info
    const store = await Store.findById(storeId).select('name operationType').lean();

    return {
        store: {
            id: storeId,
            name: store?.name,
            operationType: store?.operationType || 'geral'
        },
        location: {
            id: locationId,
            name: location?.name,
            type: location?.type
        },
        ingredient: {
            id: ingredientId,
            name: ingredient?.name,
            category: ingredient?.category,
            itemType: ingredient?.itemType,
            productionState: ingredient?.productionState,
            isByproduct: ingredient?.isByproduct,
            compatibleOperations: ingredient?.compatibleOperations
        },
        balance: currentBalance,
        unit,
        policy: policy ? {
            minQuantity: policy.minQuantity,
            reorderPoint: policy.reorderPoint,
            idealQuantity: policy.idealQuantity,
            maxQuantity: policy.maxQuantity,
            priority: policy.priority
        } : null,
        status,
        consumption: {
            last24h: consumption24h,
            last7d: consumption7d,
            avgDailyConsumption: Math.round(avgDailyConsumption * 100) / 100
        },
        daysUntilStockout,
        deficitToIdeal: policy ? Math.max(0, policy.idealQuantity - currentBalance) : null,
        excessOverMax: policy ? Math.max(0, currentBalance - policy.maxQuantity) : null,
        timestamp: new Date().toISOString()
    };
};

/**
 * Calcula saúde de todos os ingredientes com saldo em uma loja.
 */
const getStoreStockHealth = async (storeId, options = {}) => {
    const locationId = options.locationId;

    // Buscar locations da loja
    const locations = await StockLocation.find({
        store: storeId,
        type: 'STORE',
        isActive: true
    }).select('_id name');

    const targetLocations = locationId
        ? locations.filter(l => l._id.toString() === locationId)
        : locations;

    const results = [];

    for (const loc of targetLocations) {
        // Buscar todos os balances para esta location
        const balances = await StockBalance.find({
            location: loc._id
        }).populate('ingredient', 'name category baseUnit itemType productionState isByproduct compatibleOperations').lean();

        for (const bal of balances) {
            try {
                const health = await calculateStockHealth({
                    storeId,
                    locationId: loc._id.toString(),
                    ingredientId: bal.ingredient._id.toString()
                });
                results.push(health);
            } catch (err) {
                // Skip individual failures
            }
        }
    }

    // Sort by severity
    const severityOrder = { stockout: 0, critical: 1, low: 2, excess: 3, no_policy: 4, ok: 5 };
    results.sort((a, b) => (severityOrder[a.status] || 5) - (severityOrder[b.status] || 5));

    return {
        storeId,
        locationCount: targetLocations.length,
        ingredientCount: results.length,
        statusSummary: {
            stockout: results.filter(r => r.status === 'stockout').length,
            critical: results.filter(r => r.status === 'critical').length,
            low: results.filter(r => r.status === 'low').length,
            ok: results.filter(r => r.status === 'ok').length,
            excess: results.filter(r => r.status === 'excess').length,
            noPolicy: results.filter(r => r.status === 'no_policy').length
        },
        ingredients: results
    };
};

/**
 * Calcula saúde de um ingrediente em toda a rede (todas as lojas).
 */
const getIngredientNetworkHealth = async (ingredientId) => {
    const ingredient = await GlobalIngredient.findById(ingredientId)
        .select('name category baseUnit itemType productionState isByproduct compatibleOperations')
        .lean();

    if (!ingredient) {
        throw new Error('Ingredient not found');
    }

    // Buscar todas as stores ativas
    const stores = await Store.find({ isActive: true }).select('_id name operationType').lean();

    const results = [];

    for (const store of stores) {
        const location = await StockLocation.findOne({
            store: store._id,
            type: 'STORE',
            isActive: true
        }).select('_id name').lean();

        if (!location) continue;

        try {
            const health = await calculateStockHealth({
                storeId: store._id.toString(),
                locationId: location._id.toString(),
                ingredientId: ingredientId.toString()
            });
            results.push(health);
        } catch (err) {
            // Skip
        }
    }

    const totalBalance = results.reduce((sum, r) => sum + r.balance, 0);
    const storesWithStock = results.filter(r => r.balance > 0).length;
    const storesWithPolicy = results.filter(r => r.policy).length;

    return {
        ingredient: {
            id: ingredientId,
            name: ingredient.name,
            category: ingredient.category,
            itemType: ingredient.itemType,
            productionState: ingredient.productionState,
            isByproduct: ingredient.isByproduct,
            compatibleOperations: ingredient.compatibleOperations
        },
        networkSummary: {
            totalStores: results.length,
            storesWithStock,
            storesWithoutStock: results.length - storesWithStock,
            storesWithPolicy,
            totalBalanceInNetwork: totalBalance,
            stockoutStores: results.filter(r => r.status === 'stockout').length,
            criticalStores: results.filter(r => r.status === 'critical').length,
            excessStores: results.filter(r => r.status === 'excess').length
        },
        storeDetails: results
    };
};

module.exports = {
    calculateStockHealth,
    getStoreStockHealth,
    getIngredientNetworkHealth,
    _calculateConsumption
};
