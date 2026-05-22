const express = require("express");
const router = express.Router();
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const {
    getDashboardKPIs,
    getSalesReport,
    getTopProducts,
    getCMVReport,
    getVarianceAnalysis,
    getInventoryAnalytics,
    getUserStats
} = require("../controllers/dashboardController");

// Proteger todas as rotas
router.use(isVerifiedUser);

// KPIs Gerais
router.get("/kpi", getDashboardKPIs);

// Relatórios
router.get("/sales", getSalesReport);
router.get("/products/top", getTopProducts);
router.get("/cmv", getCMVReport);
router.get("/variance", getVarianceAnalysis);
router.get("/inventory", getInventoryAnalytics);
router.get("/users", getUserStats);

module.exports = router;
