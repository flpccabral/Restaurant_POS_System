const mongoose = require("mongoose");
const createHttpError = require("http-errors");
const KDSConfig = require("../models/kdsConfigModel");
const KDSOrder = require("../models/kdsOrderModel");
const Order = require("../models/orderModel");
const ws = require("../services/websocketService");

/**
 * Obter configuração do KDS da loja
 */
const getKDSConfig = async (req, res, next) => {
    try {
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const config = await KDSConfig.getStoreConfig(storeRef);

        res.status(200).json({
            success: true,
            data: config
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Atualizar configuração do KDS
 */
const updateKDSConfig = async (req, res, next) => {
    try {
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;
        const { stations, displaySettings, slaSettings, defaultStation } = req.body;

        let config = await KDSConfig.findOne({ store: storeRef });

        if (!config) {
            config = new KDSConfig({ store: storeRef });
        }

        if (stations) config.stations = stations;
        if (displaySettings) config.displaySettings = displaySettings;
        if (slaSettings) config.slaSettings = slaSettings;
        if (defaultStation) config.defaultStation = defaultStation;

        await config.save();

        res.status(200).json({
            success: true,
            message: "KDS configuration updated!",
            data: config
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter pedidos da cozinha (KDS board)
 */
const getKitchenOrders = async (req, res, next) => {
    try {
        const { station = 'kitchen', status, tableId } = req.query;
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const orders = await KDSOrder.getKitchenOrders(storeRef, station, {
            status,
            tableId,
            limit: 100
        });

        // Calcular tempos para cada pedido
        const ordersWithTimers = orders.map(order => ({
            ...order.toObject(),
            elapsedMinutes: order.elapsedMinutes,
            minutesUntilReady: order.minutesUntilReady,
            isLate: order.isLate,
            isUrgent: order.isUrgent
        }));

        res.status(200).json({
            success: true,
            count: ordersWithTimers.length,
            data: ordersWithTimers
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter detalhes de um pedido KDS
 */
const getKDSOrderById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const order = await KDSOrder.findOne({ kdsOrderId: id })
            .populate('table', 'name number')
            .populate('order', 'orderStatus items');

        if (!order) {
            const error = createHttpError(404, "KDS order not found!");
            return next(error);
        }

        res.status(200).json({
            success: true,
            data: {
                ...order.toObject(),
                elapsedMinutes: order.elapsedMinutes,
                minutesUntilReady: order.minutesUntilReady,
                isLate: order.isLate
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Aceitar pedido para preparo
 */
const acceptKDSOrder = async (req, res, next) => {
    try {
        const { id } = req.params;

        const order = await KDSOrder.findOne({ kdsOrderId: id });

        if (!order) {
            const error = createHttpError(404, "KDS order not found!");
            return next(error);
        }

        if (order.status !== 'pending') {
            const error = createHttpError(400, `Order already ${order.status}!`);
            return next(error);
        }

        await order.accept(req.user._id);
        order.calculateEstimatedReady();
        await order.save();

        // Emit WebSocket event
        const io = req.app.get('io');
        ws.emitOrderStatusChanged(io, order.store, {
            _id: order.order,
            orderStatus: 'preparing'
        }, 'pending');

        res.status(200).json({
            success: true,
            message: "Order accepted!",
            data: order
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Atualizar status de um item
 */
const updateItemStatus = async (req, res, next) => {
    try {
        const { id, itemId } = req.params;
        const { status, station } = req.body;

        if (!['pending', 'preparing', 'ready', 'served', 'cancelled'].includes(status)) {
            const error = createHttpError(400, "Invalid status!");
            return next(error);
        }

        const order = await KDSOrder.findOne({ kdsOrderId: id });

        if (!order) {
            const error = createHttpError(404, "KDS order not found!");
            return next(error);
        }

        await order.updateItemStatus(itemId, status, station);

        // Se todos os itens de uma estação estão ready, marcar estação como ready
        const stationItems = order.items.filter(i => i.station === station);
        const allReady = stationItems.every(i => i.status === 'ready' || i.status === 'served');

        if (allReady && stationItems.length > 0) {
            const stationData = order.stations.find(s => s.station === station);
            if (stationData) {
                stationData.status = 'ready';
                stationData.completedAt = new Date();
                await order.save();
            }
        }

        // Emit WebSocket event
        const io = req.app.get('io');
        io.to(`store:${order.store}`).emit('kds:item-updated', {
            kdsOrderId: order.kdsOrderId,
            itemId,
            status,
            station,
            timestamp: new Date().toISOString()
        });

        res.status(200).json({
            success: true,
            message: `Item ${status}!`,
            data: order
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Marcar pedido como pronto
 */
const markOrderReady = async (req, res, next) => {
    try {
        const { id } = req.params;

        const order = await KDSOrder.findOne({ kdsOrderId: id });

        if (!order) {
            const error = createHttpError(404, "KDS order not found!");
            return next(error);
        }

        await order.markReady();

        // Emit WebSocket event
        const io = req.app.get('io');
        io.to(`store:${order.store}`).emit('kds:order-ready', {
            kdsOrderId: order.kdsOrderId,
            orderNumber: order.orderNumber,
            tableNumber: order.tableNumber,
            timestamp: new Date().toISOString()
        });

        res.status(200).json({
            success: true,
            message: "Order marked as ready!",
            data: order
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Marcar pedido como servido
 */
const markOrderServed = async (req, res, next) => {
    try {
        const { id } = req.params;

        const order = await KDSOrder.findOne({ kdsOrderId: id });

        if (!order) {
            const error = createHttpError(404, "KDS order not found!");
            return next(error);
        }

        await order.markServed();

        // Emit WebSocket event
        const io = req.app.get('io');
        io.to(`store:${order.store}`).emit('kds:order-served', {
            kdsOrderId: order.kdsOrderId,
            orderNumber: order.orderNumber,
            timestamp: new Date().toISOString()
        });

        res.status(200).json({
            success: true,
            message: "Order marked as served!",
            data: order
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Priorizar pedido (rush)
 */
const rushOrder = async (req, res, next) => {
    try {
        const { id } = req.params;

        const order = await KDSOrder.findOne({ kdsOrderId: id });

        if (!order) {
            const error = createHttpError(404, "KDS order not found!");
            return next(error);
        }

        await order.rush();

        // Emit WebSocket event
        const io = req.app.get('io');
        io.to(`store:${order.store}`).emit('kds:order-rushed', {
            kdsOrderId: order.kdsOrderId,
            orderNumber: order.orderNumber,
            priority: 'urgent',
            timestamp: new Date().toISOString()
        });

        res.status(200).json({
            success: true,
            message: "Order prioritized!",
            data: order
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter estatísticas da estação
 */
const getStationStats = async (req, res, next) => {
    try {
        const { station = 'kitchen' } = req.query;
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const stats = await KDSOrder.getStationStats(storeRef, station);

        // Calcular tempo médio de preparo
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayOrders = await KDSOrder.find({
            store: new mongoose.Types.ObjectId(storeRef),
            'items.station': station,
            createdAt: { $gte: today },
            status: 'served',
            'timers.readyAt': { $exists: true },
            'timers.acceptedAt': { $exists: true }
        });

        let totalPrepTime = 0;
        let count = 0;

        todayOrders.forEach(order => {
            if (order.timers.readyAt && order.timers.acceptedAt) {
                const prepTime = (order.timers.readyAt - order.timers.acceptedAt) / 60000;
                totalPrepTime += prepTime;
                count++;
            }
        });

        stats.avgPrepMinutes = count > 0 ? Math.round(totalPrepTime / count) : 0;
        stats.totalOrders = todayOrders.length;

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Sincronizar pedido do Order para KDS
 */
const syncOrderToKDS = async (req, res, next) => {
    try {
        const { orderId } = req.body;

        const order = await Order.findById(orderId)
            .populate('table', 'name number');

        if (!order) {
            const error = createHttpError(404, "Order not found!");
            return next(error);
        }

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        // Verificar se já existe KDS order
        let kdsOrder = await KDSOrder.findOne({ order: orderId });

        if (kdsOrder) {
            // Atualizar existente
            kdsOrder.orderType = order.orderType || 'dine-in';
            kdsOrder.table = order.table?._id;
            kdsOrder.tableNumber = order.table?.number;
            kdsOrder.customerName = order.customerDetails?.name;
            await kdsOrder.save();
        } else {
            // Criar novo
            const config = await KDSConfig.getStoreConfig(storeRef);

            const items = order.items.map(item => ({
                orderItem: item._id,
                productId: item.product,
                productName: item.name,
                quantity: item.quantity,
                station: config.defaultStation,
                prepTimeMinutes: config.slaSettings?.defaultPrepTime || 15,
                notes: item.notes,
                modifiers: item.modifiers || []
            }));

            kdsOrder = await KDSOrder.create({
                store: storeRef,
                order: orderId,
                orderNumber: order.orderNumber || `ORD-${Date.now()}`,
                table: order.table?._id,
                tableNumber: order.table?.number,
                customerName: order.customerDetails?.name,
                orderType: order.orderType || 'dine-in',
                items,
                estimatedReady: new Date(Date.now() + (config.slaSettings?.defaultPrepTime || 15) * 60000)
            });
        }

        // Emit WebSocket event
        const io = req.app.get('io');
        io.to(`store:${storeRef}`).emit('kds:order-synced', {
            kdsOrderId: kdsOrder.kdsOrderId,
            orderNumber: kdsOrder.orderNumber,
            tableNumber: kdsOrder.tableNumber,
            itemsCount: kdsOrder.items.length,
            timestamp: new Date().toISOString()
        });

        res.status(200).json({
            success: true,
            message: "Order synced to KDS!",
            data: kdsOrder
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Cancelar pedido KDS
 */
const cancelKDSOrder = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const order = await KDSOrder.findOne({ kdsOrderId: id });

        if (!order) {
            const error = createHttpError(404, "KDS order not found!");
            return next(error);
        }

        if (order.status === 'served') {
            const error = createHttpError(400, "Cannot cancel served order!");
            return next(error);
        }

        order.status = 'cancelled';
        order.items.forEach(item => {
            if (item.status !== 'served') {
                item.status = 'cancelled';
            }
        });

        await order.save();

        // Emit WebSocket event
        const io = req.app.get('io');
        io.to(`store:${order.store}`).emit('kds:order-cancelled', {
            kdsOrderId: order.kdsOrderId,
            orderNumber: order.orderNumber,
            reason,
            timestamp: new Date().toISOString()
        });

        res.status(200).json({
            success: true,
            message: "Order cancelled!",
            data: order
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getKDSConfig,
    updateKDSConfig,
    getKitchenOrders,
    getKDSOrderById,
    acceptKDSOrder,
    updateItemStatus,
    markOrderReady,
    markOrderServed,
    rushOrder,
    getStationStats,
    syncOrderToKDS,
    cancelKDSOrder
};
