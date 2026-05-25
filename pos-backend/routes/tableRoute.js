const express = require("express");
const { addTable, getTables, updateTable, closeTable, getTableBill } = require("../controllers/tableController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const { storeIsolation } = require("../middlewares/storeIsolation");
const { checkPermission } = require("../middlewares/checkPermission");
const router = express.Router();

// MULTI-TENANCY FIX: All table routes now require storeIsolation middleware

router.route("/")
  .post(isVerifiedUser, storeIsolation, checkPermission("tables", "create"), addTable)
  .get(isVerifiedUser, storeIsolation, checkPermission("tables", "read"), getTables);

router.route("/:id")
  .put(isVerifiedUser, storeIsolation, checkPermission("tables", "update"), updateTable);

// Fase 9.3C — Fechar mesa (PDV closing/payment)
router.post("/:id/close", isVerifiedUser, storeIsolation, checkPermission("tables", "update"), closeTable);

// Fase 9.3C — Obter conta acumulada da mesa
router.get("/:id/bill", isVerifiedUser, storeIsolation, checkPermission("tables", "read"), getTableBill);

module.exports = router;
