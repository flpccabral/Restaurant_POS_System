const express = require("express");
const {
    getStockBalance,
    updateStockBalance,
    stockIn,
    stockOut,
    stockAdjustment,
    getStockHistory,
    getStockAlerts,
    checkStockAlerts,
    acknowledgeAlert,
    resolveAlert,
    generateShoppingList,
    getRestockAlerts
} = require("../controllers/stockController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const { storeIsolation } = require("../middlewares/storeIsolation");
const { deviceApproval } = require("../middlewares/deviceApproval");
const { checkPermission } = require("../middlewares/checkPermission");

const router = express.Router();

// Middleware chain
router.use(isVerifiedUser);
router.use(storeIsolation);
router.use(deviceApproval);

// Rotas de saldo
router.get("/balance", getStockBalance);
router.post("/balance", checkPermission('inventory', 'adjust'), updateStockBalance);

// Rotas de movimento
router.post("/in", checkPermission('inventory', 'adjust'), stockIn);
router.post("/out", checkPermission('inventory', 'adjust'), stockOut);
router.post("/adjust", checkPermission('inventory', 'adjust'), stockAdjustment);
router.get("/history", getStockHistory);

// Rotas de alertas
router.get("/alerts", getStockAlerts);
router.post("/alerts/check", checkPermission('inventory', 'read'), checkStockAlerts);
router.post("/alerts/:id/acknowledge", checkPermission('inventory', 'read'), acknowledgeAlert);
router.post("/alerts/:id/resolve", checkPermission('inventory', 'read'), resolveAlert);

// Lista de compras e reposição
router.get("/restock-alerts", getRestockAlerts);
router.get("/shopping-list", generateShoppingList);

module.exports = router;
