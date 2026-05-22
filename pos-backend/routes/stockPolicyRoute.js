const express = require("express");
const {
    createStockPolicy,
    listStockPolicies,
    updateStockPolicy,
    deleteStockPolicy
} = require("../controllers/stockPolicyController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const { storeIsolation } = require("../middlewares/storeIsolation");
const { deviceApproval } = require("../middlewares/deviceApproval");
const { checkPermission } = require("../middlewares/checkPermission");

const router = express.Router();

// Middleware chain
router.use(isVerifiedUser);
router.use(storeIsolation);
router.use(deviceApproval);

// Stock Policy CRUD
router.route("/")
    .post(checkPermission('inventory', 'adjust'), createStockPolicy)
    .get(checkPermission('inventory', 'read'), listStockPolicies);

router.route("/:id")
    .put(checkPermission('inventory', 'adjust'), updateStockPolicy)
    .delete(checkPermission('inventory', 'adjust'), deleteStockPolicy);

module.exports = router;
