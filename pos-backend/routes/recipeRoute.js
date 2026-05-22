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

// CRUD
router.post("/", checkPermission('inventory', 'create'), createRecipe);
router.get("/", getRecipes);
router.get("/sku/:sku", getRecipeBySku);
router.get("/:id", getRecipeById);
router.put("/:id", checkPermission('inventory', 'update'), updateRecipe);
router.put("/:id/toggle-status", checkPermission('inventory', 'update'), toggleRecipeStatus);
router.delete("/:id", checkPermission('inventory', 'delete'), deleteRecipe);

// Calculo e estoque
router.get("/:id/cost", calculateRecipeCost);
router.get("/:id/stock/check", checkStockAvailability);
router.post("/:id/stock/deduct", checkPermission('inventory', 'adjust'), deductStock);

// Validacao e vendabilidade
router.post("/validate", validateRecipe);
router.get("/without-recipe", getProductsWithoutRecipe);
router.get("/sellable", getSellableProducts);
router.get("/non-sellable", getNonSellableProducts);
router.get("/product/:productId/sellable", checkProductSellability);
router.get("/:id/stock/simulate", simulateConsumption);

module.exports = router;
