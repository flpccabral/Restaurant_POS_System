const createHttpError = require("http-errors");
const Order = require("../models/orderModel");
const { default: mongoose } = require("mongoose");
const ws = require("../services/websocketService");
const orderCheckoutService = require("../services/orderCheckoutService");
const OperationalAlert = require("../models/operationalAlertModel");

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

const addOrder = async (req, res, next) => {
  try {
    // MULTI-TENANCY LOCK: Force the order to belong to the authenticated user's store
    const order = new Order({
      ...req.body,
      store: req.storeId || req.user.store,
    });
    await order.save();

    // Emit WebSocket event
    const io = req.app.get('io');
    ws.emitOrderCreated(io, order);

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
    // MULTI-TENANCY LOCK: All queries scoped to user's store
    const orders = await Order.find(storeFilter(req)).populate("table");
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
