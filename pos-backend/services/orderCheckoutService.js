/**
 * Order Checkout Service — Baixa Automática Transacional por Venda
 *
 * Orquestra o fluxo:
 *   Venda → Recipe → simulateConsumption → deductStock transacional → StockMovement → CMV
 *
 * Ponto único de orquestração para criação de pedido com baixa de estoque.
 * NÃO é chamado diretamente do controller de criação de pedido — é chamado
 * no momento do pagamento (processPayment) quando o pedido está sendo finalizado.
 */

const mongoose = require('mongoose');
const Recipe = require('../models/recipeModel');
const Product = require('../models/productModel');
const StockLocation = require('../models/stockLocationModel');
const StockBalance = require('../models/stockBalanceModel');
const unitConversion = require('./unitConversionService');

/**
 * Resolve a localização de estoque local da loja (tipo STORE).
 * Se não existir, retorna null (não cria automaticamente para evitar side effects).
 *
 * @param {string} storeId
 * @returns {Promise<object|null>}
 */
const resolveStoreLocation = async (storeId) => {
    return StockLocation.findOne({
        store: storeId,
        type: 'STORE',
        isActive: true
    });
};

/**
 * Encontra a ficha técnica ativa para um item de pedido.
 * Usa productId + variation (SKU da variação) para localizar.
 *
 * @param {string} storeId
 * @param {string} productId
 * @param {string} [variationSku]
 * @returns {Promise<object|null>}
 */
const findRecipeForItem = async (storeId, productId, variationSku = null) => {
    const filter = {
        store: storeId,
        product: productId,
        isActive: true
    };

    if (variationSku) {
        filter.variation = variationSku;
    }

    let recipe = await Recipe.findOne(filter)
        .populate('ingredients.ingredient', 'name baseUnit averageCost conversionToBase');

    // Se não encontrou com variation, tenta sem
    if (!recipe && variationSku) {
        recipe = await Recipe.findOne({ store: storeId, product: productId, isActive: true })
            .populate('ingredients.ingredient', 'name baseUnit averageCost conversionToBase');
    }

    return recipe;
};

/**
 * Processa a baixa automática de estoque para todos os itens de um pedido.
 * Usa MongoDB session para atomicidade — todas as baixas ocorrem na mesma transação.
 *
 * @param {object} params
 * @param {string} params.storeId - ID da loja
 * @param {string} params.orderId - ID do pedido
 * @param {Array} params.orderItems - Itens do pedido [{ product, name, quantity, variation }]
 * @param {string} [params.userId] - ID do operador
 * @param {object} params.session - MongoDB session (transação externa)
 * @returns {Promise<object>} Resultado com COGS, movimentos, status
 */
const processOrderStockDeduction = async ({ storeId, orderId, orderItems, userId = null, session }) => {
    if (!session) {
        throw new Error('MongoDB session is required for transational stock deduction');
    }

    const result = {
        success: true,
        totalCOGS: 0,
        items: [],
        movements: [],
        errors: []
    };

    // Resolver localização local da loja
    const storeLocation = await resolveStoreLocation(storeId);
    if (!storeLocation) {
        throw new Error(`Store location (type=STORE) not found for store ${storeId}. Cannot deduct stock.`);
    }

    // Processar cada item do pedido
    for (const item of orderItems) {
        const itemResult = {
            itemId: item._id?.toString(),
            productName: item.name,
            productId: item.product?.toString() || item.product,
            quantity: item.quantity || 1,
            recipeId: null,
            recipeVersion: null,
            cogs: 0,
            ingredientCosts: [],
            stockDeductionStatus: 'pending',
            movements: []
        };

        try {
            // 1. Encontrar ficha técnica
            const recipe = await findRecipeForItem(storeId, item.product, item.variation);

            if (!recipe) {
                itemResult.stockDeductionStatus = 'no_recipe';
                result.errors.push({
                    item: item.name,
                    reason: `No active recipe found for product ${item.name}${item.variation ? ` (variation: ${item.variation})` : ''}`
                });
                result.items.push(itemResult);
                continue;
            }

            itemResult.recipeId = recipe._id.toString();
            itemResult.recipeVersion = recipe.version;

            // 2. Simular consumo (validação pré-baixa)
            const simulation = await simulateItemConsumption(recipe, item.quantity, storeLocation._id);

            if (!simulation.allIngredientsAvailable) {
                itemResult.stockDeductionStatus = 'insufficient_stock';
                result.errors.push({
                    item: item.name,
                    reason: 'Insufficient stock',
                    details: simulation.wouldFail
                });
                result.items.push(itemResult);
                continue;
            }

            // 3. Executar baixa transacional
            const deductionResult = await executeDeduction(
                recipe,
                item.quantity,
                storeId,
                storeLocation,
                orderId,
                item,
                userId,
                session
            );

            itemResult.cogs = deductionResult.totalCost;
            itemResult.ingredientCosts = deductionResult.ingredientCosts;
            itemResult.stockDeductionStatus = 'deducted';
            itemResult.movements = deductionResult.movements;

            result.totalCOGS += deductionResult.totalCost;
            result.items.push(itemResult);

        } catch (error) {
            itemResult.stockDeductionStatus = 'error';
            result.errors.push({
                item: item.name,
                reason: error.message
            });
            result.items.push(itemResult);
        }
    }

    result.totalCOGS = Math.round(result.totalCOGS * 100) / 100;

    // Se houve erro em algum item, falhar a transação inteira
    const hasHardErrors = result.errors.some(e =>
        e.reason && !e.reason.includes('No active recipe')
    );

    if (hasHardErrors) {
        result.success = false;
        throw new Error(
            `Stock deduction failed for order: ${result.errors.map(e => `${e.item}: ${e.reason}`).join('; ')}`
        );
    }

    return result;
};

/**
 * Simula consumo de um item (wrapper around unitConversion + stock check).
 * Chamado ANTES da baixa real para validar.
 *
 * @param {object} recipe
 * @param {number} quantity
 * @param {string} locationId
 * @returns {Promise<object>}
 */
const simulateItemConsumption = async (recipe, quantity, locationId) => {
    const StockBalance = mongoose.model('StockBalance');
    const simulation = {
        wouldDeduct: [],
        wouldFail: [],
        totalEstimatedCost: 0,
        allIngredientsAvailable: true
    };

    for (const item of recipe.ingredients) {
        const ingredient = item.ingredient;
        if (!ingredient) continue;

        const consumption = unitConversion.calculateConsumption(item, quantity, ingredient);

        const stockBalance = await StockBalance.findOne({
            location: locationId,
            ingredient: ingredient._id
        });

        const available = stockBalance?.balance || 0;
        const hasEnough = available >= consumption.quantityInBase;
        const estimatedCost = consumption.quantityInBase * (ingredient.averageCost || 0);

        simulation.totalEstimatedCost += estimatedCost;

        simulation.wouldDeduct.push({
            ingredientId: ingredient._id,
            ingredientName: ingredient.name,
            recipeUnit: item.unit,
            recipeQuantity: item.netQuantity,
            lossFactor: item.lossFactor,
            grossQuantity: consumption.grossQuantity,
            stockUnit: consumption.appliedUnit,
            quantityInStockUnit: consumption.quantityInBase,
            available,
            hasEnough,
            estimatedCost: Math.round(estimatedCost * 100) / 100
        });

        if (!hasEnough) {
            simulation.allIngredientsAvailable = false;
            simulation.wouldFail.push({
                ingredientId: ingredient._id,
                ingredientName: ingredient.name,
                required: consumption.quantityInBase,
                available,
                shortfall: consumption.quantityInBase - available,
                unit: consumption.appliedUnit
            });
        }
    }

    simulation.totalEstimatedCost = Math.round(simulation.totalEstimatedCost * 100) / 100;

    return simulation;
};

/**
 * Executa a baixa real dos ingredientes no estoque local.
 * DEVE ser chamado dentro de uma transação MongoDB.
 *
 * @param {object} recipe
 * @param {number} quantity
 * @param {string} storeId
 * @param {object} storeLocation
 * @param {string} orderId
 * @param {object} orderItem
 * @param {string} userId
 * @param {object} session
 * @returns {Promise<object>}
 */
const executeDeduction = async (recipe, quantity, storeId, storeLocation, orderId, orderItem, userId, session) => {
    const StockBalance = mongoose.model('StockBalance');
    const StockMovement = mongoose.model('StockMovement');

    const result = {
        totalCost: 0,
        ingredientCosts: [],
        movements: []
    };

    for (const item of recipe.ingredients) {
        const ingredient = item.ingredient;
        if (!ingredient) continue;

        // Calcular consumo com conversão de unidades
        const consumption = unitConversion.calculateConsumption(item, quantity, ingredient);
        const requiredQuantity = consumption.quantityInBase;

        // Buscar saldo no estoque local
        let stockBalance = await StockBalance.findOne({
            location: storeLocation._id,
            ingredient: ingredient._id
        }).session(session);

        if (!stockBalance) {
            throw new Error(`Stock balance not found for ingredient ${ingredient.name} at store location`);
        }

        if (stockBalance.balance < requiredQuantity) {
            throw new Error(
                `Insufficient stock for ${ingredient.name}: available ${stockBalance.balance}, required ${requiredQuantity} ${consumption.appliedUnit}`
            );
        }

        // Baixar saldo
        const balanceBefore = stockBalance.balance;
        stockBalance.balance -= requiredQuantity;
        await stockBalance.save({ session });

        const itemCost = requiredQuantity * (ingredient.averageCost || 0);
        result.totalCost += itemCost;

        result.ingredientCosts.push({
            ingredientId: ingredient._id,
            ingredientName: ingredient.name,
            quantity: requiredQuantity,
            unit: consumption.appliedUnit,
            cost: Math.round(itemCost * 100) / 100,
            balanceBefore,
            balanceAfter: stockBalance.balance
        });

        // Registrar movimento
        const movement = await StockMovement.create([{
            store: storeId,
            location: storeLocation._id,
            ingredient: ingredient._id,
            type: 'recipe_deduction',
            quantity: requiredQuantity,
            unit: consumption.appliedUnit,
            balanceBefore,
            balanceAfter: stockBalance.balance,
            reason: `Baixa automática por venda — Pedido ${orderItem.name}`,
            reference: orderId,
            recipe: recipe._id,
            product: orderItem.product,
            user: userId,
            metadata: {
                recipeName: recipe.name,
                recipeId: recipe._id.toString(),
                recipeVersion: recipe.version,
                orderId,
                orderItemId: orderItem._id?.toString(),
                orderItemName: orderItem.name,
                quantityProduced: quantity,
                lossFactor: item.lossFactor,
                recipeUnit: item.unit,
                recipeQuantity: item.netQuantity,
                convertedQuantity: consumption.grossQuantity,
                stockDeduction: 'automatic_sale'
            }
        }], { session });

        result.movements.push(movement[0]._id);
    }

    result.totalCost = Math.round(result.totalCost * 100) / 100;

    return result;
};

/**
 * Rollback da baixa de estoque em caso de falha.
 * Reverte os movimentos e restaura os saldos.
 *
 * @param {Array} movements
 * @param {string} storeId
 * @param {object} session
 */
const rollbackStockDeduction = async (movements, storeId, session) => {
    const StockBalance = mongoose.model('StockBalance');
    const StockMovement = mongoose.model('StockMovement');

    // Reverter na ordem inversa
    for (let i = movements.length - 1; i >= 0; i--) {
        const movement = movements[i];
        const stockBalance = await StockBalance.findById(movement).session(session);
        if (stockBalance) {
            stockBalance.balance += movement.quantity;
            await stockBalance.save({ session });
        }
    }
};

module.exports = {
    processOrderStockDeduction,
    resolveStoreLocation,
    findRecipeForItem,
    simulateItemConsumption,
    executeDeduction,
    rollbackStockDeduction
};
