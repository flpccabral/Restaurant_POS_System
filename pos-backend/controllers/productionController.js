const mongoose = require("mongoose");
const createHttpError = require("http-errors");
const productionService = require("../services/productionService");
const ProductionBatch = require("../models/productionBatchModel");
const SessionLog = require("../models/sessionLogModel");

/**
 * Criar e processar produção interna
 * POST /api/production
 */
const createProduction = async (req, res, next) => {
    try {
        const { locationId, inputs, outputs, observations, productionRecipeId } = req.body;

        // Validações
        if (!locationId) {
            const error = createHttpError(400, "locationId is required!");
            return next(error);
        }
        if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
            const error = createHttpError(400, "At least one input is required!");
            return next(error);
        }
        if (!outputs || !Array.isArray(outputs) || outputs.length === 0) {
            const error = createHttpError(400, "At least one output is required!");
            return next(error);
        }

        // Determinar loja
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        // Processar produção
        const batch = await productionService.processProductionBatch({
            storeId: storeRef,
            locationId,
            inputs,
            outputs,
            userId: req.user._id,
            observations,
            productionRecipeId
        });

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'production_completed',
            metadata: {
                batchId: batch.batchId,
                inputs: batch.inputs.length,
                outputs: batch.outputs.length,
                totalInputCost: batch.totalInputCost,
                yieldPercentage: batch.yieldPercentage
            }
        });

        res.status(201).json({
            success: true,
            message: "Production batch completed successfully!",
            data: batch
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listar produções por loja
 * GET /api/production
 */
const listProductions = async (req, res, next) => {
    try {
        const { status, limit = 30, startDate, endDate } = req.query;
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const filter = { store: new mongoose.Types.ObjectId(storeRef) };

        if (status) {
            filter.status = status;
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const batches = await ProductionBatch.find(filter)
            .populate('inputs.ingredient', 'name itemType productionState')
            .populate('outputs.ingredient', 'name itemType productionState isByproduct')
            .populate('user', 'name email')
            .populate('location', 'name type')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            count: batches.length,
            data: batches
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Buscar produção por ID
 * GET /api/production/:id
 */
const getProductionById = async (req, res, next) => {
    try {
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const batch = await ProductionBatch.findOne({
            _id: req.params.id,
            store: new mongoose.Types.ObjectId(storeRef)
        })
        .populate('inputs.ingredient', 'name itemType productionState averageCost')
        .populate('outputs.ingredient', 'name itemType productionState isByproduct compatibleOperations')
        .populate('outputs.destinationLocation', 'name type store')
        .populate('user', 'name email')
        .populate('location', 'name type store');

        if (!batch) {
            const error = createHttpError(404, "Production batch not found!");
            return next(error);
        }

        res.status(200).json({
            success: true,
            data: batch
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Cancelar produção
 * PUT /api/production/:id/cancel
 */
const cancelProduction = async (req, res, next) => {
    try {
        const batch = await productionService.cancelProductionBatch(req.params.id);

        await SessionLog.create({
            user: req.user._id,
            store: batch.store,
            action: 'production_cancelled',
            metadata: {
                batchId: batch.batchId,
                reason: req.body.reason
            }
        });

        res.status(200).json({
            success: true,
            message: "Production batch cancelled!",
            data: batch
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listar subprodutos disponíveis/transferíveis
 * GET /api/production/byproducts/available
 */
const getAvailableByproducts = async (req, res, next) => {
    try {
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const batches = await ProductionBatch.getAvailableByproducts(storeRef);

        // Extrair subprodutos únicos
        const byproducts = [];
        const seen = new Set();

        for (const batch of batches) {
            for (const output of batch.outputs) {
                if (output.outputType === 'byproduct' || output.outputType === 'transferable_surplus') {
                    const key = `${output.ingredient?._id}-${batch.location?._id}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        byproducts.push({
                            ingredient: output.ingredient,
                            batchId: batch._id,
                            batchBatchId: batch.batchId,
                            quantity: output.quantity,
                            unit: output.unit,
                            outputType: output.outputType,
                            location: batch.location,
                            createdAt: batch.createdAt
                        });
                    }
                }
            }
        }

        res.status(200).json({
            success: true,
            count: byproducts.length,
            data: byproducts
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createProduction,
    listProductions,
    getProductionById,
    cancelProduction,
    getAvailableByproducts
};
