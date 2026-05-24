/**
 * Order Checkout Service — Baixa Automática Transacional por Venda
 *
 * Orquestra o fluxo:
 *   Venda → Recipe → simulateConsumption → deductStock transacional → StockMovement → CMV
 *
 * Ponto único de orquestração para criação de pedido com baixa de estoque.
 * NÃO é chamado diretamente do controller de criação de pedido — é chamado
 * no momento do pagamento (processPayment) quando o pedido está sendo finalizado.
 *
 * ================================================================
 * POLITICA DE BAIXA: ALL-OR-NOTHING TRANSACIONAL (Fase 9.1C)
 * ================================================================
 * - A baixa de estoque é atômica por pedido (MongoDB transaction)
 * - Se qualquer item aplicável falhar com hard error, toda a transação é abortada
 * - Soft errors (no_recipe, incomplete_config, unknown rule) NÃO abortam a transação
 * - Hard errors (saldo insuficiente, StockBalance ausente, location ausente) ABORTAM tudo
 * - Quando a transação aborta, o status do pedido é salvo como 'failed' fora da transação
 * - Um alerta crítico é gerado para cada falha de baixa
 * ================================================================
 */

const mongoose = require('mongoose');
const Recipe = require('../models/recipeModel');
const Product = require('../models/productModel');
const StockLocation = require('../models/stockLocationModel');
const StockBalance = require('../models/stockBalanceModel');
const unitConversion = require('./unitConversionService');
const OperationalAlert = require('../models/operationalAlertModel');

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
    // 1. Tentar por sku (campo único por loja — mais confiável)
    if (variationSku) {
        const recipeBySku = await Recipe.findOne({
            store: storeId,
            product: productId,
            sku: variationSku,
            isActive: true
        }).populate('ingredients.ingredient', 'name baseUnit averageCost conversionToBase');

        if (recipeBySku) return recipeBySku;
    }

    // 2. Fallback: busca por variation (SKU enviado pelo PDV)
    if (variationSku) {
        const recipeByVariation = await Recipe.findOne({
            store: storeId,
            product: productId,
            variation: variationSku,
            isActive: true
        }).populate('ingredients.ingredient', 'name baseUnit averageCost conversionToBase');

        if (recipeByVariation) return recipeByVariation;
    }

    // 3. Fallback final: busca apenas por produto (para variações não encontradas)
    const recipeFallback = await Recipe.findOne({
        store: storeId,
        product: productId,
        isActive: true
    }).populate('ingredients.ingredient', 'name baseUnit averageCost conversionToBase');

    return recipeFallback;
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
            movements: [],
            stockImpactRule: null
        };

        try {
            // 0. Buscar produto para determinar regra de impacto em estoque
            const product = await Product.findById(item.product).lean();

            if (!product) {
                itemResult.stockDeductionStatus = 'error';
                itemResult.stockDeductionReason = `Product not found: ${item.name}`;
                result.errors.push({
                    item: item.name,
                    reason: itemResult.stockDeductionReason
                });
                result.items.push(itemResult);
                continue;
            }

            const rule = product.stockImpactRule || 'recipe_composition';
            itemResult.stockImpactRule = rule;

            // Fase 9.1D — enriquecer itemResult com metadados do produto
            itemResult.sellableType = product.sellableType || null;
            itemResult.sku = product.sku || null;
            itemResult.variation = item.variation || null;
            itemResult.pricePerQuantity = item.pricePerQuantity || item.price || null;

            switch (rule) {
                case 'recipe_composition': {
                    // Comportamento atual: encontrar Recipe, simular, baixar
                    const recipe = await findRecipeForItem(storeId, item.product, item.variation);

                    if (!recipe) {
                        itemResult.stockDeductionStatus = 'no_recipe';
                        itemResult.stockDeductionReason = `No active recipe found for product ${item.name}${item.variation ? ` (variation: ${item.variation})` : ''}`;
                        result.errors.push({
                            item: item.name,
                            reason: itemResult.stockDeductionReason
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
                        itemResult.stockDeductionReason = `Insufficient stock: ${simulation.wouldFail.map(f => `${f.ingredientName} (need ${f.required}, have ${f.available})`).join('; ')}`;
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
                    break;
                }

                case 'stock_item_direct': {
                    // Baixa direta de um item de estoque específico
                    if (!product.directStockItem) {
                        itemResult.stockDeductionStatus = 'error';
                        itemResult.stockDeductionReason = `Product ${item.name} has stock_item_direct rule but no directStockItem configured`;
                        result.errors.push({
                            item: item.name,
                            reason: itemResult.stockDeductionReason
                        });
                        result.items.push(itemResult);
                        continue;
                    }

                    const StockBalance = mongoose.model('StockBalance');
                    const StockMovement = mongoose.model('StockMovement');

                    // Buscar ingrediente com averageCost
                    const GlobalIngredient = mongoose.model('GlobalIngredient');
                    const directIngredient = await GlobalIngredient.findById(product.directStockItem).lean();

                    if (!directIngredient) {
                        itemResult.stockDeductionStatus = 'error';
                        itemResult.stockDeductionReason = `Direct stock ingredient not found for product ${item.name}`;
                        result.errors.push({
                            item: item.name,
                            reason: itemResult.stockDeductionReason
                        });
                        result.items.push(itemResult);
                        continue;
                    }

                    const qtyPerUnit = product.directStockQuantity || 1;
                    const totalQty = qtyPerUnit * item.quantity;
                    const deductionUnit = product.directStockUnit || directIngredient.baseUnit;

                    // Buscar saldo no estoque local
                    let stockBalance = await StockBalance.findOne({
                        location: storeLocation._id,
                        ingredient: directIngredient._id
                    }).session(session);

                    if (!stockBalance) {
                        itemResult.stockDeductionStatus = 'error';
                        itemResult.stockDeductionReason = `Stock balance not found for ingredient ${directIngredient.name}`;
                        result.errors.push({
                            item: item.name,
                            reason: itemResult.stockDeductionReason
                        });
                        result.items.push(itemResult);
                        continue;
                    }

                    if (stockBalance.balance < totalQty) {
                        itemResult.stockDeductionStatus = 'insufficient_stock';
                        itemResult.stockDeductionReason = `Insufficient stock for ${directIngredient.name}: available ${stockBalance.balance}, required ${totalQty} ${deductionUnit}`;
                        result.errors.push({
                            item: item.name,
                            reason: itemResult.stockDeductionReason
                        });
                        result.items.push(itemResult);
                        continue;
                    }

                    // Baixar saldo
                    const balanceBefore = stockBalance.balance;
                    stockBalance.balance -= totalQty;
                    await stockBalance.save({ session });

                    const itemCost = totalQty * (directIngredient.averageCost || 0);
                    result.totalCOGS += itemCost;

                    itemResult.cogs = itemCost;
                    itemResult.ingredientCosts.push({
                        ingredientId: directIngredient._id,
                        ingredientName: directIngredient.name,
                        quantity: totalQty,
                        unit: deductionUnit,
                        cost: Math.round(itemCost * 100) / 100,
                        balanceBefore,
                        balanceAfter: stockBalance.balance
                    });

                    // Registrar movimento
                    const movement = await StockMovement.create([{
                        store: storeId,
                        location: storeLocation._id,
                        ingredient: directIngredient._id,
                        type: 'direct_sale_deduction',
                        quantity: totalQty,
                        unit: deductionUnit,
                        balanceBefore,
                        balanceAfter: stockBalance.balance,
                        reason: `Baixa direta por venda — ${item.name} (Pedido ${orderId})`,
                        reference: orderId,
                        product: item.product,
                        user: userId,
                        metadata: {
                            stockImpactRule: 'stock_item_direct',
                            productId: item.product?.toString(),
                            productName: item.name,
                            directStockItem: directIngredient._id.toString(),
                            directStockItemName: directIngredient.name,
                            directStockQuantity: qtyPerUnit,
                            directStockUnit: deductionUnit,
                            orderId,
                            orderItemId: item._id?.toString(),
                            quantitySold: item.quantity,
                            totalDeducted: totalQty,
                            stockDeduction: 'automatic_sale_direct'
                        }
                    }], { session });

                    itemResult.stockDeductionStatus = 'deducted';
                    itemResult.movements.push(movement[0]._id);

                    result.items.push(itemResult);
                    break;
                }

                case 'no_stock_impact': {
                    // Sem baixa intencional — CMV = 0
                    itemResult.stockDeductionStatus = 'not_applicable';
                    itemResult.cogs = 0;
                    result.items.push(itemResult);
                    continue;
                }

                case 'combo_components': {
                    // Combo não implementado — gerar alerta
                    itemResult.stockDeductionStatus = 'incomplete_config';
                    itemResult.stockDeductionReason = `Product ${item.name} has combo_components rule which is not implemented yet`;
                    result.errors.push({
                        item: item.name,
                        reason: itemResult.stockDeductionReason
                    });
                    result.items.push(itemResult);
                    continue;
                }

                default: {
                    itemResult.stockDeductionStatus = 'error';
                    itemResult.stockDeductionReason = `Unknown stockImpactRule '${rule}' for product ${item.name}`;
                    result.errors.push({
                        item: item.name,
                        reason: itemResult.stockDeductionReason
                    });
                    result.items.push(itemResult);
                }
            }
        } catch (error) {
            itemResult.stockDeductionStatus = 'error';
            itemResult.stockDeductionReason = error.message;
            result.errors.push({
                item: item.name,
                reason: error.message
            });
            result.items.push(itemResult);
        }
    }

    result.totalCOGS = Math.round(result.totalCOGS * 100) / 100;

    // Se houve erro em algum item, falhar a transação inteira
    // "No active recipe", incomplete_config e unknown rule não bloqueiam a venda
    const softErrorPatterns = ['No active recipe', 'combo_components rule which is not implemented', 'Unknown stockImpactRule'];
    const hasHardErrors = result.errors.some(e =>
        e.reason && !softErrorPatterns.some(p => e.reason.includes(p))
    );

    if (hasHardErrors) {
        result.success = false;
        throw new Error(
            `Stock deduction failed for order: ${result.errors.map(e => `${e.item}: ${e.reason}`).join('; ')}`
        );
    }

    // GERAR ALERTAS para itens com problemas de baixa de estoque
    // Executado fora da transação — não deve bloquear a venda
    const problematicItems = result.items.filter(i =>
        ['no_recipe', 'incomplete_config', 'error'].includes(i.stockDeductionStatus)
    );
    if (problematicItems.length > 0) {
        try {
            const alerts = problematicItems.map(item => {
                let reason = 'no_active_recipe';
                let message = `Venda realizada sem baixa de estoque — Produto '${item.productName}' (Pedido: ${orderId}) não possui ficha técnica ativa. CMV e saldo de estoque podem estar incorretos.`;

                if (item.stockDeductionStatus === 'incomplete_config') {
                    reason = 'incomplete_stock_rule';
                    message = `Venda realizada sem baixa de estoque — Produto '${item.productName}' (Pedido: ${orderId}) possui regra de impacto incompleta (combo_components). CMV e saldo podem estar incorretos.`;
                } else if (item.stockDeductionStatus === 'error') {
                    reason = 'stock_deduction_error';
                    message = `Venda realizada sem baixa de estoque — Produto '${item.productName}' (Pedido: ${orderId}) falhou na baixa: ${item.errors?.join(', ') || 'erro desconhecido'}. CMV e saldo podem estar incorretos.`;
                }

                return {
                    type: 'sale_without_stock_deduction',
                    severity: 'critical',
                    store: storeId,
                    status: 'new',
                    message,
                    currentValue: item.quantity,
                    metadata: {
                        orderId,
                        productId: item.productId,
                        productName: item.productName,
                        quantity: item.quantity,
                        reason,
                        stockDeductionStatus: item.stockDeductionStatus,
                        stockImpactRule: item.stockImpactRule
                    }
                };
            });

            // Create alerts in parallel (outside session, non-blocking)
            for (const alertData of alerts) {
                OperationalAlert.findOrCreate(alertData).catch(err => {
                    console.error(`[orderCheckoutService] Failed to create alert: ${err.message}`);
                });
            }
        } catch (alertErr) {
            // Log but do not fail the transaction
            console.error(`[orderCheckoutService] Alert creation error: ${alertErr.message}`);
        }
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
