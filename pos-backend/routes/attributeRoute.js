const express = require("express");
const {
    createAttribute,
    getAttributes,
    getAttributeById,
    updateAttribute,
    addOption,
    updateOption,
    removeOption,
    toggleAttributeStatus,
    deleteAttribute,
    validateSelection
} = require("../controllers/attributeController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const { storeIsolation } = require("../middlewares/storeIsolation");
const { deviceApproval } = require("../middlewares/deviceApproval");
const { checkPermission } = require("../middlewares/checkPermission");

const router = express.Router();

// Middleware chain
router.use(isVerifiedUser);
router.use(storeIsolation);
router.use(deviceApproval);

// Rotas
router.post("/", checkPermission('products', 'create'), createAttribute);
router.get("/", getAttributes);
router.get("/:id", getAttributeById);
router.put("/:id", checkPermission('products', 'update'), updateAttribute);
router.post("/:id/options", checkPermission('products', 'update'), addOption);
router.put("/:id/options/:optionId", checkPermission('products', 'update'), updateOption);
router.delete("/:id/options/:optionId", checkPermission('products', 'delete'), removeOption);
router.put("/:id/toggle-status", checkPermission('products', 'update'), toggleAttributeStatus);
router.delete("/:id", checkPermission('products', 'delete'), deleteAttribute);
router.post("/:id/validate-selection", validateSelection);

module.exports = router;
