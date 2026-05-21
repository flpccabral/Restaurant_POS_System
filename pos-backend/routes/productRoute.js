const express = require("express");
const {
    createProduct,
    getProducts,
    getProductById,
    getProductBySku,
    updateProduct,
    addVariation,
    updateVariation,
    removeVariation,
    deleteProduct
} = require("../controllers/productController");
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
router.post("/", checkPermission('products', 'create'), createProduct);
router.get("/", getProducts);
router.get("/sku/:sku", getProductBySku);
router.get("/:id", getProductById);
router.put("/:id", checkPermission('products', 'update'), updateProduct);
router.post("/:id/variations", checkPermission('products', 'update'), addVariation);
router.put("/:id/variations/:variationId", checkPermission('products', 'update'), updateVariation);
router.delete("/:id/variations/:variationId", checkPermission('products', 'delete'), removeVariation);
router.delete("/:id", checkPermission('products', 'delete'), deleteProduct);

module.exports = router;
