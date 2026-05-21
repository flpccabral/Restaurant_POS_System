const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const {
    getKDSConfig,
    updateKDSConfig,
    getKitchenOrders,
    getKDSOrderById,
    acceptKDSOrder,
    updateItemStatus,
    markOrderReady,
    markOrderServed,
    rushOrder,
    getStationStats,
    syncOrderToKDS,
    cancelKDSOrder
} = require("../controllers/kdsController");

// Proteger todas as rotas
router.use(authMiddleware);

// Configuração
router.get("/config", getKDSConfig);
router.put("/config", updateKDSConfig);

// Pedidos KDS
router.get("/orders", getKitchenOrders);
router.get("/orders/:id", getKDSOrderById);
router.post("/orders/sync", syncOrderToKDS);

// Ações em pedidos
router.post("/orders/:id/accept", acceptKDSOrder);
router.post("/orders/:id/items/:itemId/status", updateItemStatus);
router.post("/orders/:id/ready", markOrderReady);
router.post("/orders/:id/served", markOrderServed);
router.post("/orders/:id/rush", rushOrder);
router.post("/orders/:id/cancel", cancelKDSOrder);

// Estatísticas
router.get("/stats/station", getStationStats);

module.exports = router;
