const express = require("express");
const {
    createStore,
    getStores,
    getStoreById,
    updateStore,
    toggleStoreStatus,
    getCurrentStoreSettings
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
router.get("/:id", getStoreById);
router.put("/:id", updateStore);
router.put("/:id/toggle-status", toggleStoreStatus);

module.exports = router;
