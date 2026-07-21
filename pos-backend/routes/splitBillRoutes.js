const express = require("express");
const router = express.Router();
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const {
    calculateSplit,
    createSplitBill,
    processSplitPayment,
    closeSplitBill,
    getSplits
} = require("../controllers/splitBillController");

// Proteger todas as rotas
router.use(isVerifiedUser);

// Listar splits ativos
router.get("/", getSplits);

// Rotas vinculadas a mesa
router.post("/table/:tableId/calculate", calculateSplit);
router.post("/table/:tableId/split", createSplitBill);

// Rotas de execucao da divisao
router.post("/:splitId/payments/:paymentId", processSplitPayment);
router.post("/:splitId/close", closeSplitBill);

module.exports = router;
