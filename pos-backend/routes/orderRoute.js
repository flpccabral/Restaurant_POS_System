const express = require("express");
const { addOrder, getOrders, getOrderById, updateOrder } = require("../controllers/orderController");
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

module.exports = router;
