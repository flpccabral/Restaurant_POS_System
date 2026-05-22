const express = require("express");
const router = express.Router();
const productionController = require("../controllers/productionController");
const { authenticate } = require("../middlewares/tokenVerification");
const { checkPermission } = require("../middlewares/checkPermission");

router.use(authenticate);

// Criar produção interna
router.post(
    "/",
    checkPermission('inventory', 'adjust'),
    productionController.createProduction
);

// Listar produções por loja
router.get(
    "/",
    checkPermission('inventory', 'read'),
    productionController.listProductions
);

// Listar subprodutos disponíveis
router.get(
    "/byproducts/available",
    checkPermission('inventory', 'read'),
    productionController.getAvailableByproducts
);

// Buscar produção por ID
router.get(
    "/:id",
    checkPermission('inventory', 'read'),
    productionController.getProductionById
);

// Cancelar produção
router.put(
    "/:id/cancel",
    checkPermission('inventory', 'adjust'),
    productionController.cancelProduction
);

module.exports = router;
