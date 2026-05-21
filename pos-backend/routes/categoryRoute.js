const express = require("express");
const {
    createCategory,
    getCategories,
    getCategoryById,
    updateCategory,
    moveCategory,
    toggleCategoryStatus,
    deleteCategory
} = require("../controllers/categoryController");
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
router.post("/", checkPermission('products', 'create'), createCategory);
router.get("/", getCategories);
router.get("/:id", getCategoryById);
router.put("/:id", checkPermission('products', 'update'), updateCategory);
router.put("/:id/move", checkPermission('products', 'update'), moveCategory);
router.put("/:id/toggle-status", checkPermission('products', 'update'), toggleCategoryStatus);
router.delete("/:id", checkPermission('products', 'delete'), deleteCategory);

module.exports = router;
