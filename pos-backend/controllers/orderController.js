const createHttpError = require("http-errors");
const Order = require("../models/orderModel");
const { default: mongoose } = require("mongoose");
const ws = require("../services/websocketService");
const orderCheckoutService = require("../services/orderCheckoutService");
const OperationalAlert = require("../models/operationalAlertModel");
const KDSOrder = require("../models/kdsOrderModel");
const KDSConfig = require("../models/kdsConfigModel");
const Table = require("../models/tableModel");

/**
 * MULTI-TENANCY FIX: Helper to build store-scoped filter
 * Ensures every query is limited to the user's store.
 * Non-admin users are always scoped to their own store.
 * Master admins can optionally filter by storeId query param.
 */
const storeFilter = (req) => {
  // req.storeId is set by storeIsolation middleware (string)
  // req.user.store is the ObjectId from the user document
  const storeRef = req.storeId || req.user?.store;
  return storeRef ? { store: storeRef } : {};
};

/**
 * Sincroniza um Order recem-criado para o KDS (colecao kds_orders).
 * Fire-and-forget — falhas aqui nao bloqueiam a venda.
 */
const syncOrderToKds = async (order, storeRef, io) => {
  try {
    const config = await KDSConfig.getStoreConfig(storeRef);

    // Fetch table number since order.table is an unpopulated ObjectId
    let tableNumber = null;
    if (order.table) {
      const Table = mongoose.model('Table');
      const tableDoc = await Table.findById(order.table).select('tableNo').lean();
      tableNumber = tableDoc?.tableNo;
    }

    // Build product maps: category routing + kitchen-prep eligibility
    const Product = mongoose.model('Product');
    const productIds = order.items
      .filter(item => item.product)
      .map(item => item.product);
    const products = productIds.length > 0
      ? await Product.find({ _id: { $in: productIds } }).select('category sellableType stockImpactRule').lean()
      : [];
    const productCategoryMap = {};
    const productNeedsPrep = {}; // true if item requires kitchen preparation
    for (const p of products) {
      productCategoryMap[p._id.toString()] = p.category?.toString();
      // Industrialized resale (bebidas, etc.) and stock_item_direct items skip kitchen
      const needsPrep = p.sellableType !== 'industrialized_resale'
        && p.stockImpactRule !== 'stock_item_direct';
      productNeedsPrep[p._id.toString()] = needsPrep;
    }

    // Category -> station routing
    const categoryStationMap = {};
    const activeStations = (config.stations || []).filter(s => s.isActive && s.autoRouteItems);
    for (const station of activeStations) {
      for (const catId of (station.itemCategories || [])) {
        categoryStationMap[catId.toString()] = station.id;
      }
    }

    const resolveStation = (productId) => {
      if (!productId) return config.defaultStation || 'kitchen';
      const catId = productCategoryMap[productId.toString()];
      if (!catId) return config.defaultStation || 'kitchen';
      return categoryStationMap[catId] || config.defaultStation || 'kitchen';
    };

    // Fase 9.3C: Map orderType to KDS orderType format (dine_in -> dine-in)
    const orderType = order.orderType || 'dine_in';
    const kdsOrderType = orderType === 'dine_in' ? 'dine-in' :
                         orderType === 'counter' ? 'counter' :
                         orderType === 'pickup' ? 'pickup' :
                         orderType === 'delivery' ? 'delivery' : 'dine-in';

    // Filter to items that actually need kitchen preparation
    const kdsItems = order.items
      .filter(item => (item.name || item.productName) && (!item.product || productNeedsPrep[item.product?.toString()] !== false))
      .map(item => ({
        orderItem: item._id,
        productId: item.product || undefined,
        productName: item.name || item.productName,
        quantity: item.quantity || 1,
        station: resolveStation(item.product),
        prepTimeMinutes: config.slaSettings?.defaultPrepTime || 15,
        notes: item.notes || '',
        modifiers: item.modifiers || []
      }));

    if (kdsItems.length === 0) {
      // No items need kitchen prep (e.g., drinks-only order) — skip KDS entirely
      console.log(`[orderController] KDS skipped for order ${order._id}: no items require kitchen preparation`);
      return;
    }

    const kdsOrder = await KDSOrder.create({
      store: storeRef,
      order: order._id,
      orderNumber: `#${Math.floor(new Date(order.orderDate).getTime())}`,
      table: order.table?._id || order.table,
      tableNumber,
      customerName: order.customerDetails?.name,
      orderType: kdsOrderType,
      items: kdsItems,
      estimatedReady: new Date(Date.now() + (config.slaSettings?.defaultPrepTime || 15) * 60000),
      metadata: {
        channel: 'pos',
        notes: order.observations || ''
      }
    });

    if (io) {
      io.to(`store:${storeRef}`).emit('kds:order-synced', {
        kdsOrderId: kdsOrder.kdsOrderId,
        orderNumber: kdsOrder.orderNumber,
        tableNumber: kdsOrder.tableNumber,
        itemsCount: kdsItems.length,
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error(`[orderController] KDS sync failed for order ${order._id}: ${err.message}`);
  }
};

const addOrder = async (req, res, next) => {
  try {
    // MULTI-TENANCY LOCK: Force the order to belong to the authenticated user's store
    const storeRef = req.storeId || req.user.store;
    const orderData = { ...req.body, store: storeRef };

    // Fase 9.3C: Set defaults for new fields
    if (!orderData.orderType) orderData.orderType = 'dine_in';
    if (!orderData.paymentStatus) orderData.paymentStatus = 'unpaid';
    if (!orderData.closeStatus) orderData.closeStatus = 'open';

    const order = new Order(orderData);
    await order.save();

    // Fase 9.3C: Update table association — accept Booked tables, point currentOrder to latest order
    if (order.table) {
      try {
        // Find the table first to check current status
        const table = await Table.findById(order.table);
        if (table) {
          const updateData = { currentOrder: order._id };
          // Only set to Booked if table was Available (if already Booked, keep it Booked)
          if (table.status === 'Available') {
            updateData.status = 'Booked';
          }
          await Table.findOneAndUpdate(
            { _id: order.table, store: storeRef },
            updateData,
            { new: true }
          );
        }
      } catch (tableErr) {
        console.error(`[orderController] Table booking failed for table ${order.table}: ${tableErr.message}`);
      }
    }

    // Determine if order needs kitchen preparation
    const Product = mongoose.model('Product');
    const productIds = order.items
      .filter(item => item.product)
      .map(item => item.product);
    const products = productIds.length > 0
      ? await Product.find({ _id: { $in: productIds } }).select('sellableType stockImpactRule').lean()
      : [];
    const needsPrep = products.some(
      p => p.sellableType !== 'industrialized_resale' && p.stockImpactRule !== 'stock_item_direct'
    );

    // Emit WebSocket event
    const io = req.app.get('io');
    ws.emitOrderCreated(io, order);

    if (!needsPrep) {
      // Drink-only or resale-only order — no kitchen prep needed, mark Ready
      order.orderStatus = 'Ready';
      await order.save();
      console.log(`[orderController] Order ${order._id} auto-advanced to Ready (no kitchen items)`);
    } else {
      // Sync to KDS (fire-and-forget) for food items
      syncOrderToKds(order, storeRef, io);
    }

    res
      .status(201)
      .json({ success: true, message: "Order created!", data: order });
  } catch (error) {
    next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(404, "Invalid id!");
      return next(error);
    }

    // MULTI-TENANCY LOCK: Scoped to user's store — prevents accessing orders from other stores
    const order = await Order.findOne({ _id: id, ...storeFilter(req) }).populate("table");
    if (!order) {
      const error = createHttpError(404, "Order not found!");
      return next(error);
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

const getOrders = async (req, res, next) => {
  try {
    const filter = { ...storeFilter(req) };

    // Optional date filter in user's local day (not UTC midnight)
    const dateParam = req.query.date;
    if (dateParam) {
      const [year, month, day] = dateParam.split('-').map(Number);
      const start = new Date(year, month - 1, day, 0, 0, 0, 0);
      const end = new Date(year, month - 1, day, 23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    }

    const orders = await Order.find(filter).populate("table").sort({ createdAt: -1 });
    res.status(200).json({ data: orders });
  } catch (error) {
    next(error);
  }
};

const updateOrder = async (req, res, next) => {
  try {
    const { orderStatus } = req.body;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(404, "Invalid id!");
      return next(error);
    }

    // MULTI-TENANCY LOCK: Only find orders belonging to user's store
    const oldOrder = await Order.findOne({ _id: id, ...storeFilter(req) });
    if (!oldOrder) {
      const error = createHttpError(404, "Order not found!");
      return next(error);
    }

    const oldStatus = oldOrder.orderStatus;

    // MULTI-TENANCY LOCK: Update only within the same store scope
    const order = await Order.findOneAndUpdate(
      { _id: id, ...storeFilter(req) },
      { orderStatus },
      { new: true }
    );

    // Emit WebSocket events
    const io = req.app.get('io');
    ws.emitOrderUpdated(io, order);

    // If status changed, emit specific event (now uses corrected 'store' field)
    if (oldStatus !== orderStatus) {
      ws.emitOrderStatusChanged(io, order.store, order, oldStatus);

      // Sync KDS status when order status changes
      if (orderStatus === 'Ready') {
        try {
          const kdsOrder = await KDSOrder.findOne({ order: order._id });
          if (kdsOrder && kdsOrder.status !== 'ready' && kdsOrder.status !== 'served') {
            await kdsOrder.markReady();
            io.to(`store:${order.store}`).emit('kds:order-ready', {
              kdsOrderId: kdsOrder.kdsOrderId,
              orderNumber: kdsOrder.orderNumber,
              tableNumber: kdsOrder.tableNumber,
              timestamp: new Date().toISOString()
            });
          }
        } catch (kdsErr) {
          console.error(`[orderController] KDS status sync failed for order ${id}: ${kdsErr.message}`);
        }
      }

      // When order is finalized/completed, mark KDS as served
      if (orderStatus === 'completed') {
        try {
          const kdsOrder = await KDSOrder.findOne({ order: order._id });
          if (kdsOrder && kdsOrder.status !== 'served') {
            await kdsOrder.markServed();
            io.to(`store:${order.store}`).emit('kds:order-served', {
              kdsOrderId: kdsOrder.kdsOrderId,
              orderNumber: kdsOrder.orderNumber,
              timestamp: new Date().toISOString()
            });
          }
        } catch (kdsErr) {
          console.error(`[orderController] KDS status sync failed for order ${id}: ${kdsErr.message}`);
        }

        // Fase 9.3C: Table release removed from here — table is only released by PDV closing/payment
        // dine-in tables stay Booked after KDS served; counter/pickup have no table
      }
    }

    res
      .status(200)
      .json({ success: true, message: "Order updated", data: order });
  } catch (error) {
    next(error);
  }
};

/**
 * Processar baixa de estoque para pedido existente (Fase 8.4.2 — POS integration).
 * Chamado pelo POS após criar o pedido, para acionar a pipeline real de baixa.
 * Não cria pagamento — apenas processa a dedução de estoque.
 */
const processOrderStockDeduction = async (req, res, next) => {
    try {
        const { id } = req.params;
        const storeRef = req.storeId || req.user.store;
        const userId = req.user._id;

        // Buscar pedido com verificação de loja
        const order = await Order.findOne({ _id: id, store: storeRef });

        if (!order) {
            const error = createHttpError(404, "Order not found!");
            return next(error);
        }

        if (order.stockDeductionStatus === 'completed') {
            return res.status(200).json({
                success: true,
                message: "Stock already deducted for this order",
                data: { stockDeductionStatus: order.stockDeductionStatus }
            });
        }

        // Iniciar transação MongoDB
        const session = await mongoose.startSession();
        session.startTransaction();

        let stockDeductionResult = null;
        let stockDeductionError = null;

        try {
            stockDeductionResult = await orderCheckoutService.processOrderStockDeduction({
                storeId: storeRef,
                orderId: id,
                orderItems: order.items,
                userId,
                session
            });

            // Atualizar itens do pedido — Fase 9.1D: persistência completa per-item
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
                    // Fase 9.1D — metadados operacionais
                    if (itemResult.stockImpactRule) item.stockImpactRule = itemResult.stockImpactRule;
                    if (itemResult.sellableType) item.sellableType = itemResult.sellableType;
                    if (itemResult.variation) item.variation = itemResult.variation;
                    if (itemResult.sku) item.sku = itemResult.sku;
                    if (itemResult.pricePerQuantity) item.pricePerQuantity = itemResult.pricePerQuantity;
                    if (itemResult.stockDeductionReason) item.stockDeductionReason = itemResult.stockDeductionReason;
                }
            }

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
            await session.commitTransaction();
        } catch (deductionError) {
            await session.abortTransaction();
            stockDeductionError = deductionError.message;

            // TASK 7: Salvar status de falha FORA da transação
            try {
                order.stockDeductionStatus = 'failed';
                order.stockDeductionError = stockDeductionError;
                await order.save();
            } catch (saveErr) {
                console.error(`[orderController] Failed to save failed status for order ${id}: ${saveErr.message}`);
            }

            // TASK 8: Gerar alerta operacional fora da transação
            try {
                await OperationalAlert.create({
                    type: 'sale_without_stock_deduction',
                    severity: 'critical',
                    store: storeRef,
                    status: 'new',
                    message: `Falha na baixa de estoque do pedido ${id}: ${stockDeductionError}`,
                    currentValue: 1,
                    metadata: {
                        orderId: id,
                        reason: 'transaction_abort',
                        error: stockDeductionError,
                        storeId: storeRef?.toString()
                    }
                });
            } catch (alertErr) {
                console.error(`[orderController] Failed to create alert for order ${id}: ${alertErr.message}`);
            }
        } finally {
            session.endSession();
        }

        res.status(200).json({
            success: !stockDeductionError,
            message: stockDeductionError
                ? `Stock deduction failed: ${stockDeductionError}`
                : "Stock deduction processed!",
            data: {
                stockDeductionStatus: order.stockDeductionStatus || 'failed',
                totalCOGS: order.totalCOGS || 0,
                stockDeductionError,
                items: stockDeductionResult?.items || []
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    addOrder,
    getOrderById,
    getOrders,
    updateOrder,
    processOrderStockDeduction
};
