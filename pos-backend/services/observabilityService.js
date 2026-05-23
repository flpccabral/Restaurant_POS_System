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
                message: `Byproduct '${ingredient.ingredient?.name}' available (${ingredient.balance}${ingredient.unit}). Consider transfer to compatible operations.`,
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
const dismissAlert = async (alertId, userId, reason) => {
    const alert = await OperationalAlert.findById(alertId);
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
const resolveAlert = async (alertId, userId, notes) => {
    const alert = await OperationalAlert.findById(alertId);
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
            message = `Stockout: '${name}' has 0${unit} at ${store?.name || 'store'}. Immediate replenishment required.`;
            break;
        case 'critical':
            type = 'critical_stock';
            severity = 'high';
            message = `Critical stock: '${name}' at ${balance}${unit} (min: ${policy?.minQuantity}${unit}). Urgent replenishment needed.`;
            break;
        case 'low':
            type = 'low_stock';
            severity = 'medium';
            message = `Low stock: '${name}' at ${balance}${unit} (reorder point: ${policy?.reorderPoint}${unit}). Consider replenishment.`;
            break;
        case 'excess':
            type = 'excess_stock';
            severity = 'low';
            message = `Excess stock: '${name}' at ${balance}${unit} (max: ${policy?.maxQuantity}${unit}). Consider transfer to other stores.`;
            break;
        case 'no_policy':
            type = 'no_policy';
            severity = 'info';
            message = `No stock policy defined for '${name}'. Consider creating a StockPolicy for better monitoring.`;
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
        message: data.message || `Purchase registered for '${data.ingredientName || 'ingredient'}' (${data.quantity || ''}${data.unit || ''})`,
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
 * Gera alertas para produtos ativos sem ficha técnica (TASK 10 — Fase 8.4.2).
 * Varre todos os produtos ativos da loja e verifica se possuem Recipe.isActive=true.
 * Cria alertas do tipo 'product_without_recipe' por produto.
 */
const checkProductsWithoutRecipe = async (storeId) => {
    const Product = mongoose.model('Product');
    const Recipe = mongoose.model('Recipe');

    const products = await Product.find({ store: storeId, isActive: true })
        .populate('category', 'name')
        .select('name variations');

    const recipes = await Recipe.find({ store: storeId, isActive: true })
        .select('product variation')
        .lean();

    // Build lookup map: "productId:variationSku" -> recipe
    const recipeMap = new Map();
    for (const r of recipes) {
        recipeMap.set(`${r.product.toString()}:${r.variation}`, r);
    }

    const missingRecipes = [];
    for (const product of products) {
        const vars = product.variations || [];
        if (vars.length === 0) {
            missingRecipes.push({ productId: product._id, productName: product.name });
        } else {
            for (const v of vars) {
                if (!v.isActive) continue;
                const key = `${product._id.toString()}:${v.sku}`;
                if (!recipeMap.has(key)) {
                    missingRecipes.push({
                        productId: product._id,
                        productName: product.name,
                        variationName: v.name,
                        sku: v.sku
                    });
                }
            }
        }
    }

    const generatedAlerts = [];
    const store = await mongoose.model('Store').findById(storeId).select('name').lean();

    for (const item of missingRecipes) {
        try {
            const alert = await OperationalAlert.findOrCreate({
                type: 'product_without_recipe',
                severity: 'high',
                store: storeId,
                status: 'new',
                message: `Produto '${item.productName}'${item.variationName ? ` (variação: ${item.variationName})` : ''} não possui ficha técnica ativa em ${store?.name || 'loja'}. Vendas deste produto não geram baixa de estoque nem CMV.`,
                currentValue: 1,
                metadata: {
                    productId: item.productId?.toString(),
                    productName: item.productName,
                    variationName: item.variationName,
                    sku: item.sku,
                    missingRecipe: true
                }
            });
            generatedAlerts.push(alert);
        } catch (err) {
            // Skip duplicates silently
        }
    }

    // Also check for recipe-less products and create consolidated summary
    return {
        storeId,
        storeName: store?.name,
        totalMissing: missingRecipes.length,
        productsWithoutRecipe: missingRecipes,
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
