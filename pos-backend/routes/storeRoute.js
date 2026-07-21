const express = require("express");
const {
    createStore,
    getStores,
    getStoreById,
    updateStore,
    toggleStoreStatus,
    getCurrentStoreSettings,
    getServiceChargeConfig,
    updateServiceChargeConfig
} = require("../controllers/storeController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const { storeIsolation } = require("../middlewares/storeIsolation");
const router = express.Router();

// Todas as rotas requerem autenticação
router.use(isVerifiedUser);
router.use(storeIsolation);

// Rotas
router.post("/", createStore);
router.get("/", getStores);
router.get("/current", getCurrentStoreSettings);

// Prompt G — Gorjeta/Servico opcional (configuracao por loja)
router.get("/current/service-charge", getServiceChargeConfig);
router.put("/current/service-charge", updateServiceChargeConfig);

router.get("/:id", getStoreById);
router.put("/:id", updateStore);
router.put("/:id/toggle-status", toggleStoreStatus);

module.exports = router;
