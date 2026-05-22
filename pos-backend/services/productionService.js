/**
 * Production Service — Produção interna e subprodutos reaproveitáveis (Fase 5.1A)
 *
 * Orquestra o fluxo:
 *   Produção → validar inputs → calcular custos → transação:
 *     consumir inputs (production_consumption)
 *     gerar outputs (production_output / production_byproduct / production_waste)
 *     salvar ProductionBatch
 *
 * Custo: proporcional por peso/quantidade (MVP).
 */

const mongoose = require('mongoose');
const StockBalance = require('../models/stockBalanceModel');
const StockMovement = require('../models/stockMovementModel');
const StockLocation = require('../models/stockLocationModel');
const ProductionBatch = require('../models/productionBatchModel');
const GlobalIngredient = require('../models/globalIngredientModel');
const Store = require('../models/storeModel');
const User = require('../models/userModel');
const unitConversion = require('./unitConversionService');

/**
 * Valida que o input tem saldo suficiente no estoque local.
 * Retorna { valid, error, balance, required }.
 *
 * @param {string} locationId
 * @param {string} ingredientId
 * @param {number} quantity
 * @param {string} unit
 * @param {object} ingredient - GlobalIngredient populated
 * @returns {Promise<object>}
 */
const validateInputStock = async (locationId, ingredientId, quantity, unit, ingredient) => {
    const stockBalance = await StockBalance.findOne({
        location: locationId,
        ingredient: ingredientId
    });

    if (!stockBalance) {
        return { valid: false, error: `Stock balance not found for ${ingredient.name} at location` };
    }

    // Converter para unidade base se necessário
    const factors = ingredient.conversionToBase ? Object.fromEntries(ingredient.conversionToBase) : {};
    let quantityInBase = quantity;
    try {
        if (unit !== ingredient.baseUnit) {
            const converted = unitConversion.toBaseUnit(quantity, unit, ingredient.baseUnit, factors);
            quantityInBase = converted.quantityInBase;
        }
    } catch (err) {
        return { valid: false, error: `Unit conversion error for ${ingredient.name}: ${err.message}` };
    }

    if (stockBalance.balance < quantityInBase) {
        return {
            valid: false,
            error: `Insufficient stock for ${ingredient.name}: available ${stockBalance.balance} ${stockBalance.unit}, required ${quantityInBase} ${ingredient.baseUnit}`,
            balance: stockBalance.balance,
            required: quantityInBase
        };
    }

    return { valid: true, balance: stockBalance.balance, quantityInBase };
};

/**
 * Calcula custo total dos inputs e aloca proporcionalmente nos outputs.
 *
 * @param {Array} inputs - [{ ingredient, quantity, unit, quantityInBase }]
 * @param {Array} outputs - [{ quantity, quantityInBase, outputType }]
 * @returns {object} { totalCost, inputs: [{ costAllocated }], outputs: [{ costAllocated }] }
 */
const allocateCosts = (inputs, outputs) => {
    // Custo total dos inputs
    let totalCost = 0;
    for (const input of inputs) {
        totalCost += input.quantityInBase * (input.ingredient.averageCost || 0);
    }
    totalCost = Math.round(totalCost * 100) / 100;

    // Alocar proporcionalmente por peso nos outputs (excluindo waste/loss)
    const billableOutputs = outputs.filter(o => o.outputType === 'main_output' || o.outputType === 'byproduct' || o.outputType === 'transferable_surplus' || o.outputType === 'rework');
    let totalBillableWeight = 0;
    for (const output of billableOutputs) {
        totalBillableWeight += output.quantityInBase;
    }

    // Alocar custo nos outputs billable
    for (const output of billableOutputs) {
        if (totalBillableWeight > 0) {
            const proportion = output.quantityInBase / totalBillableWeight;
            output.costAllocated = Math.round(totalCost * proportion * 100) / 100;
        } else {
            output.costAllocated = 0;
        }
    }

    // Waste/loss não recebe custo alocado no MVP (custo vai todo para outputs principais)
    for (const output of outputs) {
        if (output.outputType === 'waste' || output.outputType === 'loss') {
            output.costAllocated = 0;
        }
    }

    const totalOutputCost = billableOutputs.reduce((sum, o) => sum + o.costAllocated, 0);

    return {
        totalCost,
        totalOutputCost: Math.round(totalOutputCost * 100) / 100,
        inputs,
        outputs
    };
};

/**
 * Processa uma produção interna transacional.
 *
 * @param {object} params
 * @param {string} params.storeId - ID da loja
 * @param {string} params.locationId - ID da localização de estoque da loja
 * @param {Array} params.inputs - [{ ingredientId, quantity, unit }]
 * @param {Array} params.outputs - [{ ingredientId, quantity, unit, outputType }]
 * @param {string} params.userId - ID do usuário responsável
 * @param {string} [params.observations] - Observações
 * @param {string} [params.productionRecipeId] - ID da receita de produção (opcional)
 * @returns {Promise<object>} ProductionBatch criado com detalhes
 */
const processProductionBatch = async ({ storeId, locationId, inputs, outputs, userId, observations, productionRecipeId }) => {
    if (!inputs || inputs.length === 0) {
        throw new Error('At least one input is required');
    }
    if (!outputs || outputs.length === 0) {
        throw new Error('At least one output is required');
    }

    // Validar store
    const store = await Store.findById(storeId);
    if (!store) {
        throw new Error(`Store ${storeId} not found`);
    }

    // Validar location
    const location = await StockLocation.findById(locationId);
    if (!location) {
        throw new Error(`Stock location ${locationId} not found`);
    }
    if (location.store && location.store.toString() !== storeId.toString()) {
        throw new Error(`Stock location ${location.name} does not belong to store ${storeId}`);
    }

    // Validar e enriquecer inputs
    const enrichedInputs = [];
    for (const input of inputs) {
        const ingredient = await GlobalIngredient.findById(input.ingredientId);
        if (!ingredient) {
            throw new Error(`Ingredient ${input.ingredientId} not found`);
        }
        if (!ingredient.isActive) {
            throw new Error(`Ingredient ${ingredient.name} is not active`);
        }

        const factors = ingredient.conversionToBase ? Object.fromEntries(ingredient.conversionToBase) : {};
        let quantityInBase = input.quantity;
        if (input.unit !== ingredient.baseUnit) {
            const converted = unitConversion.toBaseUnit(input.quantity, input.unit, ingredient.baseUnit, factors);
            quantityInBase = converted.quantityInBase;
        }

        enrichedInputs.push({
            ingredientId: input.ingredientId,
            ingredient,
            quantity: input.quantity,
            unit: input.unit,
            quantityInBase,
            costPerUnit: ingredient.averageCost || 0
        });
    }

    // Validar outputs
    const enrichedOutputs = [];
    for (const output of outputs) {
        const ingredient = await GlobalIngredient.findById(output.ingredientId);
        if (!ingredient) {
            throw new Error(`Output ingredient ${output.ingredientId} not found`);
        }
        if (!ingredient.isActive) {
            throw new Error(`Output ingredient ${ingredient.name} is not active`);
        }

        const factors = ingredient.conversionToBase ? Object.fromEntries(ingredient.conversionToBase) : {};
        let quantityInBase = output.quantity;
        if (output.unit !== ingredient.baseUnit) {
            const converted = unitConversion.toBaseUnit(output.quantity, output.unit, ingredient.baseUnit, factors);
            quantityInBase = converted.quantityInBase;
        }

        enrichedOutputs.push({
            ingredientId: output.ingredientId,
            ingredient,
            quantity: output.quantity,
            unit: output.unit,
            quantityInBase,
            outputType: output.outputType,
            destinationLocation: output.destinationLocation || null
        });
    }

    // Validar saldos dos inputs
    for (const input of enrichedInputs) {
        const validation = await validateInputStock(locationId, input.ingredientId, input.quantity, input.unit, input.ingredient);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        input.quantityInBase = validation.quantityInBase;
    }

    // Calcular custos e alocar
    const costAllocation = allocateCosts(enrichedInputs, enrichedOutputs);

    // Calcular yield percentage
    const totalInputWeight = enrichedInputs.reduce((sum, i) => sum + i.quantityInBase, 0);
    const mainOutputs = enrichedOutputs.filter(o => o.outputType === 'main_output');
    const totalMainOutputWeight = mainOutputs.reduce((sum, o) => sum + o.quantityInBase, 0);
    const yieldPercentage = totalInputWeight > 0 ? Math.round((totalMainOutputWeight / totalInputWeight) * 10000) / 100 : 0;

    // Executar transação
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Consumir inputs
        const inputMovements = [];
        for (const input of enrichedInputs) {
            const stockBalance = await StockBalance.findOne({
                location: locationId,
                ingredient: input.ingredientId
            }).session(session);

            if (!stockBalance) {
                throw new Error(`Stock balance not found for ${input.ingredient.name} at location`);
            }

            const balanceBefore = stockBalance.balance;
            stockBalance.balance -= input.quantityInBase;
            await stockBalance.save({ session });

            const movementData = {
                store: storeId,
                location: locationId,
                ingredient: input.ingredientId,
                type: 'production_consumption',
                quantity: input.quantityInBase,
                unit: input.ingredient.baseUnit,
                balanceBefore,
                balanceAfter: stockBalance.balance,
                reason: `Produção interna — consumo de ${input.ingredient.name}`,
                user: userId,
                metadata: {
                    productionType: 'input',
                    originalQuantity: input.quantity,
                    originalUnit: input.unit,
                    convertedQuantity: input.quantityInBase,
                    cost: Math.round(input.quantityInBase * input.costPerUnit * 100) / 100
                }
            };

            const movement = await StockMovement.create([movementData], { session });
            inputMovements.push(movement[0]._id);
        }

        // 2. Gerar outputs
        const outputMovements = [];
        for (const output of enrichedOutputs) {
            // Determinar tipo de movimento
            let movementType;
            switch (output.outputType) {
                case 'main_output':
                    movementType = 'production_output';
                    break;
                case 'byproduct':
                    movementType = 'production_byproduct';
                    break;
                case 'waste':
                case 'loss':
                    movementType = 'production_waste';
                    break;
                case 'rework':
                case 'transferable_surplus':
                    movementType = 'production_output';
                    break;
                default:
                    movementType = 'production_output';
            }

            // Determinar localização de destino
            let outputLocation = locationId;
            if (output.destinationLocation) {
                const destLoc = await StockLocation.findById(output.destinationLocation).session(session);
                if (destLoc && destLoc.store && destLoc.store.toString() === storeId.toString()) {
                    outputLocation = output.destinationLocation;
                }
            }

            // Buscar ou criar saldo
            let stockBalance = await StockBalance.findOne({
                location: outputLocation,
                ingredient: output.ingredientId
            }).session(session);

            if (!stockBalance) {
                const createdBal = await StockBalance.create([{
                    store: storeId,
                    location: outputLocation,
                    ingredient: output.ingredientId,
                    balance: 0,
                    reserved: 0,
                    available: 0,
                    unit: output.ingredient.baseUnit,
                    minimumStock: 0,
                    lastPurchasePrice: output.quantityInBase > 0 ? output.costAllocated / output.quantityInBase : 0
                }], { session });
                stockBalance = createdBal[0];
            }

            const balanceBefore = stockBalance.balance;
            stockBalance.balance += output.quantityInBase;
            await stockBalance.save({ session });

            const movementData = {
                store: storeId,
                location: outputLocation,
                ingredient: output.ingredientId,
                type: movementType,
                quantity: output.quantityInBase,
                unit: output.ingredient.baseUnit,
                balanceBefore,
                balanceAfter: stockBalance.balance,
                reason: `Produção interna — ${output.outputType}: ${output.ingredient.name}`,
                user: userId,
                metadata: {
                    productionType: 'output',
                    outputType: output.outputType,
                    originalQuantity: output.quantity,
                    originalUnit: output.unit,
                    convertedQuantity: output.quantityInBase,
                    costAllocated: output.costAllocated
                }
            };

            const movement = await StockMovement.create([movementData], { session });
            outputMovements.push(movement[0]._id);
        }

        // 3. Criar ProductionBatch
        const batchInputs = enrichedInputs.map(i => ({
            ingredient: i.ingredientId,
            quantity: i.quantityInBase,
            unit: i.ingredient.baseUnit,
            costAllocated: Math.round(i.quantityInBase * i.costPerUnit * 100) / 100
        }));

        const batchOutputs = enrichedOutputs.map(o => ({
            ingredient: o.ingredientId,
            quantity: o.quantityInBase,
            unit: o.ingredient.baseUnit,
            outputType: o.outputType,
            costAllocated: o.costAllocated,
            destinationLocation: o.destinationLocation || null
        }));

        const batch = await ProductionBatch.create([{
            store: storeId,
            location: locationId,
            status: 'completed',
            inputs: batchInputs,
            outputs: batchOutputs,
            yieldPercentage,
            totalInputCost: costAllocation.totalCost,
            totalOutputCost: costAllocation.totalOutputCost,
            user: userId,
            productionRecipe: productionRecipeId || null,
            startedAt: new Date(),
            completedAt: new Date(),
            observations: observations || null
        }], { session });

        const createdBatch = batch[0];

        // Vincular movimentos ao batch
        await StockMovement.updateMany(
            { _id: { $in: [...inputMovements, ...outputMovements] } },
            { productionBatch: createdBatch._id },
            { session }
        );

        // Commit
        await session.commitTransaction();

        // Retornar batch populado
        return await ProductionBatch.findById(createdBatch._id)
            .populate('inputs.ingredient', 'name itemType productionState averageCost')
            .populate('outputs.ingredient', 'name itemType productionState isByproduct averageCost')
            .populate('user', 'name email')
            .populate('location', 'name type store')
            .populate('outputs.destinationLocation', 'name type store');

    } catch (error) {
        try {
            await session.abortTransaction();
        } catch (abortErr) {
            // Ignore abort errors (e.g., if already committed)
        }
        throw error;
    } finally {
        session.endSession();
    }
};

/**
 * Cancela uma produção (apenas se não estiver completed).
 *
 * @param {string} batchId
 * @returns {Promise<object>}
 */
const cancelProductionBatch = async (batchId) => {
    const batch = await ProductionBatch.findById(batchId);
    if (!batch) {
        throw new Error('Production batch not found');
    }
    if (batch.status === 'completed') {
        throw new Error('Cannot cancel a completed production batch');
    }

    batch.cancel();
    await batch.save();

    return batch;
};

module.exports = {
    processProductionBatch,
    cancelProductionBatch,
    validateInputStock,
    allocateCosts
};
