const Table = require("../models/tableModel");
const Order = require("../models/orderModel");
const Payment = require("../models/paymentModel");
const createHttpError = require("http-errors");
const mongoose = require("mongoose")
const ws = require("../services/websocketService");

/**
 * MULTI-TENANCY FIX: Helper to build store-scoped filter
 */
const storeFilter = (req) => {
  const storeRef = req.storeId || req.user?.store;
  return storeRef ? { store: storeRef } : {};
};

const addTable = async (req, res, next) => {
  try {
    const { tableNo, seats } = req.body;
    if (!tableNo) {
      const error = createHttpError(400, "Please provide table No!");
      return next(error);
    }

    // MULTI-TENANCY LOCK: Check uniqueness within the user's store only
    const isTablePresent = await Table.findOne({ tableNo, ...storeFilter(req) });

    if (isTablePresent) {
      const error = createHttpError(400, "Table already exist!");
      return next(error);
    }

    // MULTI-TENANCY LOCK: Inject store into new table
    const newTable = new Table({
      tableNo,
      seats,
      store: req.storeId || req.user.store,
    });
    await newTable.save();
    res
      .status(201)
      .json({ success: true, message: "Table added!", data: newTable });
  } catch (error) {
    next(error);
  }
};

const getTables = async (req, res, next) => {
  try {
    // MULTI-TENANCY LOCK: Only return tables belonging to user's store
    const tables = await Table.find(storeFilter(req)).populate({
      path: "currentOrder",
      select: "customerDetails"
    });
    res.status(200).json({ success: true, data: tables });
  } catch (error) {
    next(error);
  }
};

const updateTable = async (req, res, next) => {
  try {
    const { status, orderId } = req.body;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(404, "Invalid id!");
      return next(error);
    }

    // MULTI-TENANCY LOCK: Scoped to user's store — prevents updating tables from other stores
    const table = await Table.findOneAndUpdate(
      { _id: id, ...storeFilter(req) },
      { status, currentOrder: orderId },
      { new: true }
    );

    if (!table) {
      const error = createHttpError(404, "Table not found!");
      return next(error);
    }

    res.status(200).json({ success: true, message: "Table updated!", data: table });

  } catch (error) {
    next(error);
  }
};

/**
 * Fase 9.3C — Fechar mesa (PDV closing/payment)
 * POST /api/table/:id/close
 *
 * Valida a mesa, processa pagamento básico, libera a mesa.
 */
const closeTable = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentMethod, paidAmount, observations } = req.body;
    const storeRef = req.storeId || req.user.store;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(404, "Invalid id!");
      return next(error);
    }

    // Validar mesa
    const table = await Table.findOne({ _id: id, store: storeRef });
    if (!table) {
      const error = createHttpError(404, "Table not found!");
      return next(error);
    }

    // Buscar ordens abertas na mesa (não canceladas, não fechadas)
    const openOrders = await Order.find({
      table: table._id,
      store: storeRef,
      closeStatus: { $ne: 'closed' },
      orderStatus: { $ne: 'cancelled' }
    });

    if (openOrders.length === 0) {
      const error = createHttpError(400, "No open orders found on this table!");
      return next(error);
    }

    // Calcular total acumulado
    const totalAmount = openOrders.reduce((sum, o) => sum + (o.bills?.totalWithTax || 0), 0);
    const totalCOGS = openOrders.reduce((sum, o) => sum + (o.totalCOGS || 0), 0);

    // Validar método de pagamento
    if (!paymentMethod) {
      const error = createHttpError(400, "Payment method is required!");
      return next(error);
    }

    // Atualizar status de pagamento e fechamento em todos os pedidos
    const updatePromises = openOrders.map(order =>
      Order.findByIdAndUpdate(order._id, {
        paymentStatus: 'paid',
        closeStatus: 'closed',
        orderStatus: order.orderStatus === 'Ready' ? 'completed' : order.orderStatus,
        paymentMethod: paymentMethod,
        ...(observations ? { observations } : {}),
        ...(paidAmount ? { 'bills.totalWithTax': paidAmount } : {})
      }, { new: true })
    );
    const updatedOrders = await Promise.all(updatePromises);

    // Registrar pagamento para cada pedido
    const paymentPromises = openOrders.map(order =>
      Payment.create({
        store: storeRef,
        order: order._id,
        orderNumber: order.orderNumber || `ORD-${Date.now()}`,
        amount: order.bills?.totalWithTax || 0,
        method: paymentMethod,
        paidAmount: paidAmount || order.bills?.totalWithTax || 0,
        status: 'approved',
        user: req.user._id,
        cashier: req.user._id
      })
    );
    await Promise.all(paymentPromises);

    // Liberar mesa
    table.status = "Available";
    table.currentOrder = undefined;
    await table.save();

    // Emit WebSocket events
    const io = req.app.get('io');
    io.to(`store:${storeRef}`).emit('table:released', {
      tableId: table._id,
      tableNumber: table.tableNo,
      timestamp: new Date().toISOString()
    });

    // Emit order status changes
    for (const order of updatedOrders) {
      ws.emitOrderStatusChanged(io, storeRef, order, order.orderStatus);
    }

    res.status(200).json({
      success: true,
      message: `Table ${table.tableNo} closed successfully!`,
      data: {
        table: {
          _id: table._id,
          tableNo: table.tableNo,
          status: table.status
        },
        ordersClosed: updatedOrders.length,
        totalAmount,
        totalCOGS: Math.round(totalCOGS * 100) / 100,
        paymentMethod
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fase 9.3C — Obter conta acumulada da mesa
 * GET /api/table/:id/bill
 *
 * Retorna todas as ordens abertas da mesa com totais agregados.
 */
const getTableBill = async (req, res, next) => {
  try {
    const { id } = req.params;
    const storeRef = req.storeId || req.user.store;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(404, "Invalid id!");
      return next(error);
    }

    const table = await Table.findOne({ _id: id, store: storeRef });
    if (!table) {
      const error = createHttpError(404, "Table not found!");
      return next(error);
    }

    // Buscar ordens abertas da mesa (não canceladas, não fechadas)
    let orders = await Order.find({
      table: table._id,
      store: storeRef,
      orderStatus: { $ne: 'cancelled' },
      closeStatus: { $ne: 'closed' }
    }).sort({ createdAt: 1 });

    // Se a mesa está Booked mas não há ordens abertas, liberar automaticamente
    // e buscar todas as ordens (incluindo fechadas) para exibicao
    if (orders.length === 0 && table.status === 'Booked') {
      table.status = 'Available';
      table.currentOrder = undefined;
      await table.save();

      // Buscar ordens fechadas recentes para mostrar ao usuario
      orders = await Order.find({
        table: table._id,
        store: storeRef,
        orderStatus: { $ne: 'cancelled' }
      }).sort({ createdAt: -1 }).limit(5);

      console.log(`[getTableBill] Auto-released stuck table ${table.tableNo} (${table._id})`);
    }

    // Calcular agregados
    let subtotal = 0;
    let tax = 0;
    let total = 0;
    let totalCOGS = 0;
    let openCount = 0;
    let unpaidCount = 0;
    let paidCount = 0;

    for (const order of orders) {
      subtotal += order.bills?.total || 0;
      tax += order.bills?.tax || 0;
      total += order.bills?.totalWithTax || 0;
      totalCOGS += order.totalCOGS || 0;

      if (order.closeStatus !== 'closed') {
        openCount++;
      }
      if (order.paymentStatus === 'paid') {
        paidCount++;
      } else {
        unpaidCount++;
      }
    }

    // Determinar paymentStatus agregado
    let aggregatedPaymentStatus = 'unpaid';
    if (paidCount > 0 && unpaidCount === 0) {
      aggregatedPaymentStatus = 'paid';
    } else if (paidCount > 0 && unpaidCount > 0) {
      aggregatedPaymentStatus = 'partially_paid';
    }

    res.status(200).json({
      success: true,
      data: {
        table: {
          _id: table._id,
          tableNo: table.tableNo,
          status: table.status,
          store: table.store
        },
        orders: orders.map(o => ({
          _id: o._id,
          orderStatus: o.orderStatus,
          paymentStatus: o.paymentStatus,
          closeStatus: o.closeStatus,
          customerDetails: o.customerDetails,
          bills: o.bills,
          totalCOGS: o.totalCOGS,
          items: o.items,
          orderType: o.orderType,
          observations: o.observations,
          createdAt: o.createdAt
        })),
        summary: {
          ordersCount: orders.length,
          openOrdersCount: openCount,
          subtotal: Math.round(subtotal * 100) / 100,
          tax: Math.round(tax * 100) / 100,
          total: Math.round(total * 100) / 100,
          totalCOGS: Math.round(totalCOGS * 100) / 100,
          aggregatedPaymentStatus
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { addTable, getTables, updateTable, closeTable, getTableBill };
