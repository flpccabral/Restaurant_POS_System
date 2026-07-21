const createHttpError = require("http-errors");
const Order = require("../models/orderModel");
const Payment = require("../models/paymentModel");
const CashSession = require("../models/cashSessionModel");
const { default: mongoose } = require("mongoose");
const ws = require("../services/websocketService");
const orderCheckoutService = require("../services/orderCheckoutService");
const OperationalAlert = require("../models/operationalAlertModel");
const KDSOrder = require("../models/kdsOrderModel");
const KDSConfig = require("../models/kdsConfigModel");
const Table = require("../models/tableModel");
const Printer = require("../models/printerModel");
const thermalPrinterService = require("../services/thermalPrinterService");

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
      const eventData = {
        kdsOrderId: kdsOrder.kdsOrderId,
        orderNumber: kdsOrder.orderNumber,
        tableNumber: kdsOrder.tableNumber,
        itemsCount: kdsItems.length,
        timestamp: new Date().toISOString()
      };
      io.to(`store:${storeRef}`).emit('kds:order-synced', eventData);
      console.log(`[orderController] ✅ kds:order-synced emitted for order ${order._id}`, eventData);
    } else {
      console.warn(`[orderController] ⚠️ io is undefined, cannot emit kds:order-synced for order ${order._id}`);
    }
  } catch (err) {
    console.error(`[orderController] KDS sync failed for order ${order._id}: ${err.message}`);
  }
};

/**
 * Impressao automatica de comanda de cozinha ao criar pedido.
 * Fire-and-forget — falhas aqui nao bloqueiam a venda.
 */
const autoPrintKitchen = async (order, storeRef) => {
  try {
    const printer = await Printer.getActivePrinter(storeRef, 'kitchen');
    if (!printer) {
      console.log(`[orderController] Kitchen print skipped for order ${order._id}: no kitchen printer configured`);
      return;
    }

    // Popular table number para impressao
    let populatedOrder = order;
    if (order.table && !order.table.tableNo) {
      const tableDoc = await Table.findById(order.table).select('tableNo').lean();
      if (tableDoc) {
        populatedOrder = { ...order.toObject ? order.toObject() : order, tableNumber: tableDoc.tableNo };
      }
    }

    const result = await thermalPrinterService.printOrder({
      order: populatedOrder,
      printer,
      printType: 'kitchen'
    });

    if (result.success) {
      console.log(`[orderController] Kitchen print successful for order ${order._id}`);
    } else {
      console.warn(`[orderController] Kitchen print failed for order ${order._id}: ${result.message}`);
    }
  } catch (err) {
    console.error(`[orderController] Kitchen auto-print failed for order ${order._id}: ${err.message}`);
  }
};

/**
 * FLUXO_CAIXA: Mapeia paymentMethod do Order (português) para formato do Payment model (inglês)
 */
const mapPaymentMethodForPayment = (paymentMethod) => {
  const methodMap = {
    'Dinheiro': 'cash',
    'dinheiro': 'cash',
    'cash': 'cash',
    'Pix': 'pix',
    'pix': 'pix',
    'Credito': 'credit_card',
    'credito': 'credit_card',
    'credit_card': 'credit_card',
    'Debito': 'debit_card',
    'debito': 'debit_card',
    'debit_card': 'debit_card',
    'Voucher': 'voucher',
    'voucher': 'voucher'
  };
  return methodMap[paymentMethod] || 'cash';
};

/**
 * Registra transação no caixa aberto (FLUXO_CAIXA.md).
 * Para vendas em dinheiro: registra sale_cash no caixa.
 * Para outros métodos: registra sale_pix, sale_credit, etc (apenas contábil).
 * Fire-and-forget — falhas aqui não bloqueiam a venda.
 */
const registerTransactionInCashSession = async (order, storeRef, userId) => {
  try {
    // Buscar caixa aberto da loja
    const cashSession = await CashSession.getActiveSession(storeRef, userId);

    if (!cashSession) {
      console.warn(`[orderController] No open cash session for order ${order._id}. Transaction not registered.`);
      return;
    }

    // Mapear paymentMethod do Order para type de transaction
    const methodMap = {
      'Dinheiro': 'sale_cash',
      'dinheiro': 'sale_cash',
      'cash': 'sale_cash',
      'Pix': 'sale_pix',
      'pix': 'sale_pix',
      'Credito': 'sale_credit',
      'credito': 'sale_credit',
      'credit_card': 'sale_credit',
      'Debito': 'sale_debit',
      'debito': 'sale_debit',
      'debit_card': 'sale_debit',
      'Voucher': 'sale_voucher',
      'voucher': 'sale_voucher'
    };

    const transactionType = methodMap[order.paymentMethod] || 'sale_cash';
    const paymentMethod = transactionType.replace('sale_', '');

    // Registrar transação no caixa
    await cashSession.registerTransaction({
      type: transactionType,
      value: order.bills?.totalWithTax || 0,
      paymentMethod: paymentMethod,
      orderId: order._id,
      orderNumber: order.orderNumber || `ORD-${Date.now()}`,
      description: `Venda ${order.orderType || 'counter'} - ${order.customerDetails?.name || 'Cliente'}`,
      operatorId: userId
    });

    console.log(`[orderController] Transaction registered in cash session for order ${order._id}: ${transactionType} R$ ${(order.bills?.totalWithTax || 0).toFixed(2)}`);
  } catch (err) {
    console.error(`[orderController] Failed to register transaction in cash session for order ${order._id}: ${err.message}`);
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

    // Garantir que pedidos counter tenham paymentMethod definido
    if (orderData.orderType === 'counter' && orderData.paymentStatus === 'paid') {
      if (!orderData.paymentMethod) {
        const error = createHttpError(400, "paymentMethod é obrigatório para pedidos counter pagos!");
        return next(error);
      }
    }

    // Prompt G — Validar gorjeta/servico opcional (lei brasileira)
    if (orderData.serviceCharge) {
      const sc = orderData.serviceCharge;
      // opted pode ser true/false (default false no schema)
      if (sc.opted === true) {
        // Validar rate entre 0 e 100
        if (sc.rate === undefined || sc.rate < 0 || sc.rate > 100) {
          const error = createHttpError(400, "Taxa de servico deve estar entre 0 e 100!");
          return next(error);
        }
        // Validar amount positivo
        if (sc.amount === undefined || sc.amount < 0) {
          const error = createHttpError(400, "Valor da gorjeta deve ser positivo!");
          return next(error);
        }
        // Validar consistencia: amount = subtotal * rate / 100 (tolerancia de 1 centavo p/ arredondamento)
        const subtotal = orderData.bills?.total || 0;
        const expectedAmount = (subtotal * sc.rate) / 100;
        if (Math.abs(sc.amount - expectedAmount) > 0.01) {
          const error = createHttpError(400, `Valor da gorjeta inconsistente! Esperado: R$ ${expectedAmount.toFixed(2)}, recebido: R$ ${sc.amount.toFixed(2)}`);
          return next(error);
        }
      }
      // Garantir que o campo seja salvo com estrutura correta
      orderData.serviceCharge = {
        opted: Boolean(sc.opted),
        rate: Number(sc.rate) || 0,
        amount: Number(sc.amount) || 0
      };
    }

    // Prompt F — Registrar garçom logado como attendant automaticamente
    // Se já houver attendant no body, manter. Senão, usar o usuário logado se for garçom
    if (!orderData.attendant) {
      const User = require('../models/userModel');
      const Role = require('../models/roleModel');
      const loggedUser = await User.findById(req.user._id || req.user.id).select('role roleConfig');
      if (loggedUser) {
        // Buscar o nome do role
        let roleName = null;
        if (loggedUser.role && mongoose.Types.ObjectId.isValid(loggedUser.role)) {
          const roleDoc = await Role.findById(loggedUser.role).select('name');
          roleName = roleDoc?.name;
        } else if (typeof loggedUser.role === 'string') {
          roleName = loggedUser.role;
        }

        if (roleName) {
          const lowerName = roleName.toLowerCase();
          if (lowerName.includes('garçom') || lowerName.includes('waiter')) {
            orderData.attendant = req.user._id || req.user.id;
          }
        }
      }
    }

    // FLUXO_CAIXA: Validar que vendas em dinheiro exigem caixa aberto
    if (orderData.paymentStatus === 'paid' && orderData.paymentMethod) {
      const isCashPayment = ['Dinheiro', 'dinheiro', 'cash'].includes(orderData.paymentMethod);
      if (isCashPayment) {
        const userId = req.user._id || req.user.id;
        const cashSession = await CashSession.getActiveSession(storeRef, userId);
        if (!cashSession) {
          const error = createHttpError(400, "Venda em dinheiro exige caixa aberto! Abra o caixa antes de finalizar a venda.");
          return next(error);
        }
      }
    }

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

    const isCounter = order.orderType === 'counter';
    if (!needsPrep) {
      // Drink-only or resale-only — no kitchen prep needed
      if (isCounter) {
        // Counter: only mark as completed if payment is already processed
        if (order.paymentStatus === 'paid' && order.paymentMethod) {
          order.orderStatus = 'completed';
          order.closeStatus = 'closed';

          // Criar registro de pagamento se ainda não existe
          try {
            await Payment.create({
              store: storeRef,
              order: order._id,
              orderNumber: order.orderNumber || `ORD-${Date.now()}`,
              amount: order.bills?.totalWithTax || 0,
              method: mapPaymentMethodForPayment(order.paymentMethod),
              paidAmount: order.bills?.totalWithTax || 0,
              status: 'approved',
              user: req.user._id,
              cashier: req.user._id
            });
            console.log(`[orderController] Payment created for counter order ${order._id}`);

            // FLUXO_CAIXA: Registrar transação no caixa aberto
            registerTransactionInCashSession(order, storeRef, req.user._id);
          } catch (paymentError) {
            console.error(`[orderController] Failed to create payment for order ${order._id}:`, paymentError.message);
          }
        } else {
          // Counter order without payment - keep as Ready for later payment
          order.orderStatus = 'Ready';
        }
      } else {
        // Dine-in: ready to serve, but table still open
        order.orderStatus = 'Ready';
      }
      await order.save();
      console.log(`[orderController] Order ${order._id} auto-advanced to ${order.orderStatus} (no kitchen items, ${order.orderType})`);
    } else {
      // Sync to KDS (fire-and-forget) for food items
      syncOrderToKds(order, storeRef, io);
      // Auto-print kitchen ticket (fire-and-forget)
      autoPrintKitchen(order, storeRef);
      // FLUXO_CAIXA: Registrar transação no caixa aberto (se houver pagamento)
      if (order.paymentStatus === 'paid') {
        registerTransactionInCashSession(order, storeRef, req.user._id);
      }
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
