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
const unitConversion = require('./unitConversionService');

/**
 * Calcula o custo total de uma receita convertendo unidades para baseUnit.
 * Persiste totalCost, costPerYield e lastCalculatedAt no documento Recipe.
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
        if (!ingredient) {
            missingPrices.push({ ingredientId: 'unknown', ingredientName: 'Ingredient not found' });
            continue;
        }

        // Converter quantidade para unidade base do ingrediente
        const grossQuantity = item.netQuantity * (1 + item.lossFactor / 100);
        const factors = ingredient.conversionToBase ? Object.fromEntries(ingredient.conversionToBase) : {};
        let quantityInBase = grossQuantity;
        let appliedUnit = ingredient.baseUnit;

        if (item.unit !== ingredient.baseUnit) {
            try {
                const converted = unitConversion.toBaseUnit(grossQuantity, item.unit, ingredient.baseUnit, factors);
                quantityInBase = converted.quantityInBase;
                appliedUnit = ingredient.baseUnit;
            } catch (err) {
                // Se nao consegue converter, usa quantidade bruta diretamente
                quantityInBase = grossQuantity;
            }
        }

        // Obter preço do ingrediente (preco por unidade base)
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

        const itemCost = quantityInBase * unitCost;
        totalCost += itemCost;

        breakdown.push({
            ingredientId: ingredient._id,
            ingredientName: ingredient.name,
            netQuantity: item.netQuantity,
            recipeUnit: item.unit,
            lossFactor: item.lossFactor,
            grossQuantity: Math.round(grossQuantity * 1000) / 1000,
            quantityInBaseUnit: Math.round(quantityInBase * 1000) / 1000,
            baseUnit: appliedUnit,
            unitCost: unitCost,
            totalCost: Math.round(itemCost * 100) / 100,
            hasPrice: !!unitCost
        });
    }

    const totalCostRounded = Math.round(totalCost * 100) / 100;
    const costPerYieldRounded = Math.round((totalCost / recipe.yieldQuantity) * 100) / 100;

    // Persistir custos no documento Recipe
    recipe.totalCost = totalCostRounded;
    recipe.costPerYield = costPerYieldRounded;
    recipe.lastCalculatedAt = new Date();
    await recipe.save();

    return {
        recipeId,
        recipeName: recipe.name,
        sku: recipe.sku,
        totalCost: totalCostRounded,
        costPerYield: costPerYieldRounded,
        yieldQuantity: recipe.yieldQuantity,
        yieldUnit: recipe.yieldUnit,
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
    const StockLocation = mongoose.model('StockLocation');

    const recipe = await Recipe.findById(recipeId).populate('ingredients.ingredient');
    if (!recipe) {
        throw new Error('Recipe not found');
    }

    // Obter localização padrão da loja (STORE)
    const Store = mongoose.model('Store');
    const store = await Store.findById(recipe.store);
    if (!store) {
        throw new Error('Store not found for recipe');
    }
    const storeLocation = await StockLocation.getOrCreateStoreLocation(recipe.store, store.name);

    const results = {
        success: true,
        deducted: [],
        failed: [],
        substituted: []
    };

    // Processar cada ingrediente
    for (const item of recipe.ingredients) {
        try {
            // Buscar saldo do ingrediente na localização da loja
            let stockBalance = await StockBalance.findOne({
                location: storeLocation._id,
                ingredient: item.ingredient
            }).populate('ingredient');

            if (!stockBalance) {
                throw new Error(`Stock not found for ingredient: ${item.ingredient}`);
            }

            // Calcular quantidade a baixar com conversao de unidade
            const consumption = unitConversion.calculateConsumption(item, quantity, stockBalance.ingredient);
            const requiredQuantity = consumption.quantityInBase;

            // Verificar se tem saldo suficiente
            if (stockBalance.balance >= requiredQuantity) {
                // Baixa normal
                const balanceBefore = stockBalance.balance;
                stockBalance.balance -= requiredQuantity;
                await stockBalance.save();

                // Registrar movimento
                await StockMovement.create({
                    store: recipe.store,
                    location: storeLocation._id,
                    ingredient: item.ingredient,
                    type: 'recipe_deduction',
                    quantity: requiredQuantity,
                    unit: consumption.appliedUnit,
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
                        lossFactor: item.lossFactor,
                        recipeUnit: item.unit,
                        recipeQuantity: item.netQuantity,
                        convertedQuantity: consumption.grossQuantity
                    }
                });

                results.deducted.push({
                    ingredientId: item.ingredient,
                    ingredientName: stockBalance.ingredient?.name || item.ingredient,
                    quantityDeducted: Math.round(requiredQuantity * 1000) / 1000,
                    unit: consumption.appliedUnit,
                    recipeUnit: item.unit,
                    balanceAfter: stockBalance.balance
                });
            } else {
                // Saldo insuficiente - tentar substituto
                if (item.substitute) {
                    const substituteStock = await StockBalance.findOne({
                        location: storeLocation._id,
                        ingredient: item.substitute
                    }).populate('ingredient');

                    if (substituteStock && substituteStock.balance >= requiredQuantity) {
                        // Usar substituto
                        const balanceBefore = substituteStock.balance;
                        substituteStock.balance -= requiredQuantity;
                        await substituteStock.save();

                        await StockMovement.create({
                            store: recipe.store,
                            location: storeLocation._id,
                            ingredient: item.substitute,
                            type: 'recipe_deduction',
                            quantity: requiredQuantity,
                            unit: consumption.appliedUnit,
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
                            unit: consumption.appliedUnit,
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
    const StockLocation = mongoose.model('StockLocation');
    const Store = mongoose.model('Store');

    const recipe = await Recipe.findById(recipeId).populate('ingredients.ingredient');
    if (!recipe) {
        throw new Error('Recipe not found');
    }

    // Obter localizacao da loja
    const store = await Store.findById(recipe.store);
    const storeLocation = store ? await StockLocation.getOrCreateStoreLocation(recipe.store, store.name) : null;

    const results = {
        recipeId,
        recipeName: recipe.name,
        canProduce: true,
        quantity: quantity,
        ingredients: []
    };

    for (const item of recipe.ingredients) {
        // Calcular quantidade necessaria com conversao de unidade
        const grossQuantity = item.netQuantity * (1 + item.lossFactor / 100) * quantity;

        const stockBalance = await StockBalance.findOne({
            location: storeLocation?._id,
            ingredient: item.ingredient
        }).populate('ingredient');

        let requiredInBaseUnit = grossQuantity;
        let baseUnit = item.unit;

        if (stockBalance?.ingredient) {
            const factors = stockBalance.ingredient.conversionToBase ? Object.fromEntries(stockBalance.ingredient.conversionToBase) : {};
            if (item.unit !== stockBalance.ingredient.baseUnit) {
                try {
                    const converted = unitConversion.toBaseUnit(grossQuantity, item.unit, stockBalance.ingredient.baseUnit, factors);
                    requiredInBaseUnit = converted.quantityInBase;
                    baseUnit = stockBalance.ingredient.baseUnit;
                } catch (err) {
                    requiredInBaseUnit = grossQuantity;
                }
            } else {
                baseUnit = stockBalance.ingredient.baseUnit;
            }
        }

        const hasStock = stockBalance && stockBalance.balance >= requiredInBaseUnit;
        let substituteAvailable = false;
        let substituteName = null;

        if (!hasStock && item.substitute) {
            const substituteStock = await StockBalance.findOne({
                location: storeLocation?._id,
                ingredient: item.substitute
            }).populate('ingredient');

            substituteAvailable = substituteStock && substituteStock.balance >= requiredInBaseUnit;
            substituteName = substituteStock?.ingredient?.name || null;
        }

        results.ingredients.push({
            ingredientId: item.ingredient,
            ingredientName: stockBalance?.ingredient?.name || 'Unknown',
            required: Math.round(requiredInBaseUnit * 1000) / 1000,
            requiredInRecipeUnit: Math.round(grossQuantity * 1000) / 1000,
            recipeUnit: item.unit,
            available: stockBalance?.balance || 0,
            baseUnit,
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

/**
 * Simula consumo de ingredientes sem executar baixa (preparacao Fase 5).
 * Calcula quanto seria baixado do estoque para uma dada receita e quantidade,
 * incluindo conversao de unidades, mas SEM alterar saldos ou criar movimentacoes.
 *
 * @param {string} recipeId - ID da receita
 * @param {number} quantity - Quantidade de receitas sendo produzidas
 * @param {string} [locationId] - ID da localizacao de estoque (opcional, usa STORE da loja)
 * @returns {Promise<Object>} - Simulacao do consumo
 */
const simulateConsumption = async (recipeId, quantity = 1, locationId = null) => {
    const Recipe = mongoose.model('Recipe');
    const StockBalance = mongoose.model('StockBalance');
    const StockLocation = mongoose.model('StockLocation');
    const Store = mongoose.model('Store');

    const recipe = await Recipe.findById(recipeId).populate('ingredients.ingredient');
    if (!recipe) {
        throw new Error('Recipe not found');
    }
    if (!recipe.isActive) {
        throw new Error('Recipe is inactive — cannot simulate consumption');
    }

    // Obter localizacao
    let targetLocation = locationId
        ? await StockLocation.findById(locationId)
        : null;

    if (!targetLocation) {
        const store = await Store.findById(recipe.store);
        targetLocation = store
            ? await StockLocation.getOrCreateStoreLocation(recipe.store, store.name)
            : null;
    }

    const simulation = {
        recipeId,
        recipeName: recipe.name,
        sku: recipe.sku,
        quantity,
        wouldDeduct: [],
        wouldFail: [],
        totalEstimatedCost: 0,
        allIngredientsAvailable: true
    };

    for (const item of recipe.ingredients) {
        if (!recipe.ingredients) continue;

        const consumption = unitConversion.calculateConsumption(item, quantity, item.ingredient);

        const stockBalance = targetLocation
            ? await StockBalance.findOne({ location: targetLocation._id, ingredient: item.ingredient }).populate('ingredient')
            : null;

        const available = stockBalance?.balance || 0;
        const hasEnough = available >= consumption.quantityInBase;

        const estimatedItemCost = consumption.quantityInBase * (item.ingredient?.averageCost || 0);
        simulation.totalEstimatedCost += estimatedItemCost;

        simulation.wouldDeduct.push({
            ingredientId: item.ingredient._id,
            ingredientName: item.ingredient.name,
            recipeUnit: item.unit,
            recipeQuantity: item.netQuantity,
            lossFactor: item.lossFactor,
            grossQuantity: consumption.grossQuantity,
            stockUnit: consumption.appliedUnit,
            quantityInStockUnit: consumption.quantityInBase,
            available,
            hasEnough,
            estimatedCost: Math.round(estimatedItemCost * 100) / 100
        });

        if (!hasEnough) {
            simulation.allIngredientsAvailable = false;
            simulation.wouldFail.push({
                ingredientId: item.ingredient._id,
                ingredientName: item.ingredient.name,
                required: consumption.quantityInBase,
                available,
                shortfall: consumption.quantityInBase - available,
                unit: consumption.appliedUnit,
                hasSubstitute: !!item.substitute
            });
        }
    }

    simulation.totalEstimatedCost = Math.round(simulation.totalEstimatedCost * 100) / 100;

    return simulation;
};

module.exports = {
    calculateCost,
    deductStock,
    checkStockAvailability,
    getRestockAlerts,
    generateShoppingList,
    simulateConsumption
};
