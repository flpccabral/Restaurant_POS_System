const express = require("express");
const { addOrder, getOrders, getOrderById, updateOrder, processOrderStockDeduction } = require("../controllers/orderController");
const { reverseOrderStock, cancelOrder } = require("../controllers/orderReversalController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const { storeIsolation } = require("../middlewares/storeIsolation");
const { checkPermission } = require("../middlewares/checkPermission");
const router = express.Router();

// MULTI-TENANCY FIX: All order routes now require storeIsolation middleware
// which injects req.storeId and enforces tenant scoping on every operation.

router.route("/")
  .post(isVerifiedUser, storeIsolation, checkPermission("orders", "create"), addOrder)
  .get(isVerifiedUser, storeIsolation, checkPermission("orders", "read"), getOrders);

router.route("/:id")
  .get(isVerifiedUser, storeIsolation, checkPermission("orders", "read"), getOrderById)
  .put(isVerifiedUser, storeIsolation, checkPermission("orders", "update"), updateOrder);

// Fase 8.4.2 — Baixa de estoque para pedido existente (chamado pelo POS após criação)
router.post("/:id/process-stock-deduction", isVerifiedUser, storeIsolation, checkPermission("orders", "update"), processOrderStockDeduction);

// Fase 5.5 — Reversão de estoque
router.post("/:id/reverse-stock", isVerifiedUser, storeIsolation, checkPermission("inventory", "adjust"), reverseOrderStock);

// Fase 5.5 — Cancelamento operacional
router.post("/:id/cancel", isVerifiedUser, storeIsolation, checkPermission("orders", "cancel"), cancelOrder);

module.exports = router;
