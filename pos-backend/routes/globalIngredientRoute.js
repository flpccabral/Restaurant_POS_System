const express = require("express");
const {
    createIngredient,
    getIngredients,
    getIngredientById,
    updateIngredient,
    toggleIngredientStatus,
    deleteIngredient
} = require("../controllers/globalIngredientController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const { deviceApproval } = require("../middlewares/deviceApproval");
const { checkPermission } = require("../middlewares/checkPermission");
const router = express.Router();

// Todas as rotas requerem autenticação + device approval
router.use(isVerifiedUser);
router.use(deviceApproval);

// Rotas
router.post("/", checkPermission('ingredients', 'create'), createIngredient);
router.get("/", getIngredients);
router.get("/:id", getIngredientById);
router.put("/:id", checkPermission('ingredients', 'update'), updateIngredient);
router.put("/:id/toggle-status", checkPermission('ingredients', 'update'), toggleIngredientStatus);
router.delete("/:id", checkPermission('ingredients', 'delete'), deleteIngredient);

module.exports = router;
