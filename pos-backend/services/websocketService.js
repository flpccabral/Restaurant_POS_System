/**
 * WebSocket Service - Gerenciamento de Eventos em Tempo Real
 *
 * Centraliza a emissão de eventos WebSocket para todo o sistema
 *
 * Uso nos controllers:
 *   const io = req.app.get('io');
 *   const ws = require('../services/websocketService');
 *   ws.emitOrderCreated(io, order);
 */

/**
 * Emite evento de pedido criado
 * @param {SocketIO.Server} io - Instância do Socket.io
 * @param {Object} order - Pedido criado
 */
const emitOrderCreated = (io, order) => {
    const eventData = {
        event: 'order:created',
        data: {
            orderId: order._id,
            storeId: order.store,
            tableId: order.table,
            orderNumber: order.orderNumber,
            items: order.items,
            total: order.total,
            status: order.status,
            createdAt: order.createdAt
        },
        timestamp: new Date().toISOString()
    };

    io.to(`store:${order.store}`).emit('order:created', eventData.data);
    console.log(`[WebSocket] order:created emitted for store ${order.store}`);
};

/**
 * Emite evento de pedido atualizado
 * @param {SocketIO.Server} io - Instância do Socket.io
 * @param {Object} order - Pedido atualizado
 */
const emitOrderUpdated = (io, order) => {
    const eventData = {
        event: 'order:updated',
        data: {
            orderId: order._id,
            storeId: order.store,
            updates: order
        },
        timestamp: new Date().toISOString()
    };

    io.to(`store:${order.store}`).emit('order:updated', eventData.data);
    console.log(`[WebSocket] order:updated emitted for order ${order._id}`);
};

/**
 * Emite evento de mudança de status do pedido
 * @param {SocketIO.Server} io - Instância do Socket.io
 * @param {string} storeId - ID da loja
 * @param {Object} order - Pedido com status alterado
 * @param {string} oldStatus - Status anterior
 */
const emitOrderStatusChanged = (io, storeId, order, oldStatus) => {
    const eventData = {
        event: 'order:status-changed',
        data: {
            orderId: order._id,
            storeId: storeId,
            oldStatus: oldStatus,
            newStatus: order.status,
            timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
    };

    io.to(`store:${storeId}`).emit('order:status-changed', eventData.data);
    console.log(`[WebSocket] order:status-changed emitted: ${oldStatus} -> ${order.status}`);
};

/**
 * Emite evento de atualização de estoque
 * @param {SocketIO.Server} io - Instância do Socket.io
 * @param {string} storeId - ID da loja
 * @param {Object} data - Dados da atualização
 */
const emitInventoryUpdated = (io, storeId, data) => {
    const eventData = {
        event: 'inventory:updated',
        data: {
            storeId: storeId,
            type: data.type, // 'in', 'out', 'adjustment', 'recipe_deduction'
            ingredientId: data.ingredientId,
            ingredientName: data.ingredientName,
            quantity: data.quantity,
            balance: data.balance,
            unit: data.unit,
            timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
    };

    io.to(`store:${storeId}`).emit('inventory:updated', eventData.data);
    console.log(`[WebSocket] inventory:updated emitted for ingredient ${data.ingredientId}`);
};

/**
 * Emite evento de disponibilidade de produto
 * @param {SocketIO.Server} io - Instância do Socket.io
 * @param {string} storeId - ID da loja
 * @param {Object} data - Dados do produto
 */
const emitProductAvailability = (io, storeId, data) => {
    const eventData = {
        event: 'product:availability',
        data: {
            storeId: storeId,
            productId: data.productId,
            productName: data.productName,
            isActive: data.isActive,
            isCurrent: data.isCurrent,
            timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
    };

    io.to(`store:${storeId}`).emit('product:availability', eventData.data);
    console.log(`[WebSocket] product:availability emitted for product ${data.productId}`);
};

/**
 * Emite evento de alerta criado
 * @param {SocketIO.Server} io - Instância do Socket.io
 * @param {Object} alert - Alerta criado
 */
const emitAlertCreated = (io, alert) => {
    const eventData = {
        event: 'alert:created',
        data: {
            alertId: alert._id,
            storeId: alert.store,
            type: alert.type,
            severity: alert.severity,
            ingredientName: alert.ingredient?.name,
            currentBalance: alert.currentBalance,
            minimumStock: alert.minimumStock,
            timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
    };

    io.to(`store:${alert.store}`).emit('alert:created', eventData.data);
    console.log(`[WebSocket] alert:created emitted for store ${alert.store}`);
};

/**
 * Emite evento de receita produzida (baixa de estoque)
 * @param {SocketIO.Server} io - Instância do Socket.io
 * @param {string} storeId - ID da loja
 * @param {Object} data - Dados da produção
 */
const emitRecipeProduced = (io, storeId, data) => {
    const eventData = {
        event: 'recipe:produced',
        data: {
            storeId: storeId,
            recipeId: data.recipeId,
            recipeName: data.recipeName,
            sku: data.sku,
            quantityProduced: data.quantity,
            ingredients: data.ingredients,
            timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
    };

    io.to(`store:${storeId}`).emit('recipe:produced', eventData.data);
    console.log(`[WebSocket] recipe:produced emitted for recipe ${data.recipeId}`);
};

/**
 * Emite evento de dispositivo registrado
 * @param {SocketIO.Server} io - Instância do Socket.io
 * @param {Object} device - Dispositivo registrado
 */
const emitDeviceRegistered = (io, device) => {
    const eventData = {
        event: 'device:registered',
        data: {
            deviceId: device._id,
            storeId: device.store,
            userId: device.user,
            nickname: device.nickname,
            isApproved: device.isApproved,
            timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
    };

    io.to(`store:${device.store}`).emit('device:registered', eventData.data);
    console.log(`[WebSocket] device:registered emitted for device ${device._id}`);
};

/**
 * Emite evento de dispositivo aprovado
 * @param {SocketIO.Server} io - Instância do Socket.io
 * @param {Object} device - Dispositivo aprovado
 */
const emitDeviceApproved = (io, device) => {
    const eventData = {
        event: 'device:approved',
        data: {
            deviceId: device._id,
            storeId: device.store,
            userId: device.user,
            isApproved: true,
            timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
    };

    io.to(`store:${device.store}`).emit('device:approved', eventData.data);
    console.log(`[WebSocket] device:approved emitted for device ${device._id}`);
};

module.exports = {
    emitOrderCreated,
    emitOrderUpdated,
    emitOrderStatusChanged,
    emitInventoryUpdated,
    emitProductAvailability,
    emitAlertCreated,
    emitRecipeProduced,
    emitDeviceRegistered,
    emitDeviceApproved
};
