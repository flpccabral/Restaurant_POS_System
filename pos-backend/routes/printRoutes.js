const express = require("express");
const router = express.Router();
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const {
    createPrinter,
    getPrinters,
    updatePrinter,
    deletePrinter,
    printReceipt,
    testPrinter
} = require("../controllers/printerController");

// Proteger todas as rotas
router.use(isVerifiedUser);

// Gerenciamento de impressoras
router.get("/printers", getPrinters);
router.post("/printers", createPrinter);
router.put("/printers/:id", updatePrinter);
router.delete("/printers/:id", deletePrinter);

// Teste de conexao
router.post("/printers/:id/test", testPrinter);

// Impressao de cupom/comanda
router.post("/receipt", printReceipt);

module.exports = router;
