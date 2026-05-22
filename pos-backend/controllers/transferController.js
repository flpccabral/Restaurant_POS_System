const createHttpError = require("http-errors");
const transferService = require("../services/transferService");
const ws = require("../services/websocketService");
const StockLocation = require("../models/stockLocationModel");

/**
 * Criar transferência de estoque
 */
const createTransfer = async (req, res, next) => {
    try {
        const { originLocationId, destinationLocationId, ingredientId, quantity, unit, reason } = req.body;

        // Validação
        if (!originLocationId || !destinationLocationId || !ingredientId || !quantity) {
            const error = createHttpError(400, "Origin, destination, ingredient and quantity are required!");
            return next(error);
        }

        if (quantity <= 0) {
            const error = createHttpError(400, "Quantity must be a positive number!");
            return next(error);
        }

        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Executar transferência
        const result = await transferService.createTransfer({
            storeId: storeRef,
            originLocationId,
            destinationLocationId,
            ingredientId,
            quantity,
            unit,
            reason: reason || 'Transferência de estoque',
            userId: req.user._id
        });

        // Emit WebSocket events for both origin and destination
        const io = req.app.get('io');
        ws.emitInventoryUpdated(io, storeRef, {
            type: 'transfer_out',
            ingredientId,
            ingredientName: result.ingredient,
            quantity,
            balance: result.origin.balanceAfter,
            unit: result.unit,
            location: result.origin.locationName
        });
        ws.emitInventoryUpdated(io, storeRef, {
            type: 'transfer_in',
            ingredientId,
            ingredientName: result.ingredient,
            quantity,
            balance: result.destination.balanceAfter,
            unit: result.unit,
            location: result.destination.locationName
        });
        ws.emitTransferCompleted(io, storeRef, {
            ingredientId,
            ingredientName: result.ingredient,
            quantity,
            unit: result.unit,
            origin: result.origin.locationName,
            destination: result.destination.locationName
        });

        res.status(200).json({
            success: true,
            message: "Transfer completed successfully!",
            data: result
        });
    } catch (error) {
        if (error.message.includes('Insufficient stock') || error.message.includes('not found')) {
            return next(createHttpError(400, error.message));
        }
        next(error);
    }
};

/**
 * Validar transferência (sem executar)
 */
const validateTransfer = async (req, res, next) => {
    try {
        const { originLocationId, ingredientId, quantity } = req.query;

        if (!originLocationId || !ingredientId || !quantity) {
            const error = createHttpError(400, "Origin, ingredient and quantity are required!");
            return next(error);
        }

        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        const validation = await transferService.validateTransfer(
            storeRef,
            originLocationId,
            ingredientId,
            parseFloat(quantity)
        );

        res.status(200).json({
            success: true,
            data: validation
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Histórico de transferências
 */
const getTransferHistory = async (req, res, next) => {
    try {
        const { locationId, ingredientId, startDate, endDate, limit } = req.query;

        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        const history = await transferService.getTransferHistory(storeRef, {
            locationId,
            ingredientId,
            startDate,
            endDate,
            limit: parseInt(limit) || 50
        });

        res.status(200).json({
            success: true,
            count: history.length,
            data: history
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listar localizações disponíveis para transferência
 */
const getAvailableLocations = async (req, res, next) => {
    try {
        const { type } = req.query;

        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        const filter = {
            store: storeRef,
            isActive: true
        };

        if (type) {
            filter.type = type;
        }

        const locations = await StockLocation.find(filter)
            .sort({ type: 1, name: 1 });

        res.status(200).json({
            success: true,
            count: locations.length,
            data: locations
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createTransfer,
    validateTransfer,
    getTransferHistory,
    getAvailableLocations
};
