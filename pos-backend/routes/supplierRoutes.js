const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const {
    getSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    toggleSupplierStatus,
    deleteSupplier,
    getSupplierStats
} = require("../controllers/supplierController");

// Proteger todas as rotas
router.use(authMiddleware);

// Rotas
router.get("/", getSuppliers);
router.get("/stats/:id", getSupplierStats);
router.get("/:id", getSupplierById);
router.post("/", createSupplier);
router.put("/:id", updateSupplier);
router.patch("/:id/status", toggleSupplierStatus);
router.delete("/:id", deleteSupplier);

module.exports = router;
