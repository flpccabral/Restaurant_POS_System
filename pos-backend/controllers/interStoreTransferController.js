const createHttpError = require("http-errors");
const interStoreTransferService = require("../services/interStoreTransferService");
const ws = require("../services/websocketService");
const auditService = require("../services/auditService");

/**
 * Criar transferência inter-store
 */
const createInterStoreTransfer = async (req, res, next) => {
    try {
        const {
            originStoreId,
            destinationStoreId,
            originLocationId,
            destinationLocationId,
            ingredientId,
            quantity,
            unit,
            reason
        } = req.body;

        // Validações
        if (!originStoreId || !destinationStoreId || !originLocationId || !destinationLocationId || !ingredientId || !quantity) {
            const error = createHttpError(400, "Origin store, destination store, origin location, destination location, ingredient and quantity are required!");
            return next(error);
        }

        if (quantity <= 0) {
            const error = createHttpError(400, "Quantity must be a positive number!");
            return next(error);
        }

        // Executar transferência inter-store
        const result = await interStoreTransferService.createInterStoreTransfer({
            originStoreId,
            destinationStoreId,
            originLocationId,
            destinationLocationId,
            ingredientId,
            quantity,
            unit,
            reason: reason || 'Inter-store transfer',
            userId: req.user._id
        });

        // Emit WebSocket events for both stores
        const io = req.app.get('io');

        // Evento na loja de origem
        ws.emitInventoryUpdated(io, originStoreId, {
            type: 'inter_store_transfer_out',
            ingredientId,
            ingredientName: result.ingredient.name,
            quantity,
            balance: result.origin.balanceAfter,
            unit: result.unit,
            location: result.origin.locationName,
            destinationStore: result.destination.storeName
        });

        // Evento na loja de destino
        ws.emitInventoryUpdated(io, destinationStoreId, {
            type: 'inter_store_transfer_in',
            ingredientId,
            ingredientName: result.ingredient.name,
            quantity,
            balance: result.destination.balanceAfter,
            unit: result.unit,
            location: result.destination.locationName,
            originStore: result.origin.storeName
        });

        // Audit log
        auditService.logAction({
            actionType: 'inter_store_transfer_executed',
            user: req.user._id,
            store: destinationStoreId,
            ingredient: ingredientId,
            entityType: 'InterStoreTransfer',
            status: 'success',
            summary: `Inter-store transfer by ${req.user.name}: ${result.ingredient?.name || 'unknown'} (${quantity}${unit || ''}) from ${result.origin?.storeName || 'origin'} to ${result.destination?.storeName || 'dest'}`
        });

        res.status(200).json({
            success: true,
            message: "Inter-store transfer completed successfully!",
            data: result
        });
    } catch (error) {
        if (error.message.includes('Insufficient stock') || error.message.includes('not found') || error.message.includes('compatible') || error.message.includes('waste') || error.message.includes('different')) {
            return next(createHttpError(400, error.message));
        }
        next(error);
    }
};

/**
 * Validar transferência inter-store (sem executar)
 */
const validateInterStoreTransfer = async (req, res, next) => {
    try {
        const {
            originStoreId,
            destinationStoreId,
            originLocationId,
            destinationLocationId,
            ingredientId,
            quantity
        } = req.query;

        if (!originStoreId || !destinationStoreId || !originLocationId || !destinationLocationId || !ingredientId || !quantity) {
            const error = createHttpError(400, "Origin store, destination store, origin location, destination location, ingredient and quantity are required!");
            return next(error);
        }

        const validation = await interStoreTransferService.validateInterStoreTransfer({
            originStoreId,
            destinationStoreId,
            originLocationId,
            destinationLocationId,
            ingredientId,
            quantity: parseFloat(quantity)
        });

        res.status(200).json({
            success: true,
            data: validation
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listar stores disponíveis
 */
const listStores = async (req, res, next) => {
    try {
        const stores = await interStoreTransferService.listAvailableStores();

        res.status(200).json({
            success: true,
            count: stores.length,
            data: stores
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createInterStoreTransfer,
    validateInterStoreTransfer,
    listStores
};
