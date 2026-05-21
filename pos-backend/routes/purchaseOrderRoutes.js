const express = require("express");
const router = express.Router();
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const {
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
} = require("../controllers/purchaseOrderController");

// Proteger todas as rotas
router.use(isVerifiedUser);

// Rotas
router.get("/", getPurchaseOrders);
router.get("/stats", getPurchaseOrderStats);
router.get("/:id", getPurchaseOrderById);
router.post("/", createPurchaseOrder);
router.post("/:id/send", sendPurchaseOrder);
router.post("/:id/confirm", confirmPurchaseOrder);
router.post("/:id/approve", approvePurchaseOrder);
router.post("/:id/receive", receivePurchaseOrder);
router.post("/:id/cancel", cancelPurchaseOrder);
router.post("/from-alert/:alertId", createFromAlert);
router.put("/:id", updatePurchaseOrder);

module.exports = router;
