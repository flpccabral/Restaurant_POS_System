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
    deleteRecipe,
    validateRecipe,
    getProductsWithoutRecipe,
    getSellableProducts,
    getNonSellableProducts,
    checkProductSellability,
    simulateConsumption
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

// Static routes MUST come BEFORE parameterized /:id routes
// to prevent Express from treating static path segments as an :id parameter
router.get("/without-recipe", getProductsWithoutRecipe);
router.get("/sellable", getSellableProducts);
router.get("/non-sellable", getNonSellableProducts);

// CRUD
router.post("/", checkPermission('inventory', 'create'), createRecipe);
router.get("/", getRecipes);
router.get("/sku/:sku", getRecipeBySku);
router.get("/product/:productId/sellable", checkProductSellability);
router.post("/validate", validateRecipe);

// Parametrized routes
router.get("/:id", getRecipeById);
router.put("/:id", checkPermission('inventory', 'update'), updateRecipe);
router.put("/:id/toggle-status", checkPermission('inventory', 'update'), toggleRecipeStatus);
router.delete("/:id", checkPermission('inventory', 'delete'), deleteRecipe);

// Calculo e estoque
router.get("/:id/cost", calculateRecipeCost);
router.get("/:id/stock/check", checkStockAvailability);
router.post("/:id/stock/deduct", checkPermission('inventory', 'adjust'), deductStock);
router.get("/:id/stock/simulate", simulateConsumption);

module.exports = router;
