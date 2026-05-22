const express = require("express");
const {
    getStockHealth,
    getIngredientHealth,
    getStoreRecommendations,
    getNetworkRecommendations,
    getAlerts,
    resolveAlert,
    getTimeline,
    generateAlerts
} = require("../controllers/observabilityController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const { storeIsolation } = require("../middlewares/storeIsolation");
const { deviceApproval } = require("../middlewares/deviceApproval");
const { checkPermission } = require("../middlewares/checkPermission");

const router = express.Router();

// Middleware chain
router.use(isVerifiedUser);
router.use(storeIsolation);
router.use(deviceApproval);

// Stock health
router.get("/stock-health/store/:storeId", checkPermission('inventory', 'read'), getStockHealth);
router.get("/stock-health/ingredient/:ingredientId", checkPermission('inventory', 'read'), getIngredientHealth);

// Recommendations
router.get("/recommendations/store/:storeId", checkPermission('inventory', 'read'), getStoreRecommendations);
router.get("/recommendations/network", checkPermission('inventory', 'read'), getNetworkRecommendations);

// Alerts
router.get("/alerts", checkPermission('inventory', 'read'), getAlerts);
router.post("/alerts/:id/resolve", checkPermission('inventory', 'adjust'), resolveAlert);
router.post("/alerts/generate/:storeId", checkPermission('inventory', 'read'), generateAlerts);

// Timeline
router.get("/timeline", checkPermission('inventory', 'read'), getTimeline);

module.exports = router;
