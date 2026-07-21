const mongoose = require("mongoose");
const createHttpError = require("http-errors");
const PaymentSplit = require("../models/paymentSplitModel");
const Table = require("../models/tableModel");
const Order = require("../models/orderModel");
const Payment = require("../models/paymentModel");
const ws = require("../services/websocketService");

// Mapeamento de formas de pagamento (frontend pt-BR → backend enum)
const PAYMENT_METHOD_MAP = {
  'Dinheiro': 'cash',
  'Pix': 'pix',
  'Debito': 'debit_card',
  'Credito': 'credit_card',
  'Voucher': 'voucher'
};
const mapPaymentMethod = (method) => PAYMENT_METHOD_MAP[method] || method || 'cash';

/**
 * Calcular divisao de conta (preview)
 * POST /api/table/:tableId/split-calculate
 *
 * Body: {
 *   splitType: 'equal' | 'by_item',
 *   guestsCount: number,
 *   items?: [{ _id, name, price, quantity }],  // para by_item
 *   assignments?: { itemId: personName }        // para by_item
 * }
 */
const calculateSplit = async (req, res, next) => {
  try {
    const { tableId } = req.params;
    const storeRef = req.storeId || req.user.store;
    const { splitType, guestsCount, items, assignments } = req.body;

    if (!splitType || !guestsCount) {
      throw createHttpError(400, "splitType e guestsCount sao obrigatorios!");
    }
    if (guestsCount < 1 || guestsCount > 50) {
      throw createHttpError(400, "Numero de pessoas deve estar entre 1 e 50!");
    }

    // Validar mesa
    const table = await Table.findOne({ _id: tableId, store: storeRef });
    if (!table) {
      throw createHttpError(404, "Mesa nao encontrada!");
    }

    // Buscar pedidos abertos
    const openOrders = await Order.find({
      table: table._id,
      store: storeRef,
      closeStatus: { $ne: 'closed' },
      orderStatus: { $ne: 'cancelled' }
    });

    if (openOrders.length === 0) {
      throw createHttpError(400, "Nenhum pedido aberto na mesa!");
    }

    // Calcular total acumulado
    const totalAmount = openOrders.reduce((sum, o) => sum + (o.bills?.totalWithTax || 0), 0);

    let payments;

    if (splitType === 'equal') {
      // Divisao igual
      payments = PaymentSplit.calculateEqualSplit(totalAmount, guestsCount);
    } else if (splitType === 'by_item') {
      // Divisao por itens
      if (!items || !assignments) {
        throw createHttpError(400, "Para divisao por itens, envie 'items' e 'assignments'!");
      }

      // Validar que todos os itens foram atribuidos
      const assignedItemIds = new Set(Object.keys(assignments));
      const allItemIds = new Set(items.map(i => String(i._id)));
      const unassigned = [...allItemIds].filter(id => !assignedItemIds.has(id));
      if (unassigned.length > 0) {
        throw createHttpError(400, `${unassigned.length} item(ns) nao foram atribuidos a ninguem!`);
      }

      payments = PaymentSplit.calculateItemSplit(items, assignments);
    } else {
      throw createHttpError(400, "splitType deve ser 'equal' ou 'by_item'!");
    }

    // Validar que soma dos pagamentos == total (tolerancia de 1 centavo)
    const paymentsTotal = payments.reduce((sum, p) => sum + p.value, 0);
    if (Math.abs(paymentsTotal - totalAmount) > 0.01) {
      throw createHttpError(400, `Soma dos pagamentos (R$ ${paymentsTotal.toFixed(2)}) nao bate com o total da mesa (R$ ${totalAmount.toFixed(2)})!`);
    }

    res.status(200).json({
      success: true,
      data: {
        tableId: table._id,
        tableNumber: table.tableNo,
        totalAmount,
        guestsCount,
        splitType,
        ordersCount: openOrders.length,
        payments
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Criar split draft (confirma a divisao planejada)
 * POST /api/table/:tableId/split
 */
const createSplitBill = async (req, res, next) => {
  try {
    const { tableId } = req.params;
    const storeRef = req.storeId || req.user.store;
    const { splitType, guestsCount, payments, notes } = req.body;

    if (!splitType || !guestsCount || !payments || !Array.isArray(payments)) {
      throw createHttpError(400, "splitType, guestsCount e payments[] sao obrigatorios!");
    }
    if (payments.length > 5) {
      throw createHttpError(400, "Maximo de 5 pagamentos diferentes por fechamento!");
    }

    // Validar mesa
    const table = await Table.findOne({ _id: tableId, store: storeRef });
    if (!table) {
      throw createHttpError(404, "Mesa nao encontrada!");
    }

    // Buscar pedidos abertos
    const openOrders = await Order.find({
      table: table._id,
      store: storeRef,
      closeStatus: { $ne: 'closed' },
      orderStatus: { $ne: 'cancelled' }
    });

    if (openOrders.length === 0) {
      throw createHttpError(400, "Nenhum pedido aberto na mesa!");
    }

    const totalAmount = openOrders.reduce((sum, o) => sum + (o.bills?.totalWithTax || 0), 0);

    // Criar PaymentSplit
    const split = await PaymentSplit.create({
      store: storeRef,
      table: table._id,
      orders: openOrders.map(o => o._id),
      splitType,
      totalAmount,
      guestsCount,
      payments: payments.map(p => ({
        personName: p.personName,
        value: p.value,
        paymentMethod: p.paymentMethod || 'Dinheiro',
        items: p.items || [],
        status: 'pending'
      })),
      status: 'confirmed',
      notes: notes || '',
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: "Divisao de conta criada com sucesso!",
      data: split
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Processar pagamento individual de uma pessoa
 * POST /api/split/:splitId/payments/:paymentId
 */
const processSplitPayment = async (req, res, next) => {
  try {
    const { splitId, paymentId } = req.params;
    const storeRef = req.storeId || req.user.store;

    const split = await PaymentSplit.findOne({ _id: splitId, store: storeRef });
    if (!split) {
      throw createHttpError(404, "Divisao nao encontrada!");
    }

    const payment = split.payments.id(paymentId);
    if (!payment) {
      throw createHttpError(404, "Pagamento nao encontrado nesta divisao!");
    }

    if (payment.status === 'paid') {
      throw createHttpError(400, "Este pagamento ja foi processado!");
    }

    // Marcar como pago
    payment.status = 'paid';
    payment.paidAt = new Date();

    // Atualizar status da divisao
    const allPaid = split.payments.every(p => p.status === 'paid');
    const anyPaid = split.payments.some(p => p.status === 'paid');
    split.status = allPaid ? 'fully_paid' : (anyPaid ? 'partially_paid' : 'confirmed');

    await split.save();

    // Registrar pagamento no sistema de pagamentos
    // Pegar o primeiro pedido da mesa para associar o pagamento
    const order = await Order.findById(split.orders[0]);
    if (order) {
      await Payment.create({
        store: storeRef,
        order: order._id,
        orderNumber: order.orderNumber || `ORD-SPLIT-${Date.now()}`,
        amount: payment.value,
        method: mapPaymentMethod(payment.paymentMethod),
        paidAmount: payment.value,
        status: 'approved',
        user: req.user._id,
        cashier: req.user._id,
        metadata: {
          splitId: split._id,
          paymentId: payment._id,
          personName: payment.personName
        }
      });
    }

    // Emit WebSocket
    const io = req.app.get('io');
    io.to(`store:${storeRef}`).emit('split:payment-processed', {
      splitId: split._id,
      paymentId: payment._id,
      personName: payment.personName,
      value: payment.value,
      status: split.status,
      timestamp: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      message: `Pagamento de ${payment.personName} registrado!`,
      data: split
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fechar mesa apos divisao de conta
 * POST /api/split/:splitId/close
 */
const closeSplitBill = async (req, res, next) => {
  try {
    const { splitId } = req.params;
    const storeRef = req.storeId || req.user.store;

    const split = await PaymentSplit.findOne({ _id: splitId, store: storeRef })
      .populate('table');
    if (!split) {
      throw createHttpError(404, "Divisao nao encontrada!");
    }

    // Verificar se todos os pagamentos foram processados
    if (split.status !== 'fully_paid') {
      throw createHttpError(400, `Divisao nao esta totalmente paga! Status: ${split.status}. Processe todos os pagamentos antes de fechar.`);
    }

    // Fechar todos os pedidos da mesa
    const updatePromises = split.orders.map(orderId =>
      Order.findByIdAndUpdate(orderId, {
        paymentStatus: 'paid',
        closeStatus: 'closed',
        orderStatus: 'completed'
      })
    );
    await Promise.all(updatePromises);

    // Liberar mesa
    const table = split.table;
    if (table) {
      table.status = "Available";
      table.currentOrder = undefined;
      await table.save();
    }

    // Emit WebSocket
    const io = req.app.get('io');
    if (table) {
      io.to(`store:${storeRef}`).emit('table:released', {
        tableId: table._id,
        tableNumber: table.tableNo,
        timestamp: new Date().toISOString()
      });
    }

    res.status(200).json({
      success: true,
      message: `Mesa ${table?.tableNo || ''} fechada com sucesso!`,
      data: {
        splitId: split._id,
        tableNumber: table?.tableNo,
        totalAmount: split.totalAmount,
        paymentsCount: split.payments.length,
        payments: split.payments.map(p => ({
          personName: p.personName,
          value: p.value,
          paymentMethod: p.paymentMethod,
          paidAt: p.paidAt
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Listar splits ativos da loja
 * GET /api/split
 */
const getSplits = async (req, res, next) => {
  try {
    const storeRef = req.storeId || req.user.store;
    const { status } = req.query;

    const filter = { store: storeRef };
    if (status) filter.status = status;

    const splits = await PaymentSplit.find(filter)
      .populate('table', 'tableNo')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: splits.length,
      data: splits
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  calculateSplit,
  createSplitBill,
  processSplitPayment,
  closeSplitBill,
  getSplits
};
