const mongoose = require("mongoose");
const createHttpError = require("http-errors");
const PurchaseOrder = require("../models/purchaseOrderModel");
const Supplier = require("../models/supplierModel");
const StockAlert = require("../models/stockAlertModel");
const SessionLog = require("../models/sessionLogModel");
const ws = require("../services/websocketService");

/**
 * Listar pedidos de compra
 */
const getPurchaseOrders = async (req, res, next) => {
    try {
        const { status, supplier, expectedDate } = req.query;
        const filter = {};

        // Aplicar store isolation
        if (!req.user.isMasterAdmin) {
            filter.store = req.user.store;
        } else if (req.storeId) {
            filter.store = req.storeId;
        }

        // Filtros opcionais
        if (status) {
            filter.status = status;
        }

        if (supplier) {
            filter.supplier = supplier;
        }

        if (expectedDate) {
            filter.expectedDate = {
                $gte: new Date(expectedDate)
            };
        }

        const orders = await PurchaseOrder.find(filter)
            .populate('supplier', 'name tradeName')
            .populate('items.ingredient', 'name category')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: orders.length,
            data: orders.map(order => ({
                ...order.toObject(),
                isLate: order.isLate,
                pendingQuantity: order.pendingQuantity
            }))
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter pedido de compra por ID
 */
const getPurchaseOrderById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const order = await PurchaseOrder.findById(id)
            .populate('supplier', 'name tradeName contact address')
            .populate('items.ingredient', 'name category unit')
            .populate('createdBy', 'name email')
            .populate('approvedBy', 'name')
            .populate('receivedBy', 'name');

        if (!order) {
            const error = createHttpError(404, "Purchase order not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && order.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Purchase order belongs to different store!");
            return next(error);
        }

        res.status(200).json({
            success: true,
            data: {
                ...order.toObject(),
                isLate: order.isLate,
                pendingQuantity: order.pendingQuantity
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Criar pedido de compra
 */
const createPurchaseOrder = async (req, res, next) => {
    try {
        const {
            supplier, items, expectedDate, paymentTerms,
            shipping, discount, notes, internalNotes, sourceAlert
        } = req.body;

        // Validações
        if (!supplier) {
            const error = createHttpError(400, "Supplier is required!");
            return next(error);
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            const error = createHttpError(400, "At least one item is required!");
            return next(error);
        }

        // Determinar loja (CREATE precisa de store, mesmo para master admin)
        const storeRef = req.user.isMasterAdmin
            ? (req.body.store || req.storeId || req.user.store)
            : req.user.store;

        if (!storeRef) {
            const error = createHttpError(400, "Store ID is required to create a purchase order. Pass storeId in query or store in body.");
            return next(error);
        }

        // Verificar fornecedor
        const supplierDoc = await Supplier.findOne({
            _id: supplier,
            store: storeRef
        });

        if (!supplierDoc) {
            const error = createHttpError(400, "Invalid supplier!");
            return next(error);
        }

        // Gerar número do pedido
        const orderNumber = `PO-${Date.now()}`;

        // Validar e preparar itens
        const validatedItems = [];
        for (const item of items) {
            if (!item.ingredientId || !item.quantity || item.quantity <= 0) {
                continue;
            }

            const ingredient = await mongoose.model('GlobalIngredient').findById(item.ingredientId);
            if (!ingredient) {
                continue;
            }

            validatedItems.push({
                ingredient: item.ingredientId,
                quantity: item.quantity,
                unit: item.unit || ingredient.baseUnit,
                unitPrice: item.unitPrice || 0,
                totalPrice: (item.quantity || 0) * (item.unitPrice || 0),
                notes: item.notes
            });
        }

        if (validatedItems.length === 0) {
            const error = createHttpError(400, "No valid items provided!");
            return next(error);
        }

        const order = await PurchaseOrder.create({
            orderNumber,
            store: storeRef,
            supplier,
            status: 'draft',
            items: validatedItems,
            expectedDate: expectedDate ? new Date(expectedDate) : null,
            paymentTerms,
            shipping: shipping || 0,
            discount: discount || 0,
            notes,
            internalNotes,
            createdBy: req.user._id,
            sourceAlert: sourceAlert || null
        });

        const populatedOrder = await PurchaseOrder.findById(order._id)
            .populate('supplier', 'name tradeName')
            .populate('items.ingredient', 'name category');

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'purchase_order_created',
            metadata: {
                orderNumber: order.orderNumber,
                supplier: supplierDoc.name
            }
        });

        res.status(201).json({
            success: true,
            message: "Purchase order created successfully!",
            data: populatedOrder
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Atualizar pedido de compra
 */
const updatePurchaseOrder = async (req, res, next) => {
    try {
        const { id } = req.params;

        const order = await PurchaseOrder.findById(id);

        if (!order) {
            const error = createHttpError(404, "Purchase order not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && order.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Purchase order belongs to different store!");
            return next(error);
        }

        // Só permite editar em draft ou pending
        if (!['draft', 'pending'].includes(order.status)) {
            const error = createHttpError(400, `Cannot edit order with status: ${order.status}`);
            return next(error);
        }

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        // Campos atualizáveis
        const updateableFields = [
            'items', 'expectedDate', 'paymentTerms', 'shipping',
            'discount', 'notes', 'internalNotes'
        ];

        for (const field of updateableFields) {
            if (req.body[field] !== undefined) {
                order[field] = req.body[field];
            }
        }

        await order.save();

        const populatedOrder = await PurchaseOrder.findById(order._id)
            .populate('supplier', 'name tradeName')
            .populate('items.ingredient', 'name category');

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'purchase_order_updated',
            metadata: {
                orderNumber: order.orderNumber
            }
        });

        res.status(200).json({
            success: true,
            message: "Purchase order updated successfully!",
            data: populatedOrder
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Enviar pedido de compra
 */
const sendPurchaseOrder = async (req, res, next) => {
    try {
        const { id } = req.params;

        const order = await PurchaseOrder.findById(id);

        if (!order) {
            const error = createHttpError(404, "Purchase order not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && order.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Purchase order belongs to different store!");
            return next(error);
        }

        await order.send();

        const populatedOrder = await PurchaseOrder.findById(order._id)
            .populate('supplier', 'name tradeName');

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'purchase_order_sent',
            metadata: {
                orderNumber: order.orderNumber,
                supplier: populatedOrder.supplier.name
            }
        });

        res.status(200).json({
            success: true,
            message: "Purchase order sent successfully!",
            data: populatedOrder
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Confirmar pedido de compra
 */
const confirmPurchaseOrder = async (req, res, next) => {
    try {
        const { id } = req.params;

        const order = await PurchaseOrder.findById(id);

        if (!order) {
            const error = createHttpError(404, "Purchase order not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && order.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Purchase order belongs to different store!");
            return next(error);
        }

        await order.confirm();

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'purchase_order_confirmed',
            metadata: {
                orderNumber: order.orderNumber
            }
        });

        res.status(200).json({
            success: true,
            message: "Purchase order confirmed successfully!",
            data: order
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Aprovar pedido de compra
 */
const approvePurchaseOrder = async (req, res, next) => {
    try {
        const { id } = req.params;

        const order = await PurchaseOrder.findById(id);

        if (!order) {
            const error = createHttpError(404, "Purchase order not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && order.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Purchase order belongs to different store!");
            return next(error);
        }

        order.approvedBy = req.user._id;
        order.approvedAt = new Date();

        if (order.status === 'draft') {
            order.status = 'pending';
        }

        await order.save();

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'purchase_order_approved',
            metadata: {
                orderNumber: order.orderNumber
            }
        });

        res.status(200).json({
            success: true,
            message: "Purchase order approved successfully!",
            data: order
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Receber itens do pedido
 */
const receivePurchaseOrder = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            const error = createHttpError(400, "Items array is required!");
            return next(error);
        }

        const order = await PurchaseOrder.findById(id);

        if (!order) {
            const error = createHttpError(404, "Purchase order not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && order.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Purchase order belongs to different store!");
            return next(error);
        }

        // Validar status
        if (!['sent', 'confirmed', 'partially_received'].includes(order.status)) {
            const error = createHttpError(400, `Cannot receive order with status: ${order.status}`);
            return next(error);
        }

        await order.receiveItems(items, req.user._id);

        const populatedOrder = await PurchaseOrder.findById(order._id)
            .populate('supplier', 'name tradeName')
            .populate('items.ingredient', 'name category');

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'purchase_order_received',
            metadata: {
                orderNumber: order.orderNumber,
                status: order.status
            }
        });

        // Emit WebSocket event para cada ingrediente recebido
        const io = req.app.get('io');
        for (const item of items) {
            const orderItem = order.items.find(i => i._id.toString() === item.itemId.toString());
            if (orderItem) {
                ws.emitInventoryUpdated(io, storeRef, {
                    type: 'stock_in',
                    ingredientId: orderItem.ingredient.toString(),
                    ingredientName: orderItem.ingredient?.name,
                    quantity: item.quantity,
                    balance: orderItem.receivedQuantity,
                    unit: orderItem.unit
                });
            }
        }

        res.status(200).json({
            success: true,
            message: `Items received successfully! Order status: ${order.status}`,
            data: populatedOrder
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Cancelar pedido de compra
 */
const cancelPurchaseOrder = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            const error = createHttpError(400, "Cancellation reason is required!");
            return next(error);
        }

        const order = await PurchaseOrder.findById(id);

        if (!order) {
            const error = createHttpError(404, "Purchase order not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && order.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Purchase order belongs to different store!");
            return next(error);
        }

        await order.cancel(reason);

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'purchase_order_cancelled',
            metadata: {
                orderNumber: order.orderNumber,
                reason
            }
        });

        res.status(200).json({
            success: true,
            message: "Purchase order cancelled successfully!",
            data: order
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Criar pedido a partir de alerta
 */
const createFromAlert = async (req, res, next) => {
    try {
        const { alertId } = req.params;

        const alert = await StockAlert.findById(alertId)
            .populate('ingredient');

        if (!alert) {
            const error = createHttpError(404, "Alert not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && alert.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied!");
            return next(error);
        }

        const order = await PurchaseOrder.createFromAlert(alertId, req.user._id);

        const populatedOrder = await PurchaseOrder.findById(order._id)
            .populate('supplier', 'name tradeName')
            .populate('items.ingredient', 'name category');

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'purchase_order_created_from_alert',
            metadata: {
                orderNumber: order.orderNumber,
                alertId
            }
        });

        res.status(201).json({
            success: true,
            message: "Purchase order created from alert successfully!",
            data: populatedOrder
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter estatísticas de pedidos de compra
 */
const getPurchaseOrderStats = async (req, res, next) => {
    try {
        const filter = {};

        // Aplicar store isolation
        if (!req.user.isMasterAdmin) {
            filter.store = req.user.store;
        } else if (req.storeId) {
            filter.store = req.storeId;
        }

        const total = await PurchaseOrder.countDocuments(filter);
        const draft = await PurchaseOrder.countDocuments({ ...filter, status: 'draft' });
        const pending = await PurchaseOrder.countDocuments({ ...filter, status: 'pending' });
        const sent = await PurchaseOrder.countDocuments({ ...filter, status: 'sent' });
        const received = await PurchaseOrder.countDocuments({ ...filter, status: 'received' });
        const cancelled = await PurchaseOrder.countDocuments({ ...filter, status: 'cancelled' });

        // Pedidos atrasados
        const late = await PurchaseOrder.countDocuments({
            ...filter,
            expectedDate: { $lt: new Date() },
            status: { $nin: ['received', 'cancelled'] }
        });

        // Valor total em pedidos recebidos
        const orders = await PurchaseOrder.find({
            ...filter,
            status: 'received'
        }).select('total');

        const totalSpent = orders.reduce((acc, order) => acc + order.total, 0);

        res.status(200).json({
            success: true,
            data: {
                total,
                draft,
                pending,
                sent,
                received,
                cancelled,
                late,
                totalSpent
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getPurchaseOrders,
    getPurchaseOrderById,
    createPurchaseOrder,
    updatePurchaseOrder,
    sendPurchaseOrder,
    confirmPurchaseOrder,
    approvePurchaseOrder,
    receivePurchaseOrder,
    cancelPurchaseOrder,
    createFromAlert,
    getPurchaseOrderStats
};
