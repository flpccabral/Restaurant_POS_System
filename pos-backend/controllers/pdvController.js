const mongoose = require("mongoose");
const createHttpError = require("http-errors");
const CashSession = require("../models/cashSessionModel");
const Payment = require("../models/paymentModel");
const Order = require("../models/orderModel");
const SessionLog = require("../models/sessionLogModel");
const ws = require("../services/websocketService");

/**
 * Abrir sessão de caixa
 */
const openCashSession = async (req, res, next) => {
    try {
        const { initialBalance, deviceId, observations } = req.body;

        // Determinar loja
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        // Verificar se já tem sessão aberta
        const existingSession = await CashSession.getActiveSession(storeRef, req.user._id);

        if (existingSession) {
            const error = createHttpError(400, "You already have an open cash session!");
            return next(error);
        }

        // Gerar número da sessão
        const sessionNumber = await CashSession.generateSessionNumber();

        // Criar sessão
        const session = await CashSession.create({
            sessionNumber,
            store: storeRef,
            cashier: req.user._id,
            device: deviceId || null,
            status: 'open',
            initialBalance: initialBalance || 0,
            observations: { opening: observations }
        });

        // Abrir sessão com fundo de troco
        await session.open(initialBalance || 0);

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            device: deviceId,
            action: 'cash_session_opened',
            metadata: {
                sessionId: session.sessionId,
                sessionNumber: session.sessionNumber,
                initialBalance
            }
        });

        res.status(201).json({
            success: true,
            message: "Cash session opened successfully!",
            data: session.getSummary()
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter sessão ativa do caixa
 */
const getActiveSession = async (req, res, next) => {
    try {
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const session = await CashSession.getActiveSession(storeRef, req.user._id);

        if (!session) {
            return res.status(200).json({
                success: true,
                data: null,
                message: "No active session found"
            });
        }

        res.status(200).json({
            success: true,
            data: session.getSummary()
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Realizar sangria (retirada de dinheiro)
 */
const performSangria = async (req, res, next) => {
    try {
        const { amount, description } = req.body;

        if (!amount || amount <= 0) {
            const error = createHttpError(400, "Valid amount is required!");
            return next(error);
        }

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const session = await CashSession.getActiveSession(storeRef, req.user._id);

        if (!session) {
            const error = createHttpError(404, "No active cash session found!");
            return next(error);
        }

        await session.sangria(amount, description, req.user._id);

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'sangria',
            metadata: {
                sessionId: session.sessionId,
                amount
            }
        });

        res.status(200).json({
            success: true,
            message: "Sangria registered successfully!",
            data: session.getSummary()
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Realizar suprimento (entrada de dinheiro)
 */
const performSuprimento = async (req, res, next) => {
    try {
        const { amount, description } = req.body;

        if (!amount || amount <= 0) {
            const error = createHttpError(400, "Valid amount is required!");
            return next(error);
        }

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const session = await CashSession.getActiveSession(storeRef, req.user._id);

        if (!session) {
            const error = createHttpError(404, "No active cash session found!");
            return next(error);
        }

        await session.suprimento(amount, description, req.user._id);

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'suprimento',
            metadata: {
                sessionId: session.sessionId,
                amount
            }
        });

        res.status(200).json({
            success: true,
            message: "Suprimento registered successfully!",
            data: session.getSummary()
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Processar pagamento
 */
const processPayment = async (req, res, next) => {
    try {
        const { orderId, method, amount, paidAmount, installments, cardInfo } = req.body;

        // Validações
        if (!orderId || !method || !amount) {
            const error = createHttpError(400, "Order ID, method and amount are required!");
            return next(error);
        }

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        // Verificar pedido
        const order = await Order.findById(orderId);

        if (!order) {
            const error = createHttpError(404, "Order not found!");
            return next(error);
        }

        // Verificar permissão
        if (!req.user.isMasterAdmin && order.storeId.toString() !== storeRef.toString()) {
            const error = createHttpError(403, "Access denied!");
            return next(error);
        }

        // Criar pagamento
        const payment = await Payment.create({
            store: storeRef,
            order: orderId,
            orderNumber: order.orderNumber || `ORD-${Date.now()}`,
            amount,
            method,
            paidAmount: paidAmount || amount,
            installments: method === 'credit_card' ? (installments || 1) : 1,
            cardInfo: method.includes('card') ? cardInfo : null,
            user: req.user._id,
            cashier: req.user._id,
            status: 'approved' // Aprovar automaticamente para dinheiro/pix
        });

        // Atualizar sessão de caixa se existir
        const session = await CashSession.getActiveSession(storeRef, req.user._id);
        if (session) {
            await session.addPayment({
                paymentId: payment._id,
                orderNumber: payment.orderNumber,
                amount: payment.amount,
                method: payment.method
            });
        }

        // Atualizar pedido
        order.orderStatus = 'paid';
        order.paymentMethod = method;
        await order.save();

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'payment_processed',
            metadata: {
                paymentId: payment.paymentId,
                orderId,
                amount,
                method
            }
        });

        // Emit WebSocket event
        const io = req.app.get('io');
        ws.emitOrderStatusChanged(io, storeRef, order, order.orderStatus);

        res.status(200).json({
            success: true,
            message: "Payment processed successfully!",
            data: payment
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Estornar pagamento
 */
const refundPayment = async (req, res, next) => {
    try {
        const { paymentId } = req.params;
        const { reason, amount } = req.body;

        const payment = await Payment.findById(paymentId);

        if (!payment) {
            const error = createHttpError(404, "Payment not found!");
            return next(error);
        }

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        // Verificar permissão
        if (!req.user.isMasterAdmin && payment.store.toString() !== storeRef.toString()) {
            const error = createHttpError(403, "Access denied!");
            return next(error);
        }

        if (payment.status !== 'approved') {
            const error = createHttpError(400, "Cannot refund non-approved payment!");
            return next(error);
        }

        await payment.refund(amount, reason);

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'payment_refunded',
            metadata: {
                paymentId: payment.paymentId,
                reason,
                amount
            }
        });

        res.status(200).json({
            success: true,
            message: "Payment refunded successfully!",
            data: payment
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Fechar sessão de caixa
 */
const closeCashSession = async (req, res, next) => {
    try {
        const { finalBalance, observations } = req.body;

        if (finalBalance === undefined) {
            const error = createHttpError(400, "Final balance is required!");
            return next(error);
        }

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const session = await CashSession.getActiveSession(storeRef, req.user._id);

        if (!session) {
            const error = createHttpError(404, "No active cash session found!");
            return next(error);
        }

        await session.close(finalBalance, observations, req.user._id);

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'cash_session_closed',
            metadata: {
                sessionId: session.sessionId,
                sessionNumber: session.sessionNumber,
                finalBalance,
                difference: session.difference
            }
        });

        res.status(200).json({
            success: true,
            message: "Cash session closed successfully!",
            data: session.getSummary()
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter histórico de sessões
 */
const getSessionHistory = async (req, res, next) => {
    try {
        const { status, limit = 30, startDate, endDate } = req.query;
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const filter = { store: new mongoose.Types.ObjectId(storeRef) };

        if (status) {
            filter.status = status;
        }

        if (startDate || endDate) {
            filter.openedAt = {};
            if (startDate) filter.openedAt.$gte = new Date(startDate);
            if (endDate) filter.openedAt.$lte = new Date(endDate);
        }

        const sessions = await CashSession.find(filter)
            .populate('cashier', 'name email')
            .populate('closedBy', 'name')
            .sort({ openedAt: -1 })
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            count: sessions.length,
            data: sessions.map(s => s.getSummary())
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter extrato de pagamentos do dia
 */
const getDailyPaymentsReport = async (req, res, next) => {
    try {
        const { date = new Date().toISOString().split('T')[0] } = req.query;
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const start = new Date(date);
        start.setHours(0, 0, 0, 0);

        const end = new Date(date);
        end.setHours(23, 59, 59, 999);

        // Totais por método
        const totals = await Payment.getTotalsByMethod(storeRef, start, end);

        // Pagamentos do dia
        const payments = await Payment.find({
            store: new mongoose.Types.ObjectId(storeRef),
            createdAt: { $gte: start, $lte: end },
            status: 'approved'
        })
        .populate('order', 'orderNumber table')
        .populate('cashier', 'name')
        .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: {
                date,
                totals,
                payments,
                summary: {
                    totalRevenue: totals.total,
                    totalTransactions: totals.totalCount,
                    byMethod: totals
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter resumo do caixa (PDV)
 */
const getPDVSummary = async (req, res, next) => {
    try {
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const session = await CashSession.getActiveSession(storeRef, req.user._id);

        // Pedidos pendentes
        const pendingOrders = await Order.countDocuments({
            storeId: new mongoose.Types.ObjectId(storeRef),
            orderStatus: { $in: ['pending', 'preparing'] }
        });

        // Pedidos do dia
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayOrders = await Order.countDocuments({
            storeId: new mongoose.Types.ObjectId(storeRef),
            createdAt: { $gte: today }
        });

        // Pagamentos do dia
        const todayPayments = await Payment.getTotalsByMethod(storeRef, today, new Date());

        res.status(200).json({
            success: true,
            data: {
                session: session ? session.getSummary() : null,
                orders: {
                    pending: pendingOrders,
                    today: todayOrders
                },
                payments: {
                    today: todayPayments
                },
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    openCashSession,
    getActiveSession,
    performSangria,
    performSuprimento,
    processPayment,
    refundPayment,
    closeCashSession,
    getSessionHistory,
    getDailyPaymentsReport,
    getPDVSummary
};
