const express = require("express");
const {
    createRecipe,
    getRecipes,
    getRecipeById,
    getRecipeBySku,
    updateRecipe,
    calculateRecipeCost,
    checkStockAvailability,
    deductStock,
    toggleRecipeStatus,
    deleteRecipe
} = require("../controllers/recipeController");
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
router.post("/", checkPermission('inventory', 'create'), createRecipe);
router.get("/", getRecipes);
router.get("/sku/:sku", getRecipeBySku);
router.get("/:id", getRecipeById);
router.put("/:id", checkPermission('inventory', 'update'), updateRecipe);
router.put("/:id/toggle-status", checkPermission('inventory', 'update'), toggleRecipeStatus);
router.delete("/:id", checkPermission('inventory', 'delete'), deleteRecipe);

// Rotas de cálculo e estoque
router.get("/:id/cost", calculateRecipeCost);
router.get("/:id/stock/check", checkStockAvailability);
router.post("/:id/stock/deduct", checkPermission('inventory', 'adjust'), deductStock);

module.exports = router;
