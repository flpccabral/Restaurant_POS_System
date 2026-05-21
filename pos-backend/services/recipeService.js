/**
 * Recipe Service - Lógica de Negócio para Fichas Técnicas
 *
 * Funcionalidades:
 * - Cálculo de custo de receita
 * - Baixa automática de ingredientes
 * - Substituição de ingredientes
 * - Alertas de reposição
 */

const mongoose = require('mongoose');

/**
 * Calcula o custo total de uma receita
 * @param {string} recipeId - ID da receita
 * @param {Object} ingredientPrices - Mapa de preços de ingredientes (opcional)
 * @returns {Promise<Object>} - Custo total e detalhamento
 */
const calculateCost = async (recipeId, ingredientPrices = null) => {
    const Recipe = mongoose.model('Recipe');

    const recipe = await Recipe.findById(recipeId).populate('ingredients.ingredient');
    if (!recipe) {
        throw new Error('Recipe not found');
    }

    let totalCost = 0;
    const breakdown = [];
    const missingPrices = [];

    for (const item of recipe.ingredients) {
        const ingredient = item.ingredient;
        // Fórmula: quantidade com perda = netQuantity × (1 + lossFactor/100)
        const quantityWithLoss = item.netQuantity * (1 + item.lossFactor / 100);

        // Obter preço do ingrediente
        let unitCost = 0;
        if (ingredientPrices && ingredientPrices[ingredient._id.toString()]) {
            unitCost = ingredientPrices[ingredient._id.toString()];
        } else if (ingredient.averageCost) {
            unitCost = ingredient.averageCost;
        } else {
            missingPrices.push({
                ingredientId: ingredient._id,
                ingredientName: ingredient.name
            });
        }

        const itemCost = quantityWithLoss * unitCost;
        totalCost += itemCost;

        breakdown.push({
            ingredientId: ingredient._id,
            ingredientName: ingredient.name,
            netQuantity: item.netQuantity,
            lossFactor: item.lossFactor,
            quantityWithLoss: Math.round(quantityWithLoss * 1000) / 1000,
            unitCost: unitCost,
            totalCost: Math.round(itemCost * 100) / 100,
            hasPrice: !!unitCost
        });
    }

    return {
        recipeId,
        recipeName: recipe.name,
        sku: recipe.sku,
        totalCost: Math.round(totalCost * 100) / 100,
        costPerYield: Math.round((totalCost / recipe.yieldQuantity) * 100) / 100,
        yieldQuantity: recipe.yieldQuantity,
        hasIncompleteCost: missingPrices.length > 0,
        missingPrices,
        breakdown
    };
};

/**
 * Realiza baixa de ingredientes para uma receita
 * @param {string} recipeId - ID da receita
 * @param {number} quantity - Quantidade de receitas produzidas
 * @param {string} userId - ID do usuário que realizou a baixa
 * @returns {Promise<Object>} - Resultado da baixa
 */
const deductStock = async (recipeId, quantity = 1, userId = null) => {
    const Recipe = mongoose.model('Recipe');
    const StockBalance = mongoose.model('StockBalance');
    const StockMovement = mongoose.model('StockMovement');

    const recipe = await Recipe.findById(recipeId).populate('ingredients.ingredient');
    if (!recipe) {
        throw new Error('Recipe not found');
    }

    const results = {
        success: true,
        deducted: [],
        failed: [],
        substituted: []
    };

    // Processar cada ingrediente
    for (const item of recipe.ingredients) {
        // Fórmula de baixa: netQuantity × (1 + lossFactor/100) × quantity
        const requiredQuantity = item.netQuantity * (1 + item.lossFactor / 100) * quantity;

        try {
            // Buscar saldo do ingrediente
            let stockBalance = await StockBalance.findOne({
                store: recipe.store,
                ingredient: item.ingredient
            });

            if (!stockBalance) {
                throw new Error(`Stock not found for ingredient: ${item.ingredient}`);
            }

            // Verificar se tem saldo suficiente
            if (stockBalance.balance >= requiredQuantity) {
                // Baixa normal
                const balanceBefore = stockBalance.balance;
                stockBalance.balance -= requiredQuantity;
                await stockBalance.save();

                // Registrar movimento
                await StockMovement.create({
                    store: recipe.store,
                    ingredient: item.ingredient,
                    type: 'recipe_deduction',
                    quantity: requiredQuantity,
                    unit: item.unit,
                    balanceBefore,
                    balanceAfter: stockBalance.balance,
                    reason: `Baixa da receita: ${recipe.name}`,
                    reference: recipe.sku,
                    recipe: recipe._id,
                    user: userId,
                    metadata: {
                        recipeName: recipe.name,
                        variation: recipe.variation,
                        quantityProduced: quantity,
                        lossFactor: item.lossFactor
                    }
                });

                results.deducted.push({
                    ingredientId: item.ingredient,
                    ingredientName: stockBalance.ingredient?.name || item.ingredient,
                    quantityDeducted: Math.round(requiredQuantity * 1000) / 1000,
                    unit: item.unit,
                    balanceAfter: stockBalance.balance
                });
            } else {
                // Saldo insuficiente - tentar substituto
                if (item.substitute) {
                    const substituteStock = await StockBalance.findOne({
                        store: recipe.store,
                        ingredient: item.substitute
                    }).populate('ingredient');

                    if (substituteStock && substituteStock.balance >= requiredQuantity) {
                        // Usar substituto
                        const balanceBefore = substituteStock.balance;
                        substituteStock.balance -= requiredQuantity;
                        await substituteStock.save();

                        await StockMovement.create({
                            store: recipe.store,
                            ingredient: item.substitute,
                            type: 'recipe_deduction',
                            quantity: requiredQuantity,
                            unit: item.unit,
                            balanceBefore,
                            balanceAfter: substituteStock.balance,
                            reason: `Substituição na receita: ${recipe.name}`,
                            reference: recipe.sku,
                            recipe: recipe._id,
                            user: userId,
                            metadata: {
                                originalIngredient: item.ingredient,
                                substitutedFrom: item.ingredient,
                                recipeName: recipe.name,
                                quantityProduced: quantity
                            }
                        });

                        results.substituted.push({
                            originalIngredientId: item.ingredient,
                            substituteIngredientId: item.substitute,
                            substituteName: substituteStock.ingredient?.name || item.substitute,
                            quantityDeducted: Math.round(requiredQuantity * 1000) / 1000,
                            unit: item.unit,
                            balanceAfter: substituteStock.balance
                        });
                    } else {
                        throw new Error(`Insufficient stock for ingredient and substitute: ${item.ingredient}`);
                    }
                } else {
                    throw new Error(`Insufficient stock for ingredient: ${item.ingredient}`);
                }
            }
        } catch (error) {
            results.failed.push({
                ingredientId: item.ingredient,
                ingredientName: item.ingredient?.name || 'Unknown',
                error: error.message,
                requiredQuantity: Math.round(requiredQuantity * 1000) / 1000,
                unit: item.unit
            });
            results.success = false;
        }
    }

    return results;
};

/**
 * Verifica disponibilidade de estoque para uma receita
 * @param {string} recipeId - ID da receita
 * @param {number} quantity - Quantidade desejada
 * @returns {Promise<Object>} - Disponibilidade de cada ingrediente
 */
const checkStockAvailability = async (recipeId, quantity = 1) => {
    const Recipe = mongoose.model('Recipe');
    const StockBalance = mongoose.model('StockBalance');

    const recipe = await Recipe.findById(recipeId).populate('ingredients.ingredient');
    if (!recipe) {
        throw new Error('Recipe not found');
    }

    const results = {
        recipeId,
        recipeName: recipe.name,
        canProduce: true,
        quantity: quantity,
        ingredients: []
    };

    for (const item of recipe.ingredients) {
        const requiredQuantity = item.netQuantity * (1 + item.lossFactor / 100) * quantity;

        const stockBalance = await StockBalance.findOne({
            store: recipe.store,
            ingredient: item.ingredient
        }).populate('ingredient');

        const hasStock = stockBalance && stockBalance.balance >= requiredQuantity;
        let substituteAvailable = false;
        let substituteName = null;

        if (!hasStock && item.substitute) {
            const substituteStock = await StockBalance.findOne({
                store: recipe.store,
                ingredient: item.substitute
            }).populate('ingredient');

            substituteAvailable = substituteStock && substituteStock.balance >= requiredQuantity;
            substituteName = substituteStock?.ingredient?.name || null;
        }

        results.ingredients.push({
            ingredientId: item.ingredient,
            ingredientName: stockBalance?.ingredient?.name || 'Unknown',
            required: Math.round(requiredQuantity * 1000) / 1000,
            available: stockBalance?.balance || 0,
            unit: item.unit,
            hasStock,
            hasSubstitute: !!item.substitute,
            substituteAvailable,
            substituteName
        });

        if (!hasStock && !substituteAvailable) {
            results.canProduce = false;
        }
    }

    return results;
};

/**
 * Obtém ingredientes abaixo do estoque mínimo
 * @param {string} storeId - ID da loja
 * @returns {Promise<Array>} - Lista de ingredientes para reposição
 */
const getRestockAlerts = async (storeId) => {
    const StockBalance = mongoose.model('StockBalance');

    const lowStockItems = await StockBalance.find({
        store: storeId,
        balance: { $lte: mongoose.Types.Decimal128 ? mongoose.Types.Decimal128.fromString('0') : 0 }
    })
    .populate('ingredient', 'name category unit')
    .sort({ balance: 1 });

    return lowStockItems.map(item => ({
        ingredientId: item.ingredient,
        ingredientName: item.ingredient?.name || 'Unknown',
        category: item.ingredient?.category || 'Unknown',
        currentBalance: item.balance,
        minimumStock: item.minimumStock,
        unit: item.unit,
        suggestedQuantity: Math.ceil(item.minimumStock * 3 - item.balance),
        lastPurchasePrice: item.lastPurchasePrice,
        estimatedCost: (item.minimumStock * 3 - item.balance) * item.lastPurchasePrice
    }));
};

/**
 * Gera lista de compras baseada nos alertas
 * @param {string} storeId - ID da loja
 * @returns {Promise<Object>} - Lista de compras agrupada por fornecedor
 */
const generateShoppingList = async (storeId) => {
    const StockBalance = mongoose.model('StockBalance');

    const items = await StockBalance.find({
        store: storeId,
        balance: { $lte: mongoose.Types.Decimal128 ? mongoose.Types.Decimal128.fromString('0') : 0 },
        minimumStock: { $gt: 0 }
    })
    .populate('ingredient', 'name category unit')
    .populate('supplier', 'name email phone');

    // Agrupar por fornecedor
    const bySupplier = {};

    for (const item of items) {
        const supplierKey = item.supplier?._id?.toString() || 'no-supplier';
        const quantity = Math.ceil(item.minimumStock * 3 - item.balance);

        if (!bySupplier[supplierKey]) {
            bySupplier[supplierKey] = {
                supplier: item.supplier ? {
                    _id: item.supplier._id,
                    name: item.supplier.name,
                    email: item.supplier.email,
                    phone: item.supplier.phone
                } : null,
                items: []
            };
        }

        bySupplier[supplierKey].items.push({
            ingredientId: item.ingredient,
            ingredientName: item.ingredient?.name || 'Unknown',
            category: item.ingredient?.category || 'Unknown',
            quantity,
            unit: item.unit,
            estimatedPrice: item.lastPurchasePrice,
            estimatedTotal: quantity * item.lastPurchasePrice
        });
    }

    return {
        storeId,
        generatedAt: new Date(),
        totalItems: items.length,
        suppliers: Object.values(bySupplier)
    };
};

module.exports = {
    calculateCost,
    deductStock,
    checkStockAvailability,
    getRestockAlerts,
    generateShoppingList
};
