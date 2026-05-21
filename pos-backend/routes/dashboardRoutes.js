const express = require("express");
const router = express.Router();
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const {
    getDashboardKPIs,
    getSalesReport,
    getTopProducts,
    getSupplierAnalytics,
    getInventoryAnalytics,
    getCMVReport,
    getUserStats,
    exportReport
} = require("../controllers/dashboardController");

// Proteger todas as rotas
router.use(isVerifiedUser);

// KPIs Gerais
router.get("/kpi", getDashboardKPIs);

// Relatórios
router.get("/sales", getSalesReport);
router.get("/products/top", getTopProducts);
router.get("/suppliers", getSupplierAnalytics);
router.get("/inventory", getInventoryAnalytics);
router.get("/cmv", getCMVReport);
router.get("/users", getUserStats);

// Exportação
router.get("/export", exportReport);

module.exports = router;
