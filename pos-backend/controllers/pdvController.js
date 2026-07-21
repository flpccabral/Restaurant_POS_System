const mongoose = require("mongoose");
const createHttpError = require("http-errors");
const CashSession = require("../models/cashSessionModel");
const Payment = require("../models/paymentModel");
const Order = require("../models/orderModel");
const Table = require("../models/tableModel");
const SessionLog = require("../models/sessionLogModel");
const orderCheckoutService = require("../services/orderCheckoutService");
const stockReversalService = require("../services/stockReversalService");
const ws = require("../services/websocketService");

/**
 * Abrir sessão de caixa
 */
const openCashSession = async (req, res, next) => {
    try {
        const { initialBalance, openingBalance, deviceId, observations } = req.body;
        const balance = initialBalance || openingBalance || 0;

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
            initialBalance: balance,
            observations: { opening: observations }
        });

        // FLUXO_CAIXA: Registrar transação de abertura
        await session.registerTransaction({
            type: 'opening',
            value: balance,
            paymentMethod: 'cash',
            description: 'Fundo de troco inicial',
            operatorId: req.user._id
        });

        // Populareferências antes de retornar
        await session.populate('cashier', 'name email');

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
        const { amount, description, reason } = req.body;

        if (!amount || amount <= 0) {
            const error = createHttpError(400, "Valid amount is required!");
            return next(error);
        }

        // FLUXO_CAIXA: Justificativa obrigatória para sangria
        if (!reason && !description) {
            const error = createHttpError(400, "Justificativa é obrigatória para sangria!");
            return next(error);
        }

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const session = await CashSession.getActiveSession(storeRef, req.user._id);

        if (!session) {
            const error = createHttpError(404, "No active cash session found!");
            return next(error);
        }

        // FLUXO_CAIXA: Usar registerTransaction() com validação de saldo disponível
        await session.registerTransaction({
            type: 'sangria',
            value: amount,
            paymentMethod: 'cash',
            description: description || reason,
            reason: reason || description,
            operatorId: req.user._id
        });

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'sangria',
            metadata: {
                sessionId: session.sessionId,
                amount,
                reason: reason || description
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
        const { amount, description, reason } = req.body;

        if (!amount || amount <= 0) {
            const error = createHttpError(400, "Valid amount is required!");
            return next(error);
        }

        // FLUXO_CAIXA: Justificativa obrigatória para suprimento
        if (!reason && !description) {
            const error = createHttpError(400, "Justificativa é obrigatória para suprimento!");
            return next(error);
        }

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const session = await CashSession.getActiveSession(storeRef, req.user._id);

        if (!session) {
            const error = createHttpError(404, "No active cash session found!");
            return next(error);
        }

        // FLUXO_CAIXA: Usar registerTransaction()
        await session.registerTransaction({
            type: 'supply',
            value: amount,
            paymentMethod: 'cash',
            description: description || reason,
            reason: reason || description,
            operatorId: req.user._id
        });

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'suprimento',
            metadata: {
                sessionId: session.sessionId,
                amount,
                reason: reason || description
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
 * Processar pagamento com baixa automática transacional de estoque (Fase 5)
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
        if (!req.user.isMasterAdmin && order.store.toString() !== storeRef.toString()) {
            const error = createHttpError(403, "Access denied!");
            return next(error);
        }

        // Se pedido já está finalizado E pago, evitar duplicação
        // Mas permitir pagamento de pedidos completed que estão unpaid
        if (order.orderStatus === 'completed' && order.paymentStatus === 'paid') {
            const error = createHttpError(400, "Order is already completed and paid!");
            return next(error);
        }

        // Iniciar transação MongoDB para baixa de estoque
        const session = await mongoose.startSession();
        session.startTransaction();

        let stockDeductionResult = null;
        let stockDeductionError = null;

        try {
            // Processar baixa automática de estoque (Fase 5)
            stockDeductionResult = await orderCheckoutService.processOrderStockDeduction({
                storeId: storeRef,
                orderId: orderId,
                orderItems: order.items,
                userId: req.user._id,
                session
            });

            // Atualizar itens do pedido com CMV e dados da receita
            for (const itemResult of stockDeductionResult.items) {
                const item = order.items.id(itemResult.itemId);
                if (item) {
                    if (itemResult.recipeId) {
                        item.recipe = itemResult.recipeId;
                        item.recipeVersion = itemResult.recipeVersion;
                    }
                    item.cogs = itemResult.cogs;
                    item.ingredientCosts = itemResult.ingredientCosts;
                    item.stockDeductionStatus = itemResult.stockDeductionStatus;
                    if (itemResult.movements && itemResult.movements.length > 0) {
                        item.stockMovements = itemResult.movements;
                    }
                }
            }

            // Atualizar CMV total e status de baixa do pedido
            order.totalCOGS = stockDeductionResult.totalCOGS;

            if (stockDeductionResult.errors.length === 0) {
                order.stockDeductionStatus = 'completed';
            } else if (stockDeductionResult.items.some(i => i.stockDeductionStatus === 'deducted')) {
                order.stockDeductionStatus = 'partial';
            } else if (stockDeductionResult.items.every(i => i.stockDeductionStatus === 'no_recipe')) {
                order.stockDeductionStatus = 'no_recipes';
            } else {
                order.stockDeductionStatus = 'failed';
            }

            await order.save({ session });

            // Commit da transação
            await session.commitTransaction();
        } catch (deductionError) {
            // Rollback da transação
            await session.abortTransaction();
            stockDeductionError = deductionError.message || 'Stock deduction failed';
        } finally {
            session.endSession();
        }

        // Se houve erro crítico de estoque, retornar erro ao checkout
        if (stockDeductionError && stockDeductionResult && stockDeductionResult.items.some(i => i.stockDeductionStatus === 'insufficient_stock' || i.stockDeductionStatus === 'error')) {
            const error = createHttpError(400, `Stock deduction failed: ${stockDeductionError}`);
            return next(error);
        }

        // Criar pagamento (fora da transação de estoque — pagamento deve persistir mesmo se algo falhar)
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
        const session_cash = await CashSession.getActiveSession(storeRef, req.user._id);
        if (session_cash) {
            await session_cash.addPayment({
                paymentId: payment._id,
                orderNumber: payment.orderNumber,
                amount: payment.amount,
                method: payment.method
            });
        }

        // Atualizar pedido
        order.orderStatus = 'completed';
        order.paymentMethod = method;
        // Fase 9.3C: Payment also updates paymentStatus and closeStatus
        order.paymentStatus = 'paid';
        order.closeStatus = 'closed';
        await order.save();

        // Fase 9.3C: Release table when payment is processed (dine-in orders)
        if (order.table) {
            try {
                await Table.findOneAndUpdate(
                    { _id: order.table, store: storeRef },
                    { status: "Available", $unset: { currentOrder: "" } }
                );
                // Emit WebSocket event for table release
                const io_table = req.app.get('io');
                if (io_table) {
                    io_table.to(`store:${storeRef}`).emit('table:released', {
                        tableId: order.table.toString(),
                        orderId: order._id.toString(),
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (tableErr) {
                console.error(`[pdvController] Failed to release table ${order.table}: ${tableErr.message}`);
            }
        }

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'payment_processed',
            metadata: {
                paymentId: payment.paymentId,
                orderId,
                amount,
                method,
                totalCOGS: order.totalCOGS,
                stockDeductionStatus: order.stockDeductionStatus,
                stockDeductionError
            }
        });

        // Emit WebSocket event
        const io = req.app.get('io');
        ws.emitOrderStatusChanged(io, storeRef, order, order.orderStatus);

        // Se houve emissão de estoque, emitir evento de inventário
        if (stockDeductionResult && stockDeductionResult.items.length > 0) {
            for (const itemResult of stockDeductionResult.items) {
                if (itemResult.ingredientCosts && itemResult.ingredientCosts.length > 0) {
                    ws.emitInventoryUpdated(io, storeRef, {
                        type: 'sale_deduction',
                        orderId,
                        items: itemResult.ingredientCosts.map(ic => ({
                            ingredientId: ic.ingredient,
                            ingredientName: ic.ingredientName,
                            quantityDeducted: ic.quantity,
                            unit: ic.unit,
                            balanceAfter: ic.balanceAfter,
                            cost: ic.cost
                        }))
                    });
                }
            }
        }

        const responseData = {
            ...payment.toObject(),
            stockDeduction: stockDeductionResult ? {
                totalCOGS: stockDeductionResult.totalCOGS,
                status: order.stockDeductionStatus,
                itemsProcessed: stockDeductionResult.items.length,
                errors: stockDeductionResult.errors
            } : null
        };

        res.status(200).json({
            success: true,
            message: "Payment processed successfully!",
            data: responseData
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

        // Reverter estoque se o pagamento tinha baixa automática
        let stockReversalResult = null;
        if (payment.order) {
            const order = await Order.findById(payment.order);
            if (order && (order.stockDeductionStatus === 'completed' || order.stockDeductionStatus === 'partial') && order.stockReversalStatus !== 'reversed') {
                try {
                    stockReversalResult = await stockReversalService.reverseOrderStockDeduction({
                        orderId: order._id.toString(),
                        reason: `Estorno de pagamento: ${reason || 'sem motivo'}`,
                        userId: req.user._id
                    });

                    // Atualizar status do pedido
                    order.orderStatus = 'cancelled';
                    await order.save();
                } catch (reversalErr) {
                    // Log o erro mas não falha o refund financeiro
                    console.error(`Stock reversal failed for order ${order._id}: ${reversalErr.message}`);
                }
            }
        }

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'payment_refunded',
            metadata: {
                paymentId: payment.paymentId,
                reason,
                amount,
                stockReversed: stockReversalResult !== null,
                stockReversalMovements: stockReversalResult?.originalMovementCount || 0
            }
        });

        res.status(200).json({
            success: true,
            message: "Payment refunded successfully!",
            data: {
                ...payment.toObject(),
                stockReversal: stockReversalResult ? {
                    reversed: true,
                    movementsReversed: stockReversalResult.originalMovementCount,
                    reason: stockReversalResult.reversalReason
                } : null
            }
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
        const { finalBalance, observations, differenceReason, confirmedBy } = req.body;

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

        // Calcular diferença antecipadamente para aplicar hierarquia
        const expectedBalance = session.expectedBalance;
        const difference = finalBalance - expectedBalance;
        const absDifference = Math.abs(difference);

        // FLUXO_CAIXA: Hierarquia de tratamento de diferenças
        if (absDifference > 50 && !confirmedBy) {
            const error = createHttpError(400, `Diferença de R$ ${absDifference.toFixed(2)} requer aprovação de supervisor. Envie confirmedBy com o ID do supervisor.`);
            return next(error);
        }

        if (absDifference > 50 && !differenceReason) {
            const error = createHttpError(400, "Diferença acima de R$ 50,00 requer justificativa (differenceReason).");
            return next(error);
        }

        if (absDifference >= 5 && absDifference <= 50 && !differenceReason) {
            const error = createHttpError(400, "Diferença entre R$ 5,00 e R$ 50,00 requer justificativa (differenceReason).");
            return next(error);
        }

        // Fechar sessão
        await session.close({
            finalBalance,
            observations,
            userId: req.user._id,
            confirmedBy: confirmedBy || null,
            differenceReason: differenceReason || null
        });

        // FLUXO_CAIXA: Se diferença > R$ 200, criar alerta operacional
        if (absDifference > 200) {
            const OperationalAlert = require("../models/operationalAlertModel");
            await OperationalAlert.create({
                store: storeRef,
                type: 'cash_difference',
                severity: absDifference > 500 ? 'critical' : 'high',
                message: `Caixa ${session.sessionNumber} fechado com diferença de R$ ${difference.toFixed(2)} (${difference > 0 ? 'sobrou' : 'faltou'}). Operador: ${req.user.name || req.user.email}. Justificativa: ${differenceReason || 'Não informada'}`,
                metadata: {
                    sessionId: session._id,
                    sessionNumber: session.sessionNumber,
                    expectedBalance,
                    finalBalance,
                    difference,
                    operatorId: req.user._id,
                    confirmedBy
                }
            });
        }

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'cash_session_closed',
            metadata: {
                sessionId: session.sessionId,
                sessionNumber: session.sessionNumber,
                finalBalance,
                expectedBalance,
                difference,
                differenceReason,
                confirmedBy
            }
        });

        // Mensagem baseada na diferença
        let message = "Cash session closed successfully!";
        if (absDifference === 0) {
            message = "Caixa fechado com diferença zero! Perfeito!";
        } else if (absDifference < 5) {
            message = `Caixa fechado com pequena diferença de R$ ${absDifference.toFixed(2)}.`;
        } else if (absDifference <= 50) {
            message = `Caixa fechado com diferença de R$ ${absDifference.toFixed(2)}. Justificativa registrada.`;
        } else if (absDifference <= 200) {
            message = `Caixa fechado com diferença de R$ ${absDifference.toFixed(2)}. Aprovado por supervisor.`;
        } else {
            message = `Caixa fechado com diferença significativa de R$ ${absDifference.toFixed(2)}. Alerta criado no console operacional.`;
        }

        res.status(200).json({
            success: true,
            message,
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
            store: new mongoose.Types.ObjectId(storeRef),
            orderStatus: { $in: ['pending', 'preparing'] }
        });

        // Pedidos do dia
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayOrders = await Order.countDocuments({
            store: new mongoose.Types.ObjectId(storeRef),
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
