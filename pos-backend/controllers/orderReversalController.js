const createHttpError = require("http-errors");
const stockReversalService = require("../services/stockReversalService");
const Order = require("../models/orderModel");
const Table = require("../models/tableModel");
const SessionLog = require("../models/sessionLogModel");

/**
 * Reverter estoque de um pedido
 * POST /api/orders/:id/reverse-stock
 */
const reverseOrderStock = async (req, res, next) => {
    try {
        const { reason } = req.body;

        if (!reason) {
            const error = createHttpError(400, "Reversal reason is required!");
            return next(error);
        }

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        // Verificar pedido
        const order = await Order.findById(req.params.id);
        if (!order) {
            const error = createHttpError(404, "Order not found!");
            return next(error);
        }

        // Verificar permissão
        if (!req.user.isMasterAdmin && order.store.toString() !== storeRef.toString()) {
            const error = createHttpError(403, "Access denied!");
            return next(error);
        }

        // Reverter estoque
        const result = await stockReversalService.reverseOrderStockDeduction({
            orderId: req.params.id,
            reason,
            userId: req.user._id
        });

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'order_stock_reversed',
            metadata: {
                orderId: req.params.id,
                reason,
                movementsReversed: result.originalMovementCount
            }
        });

        res.status(200).json({
            success: true,
            message: "Order stock deduction reversed successfully!",
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Cancelar pedido operacionalmente (com reversão de estoque)
 * POST /api/orders/:id/cancel
 */
const cancelOrder = async (req, res, next) => {
    try {
        const { reason } = req.body;

        if (!reason) {
            const error = createHttpError(400, "Cancellation reason is required!");
            return next(error);
        }

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        // Verificar pedido
        const order = await Order.findById(req.params.id);
        if (!order) {
            const error = createHttpError(404, "Order not found!");
            return next(error);
        }

        // Verificar permissão
        if (!req.user.isMasterAdmin && order.store.toString() !== storeRef.toString()) {
            const error = createHttpError(403, "Access denied!");
            return next(error);
        }

        // Cancelar pedido (com reversão de estoque se aplicável)
        const result = await stockReversalService.cancelOrder({
            orderId: req.params.id,
            reason,
            userId: req.user._id
        });

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'order_cancelled',
            metadata: {
                orderId: req.params.id,
                reason,
                stockReversed: result.stockReversed
            }
        });

        // Emit WebSocket event
        const io = req.app.get('io');
        if (io) {
            io.to(`store:${storeRef}`).emit('order:cancelled', {
                orderId: req.params.id,
                reason,
                stockReversed: result.stockReversed
            });
        }

        // Release the table when order is cancelled
        if (order.table) {
            try {
                await Table.findOneAndUpdate(
                    { _id: order.table, store: storeRef },
                    { status: "Available", $unset: { currentOrder: "" } }
                );
                if (io) {
                    io.to(`store:${storeRef}`).emit('table:released', {
                        tableId: order.table.toString(),
                        orderId: req.params.id,
                        reason: 'cancelled',
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (tableErr) {
                console.error(`[orderReversal] Table release failed for table ${order.table}: ${tableErr.message}`);
            }
        }

        res.status(200).json({
            success: true,
            message: "Order cancelled successfully!",
            data: result
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    reverseOrderStock,
    cancelOrder
};
