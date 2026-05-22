const express = require("express");
const { addTable, getTables, updateTable } = require("../controllers/tableController");
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

module.exports = router;
