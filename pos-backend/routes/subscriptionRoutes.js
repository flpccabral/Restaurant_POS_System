const express = require("express");
const router = express.Router();
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const {
    getPlans,
    getPlanById,
    getCurrentSubscription,
    createSubscription,
    updateSubscription,
    cancelSubscription,
    reactivateSubscription,
    checkUsageLimits,
    getInvoices,
    getSubscriptionStats,
    seedPlans
} = require("../controllers/subscriptionController");

// Proteger todas as rotas
router.use(isVerifiedUser);

// Rotas públicas (dentro do auth)
router.get("/", getPlans);
router.get("/:id", getPlanById);

// Rotas de assinatura
router.get("/subscription/current", getCurrentSubscription);
router.post("/subscription", createSubscription);
router.put("/subscription", updateSubscription);
router.post("/subscription/cancel", cancelSubscription);
router.post("/subscription/reactivate", reactivateSubscription);
router.get("/subscription/usage", checkUsageLimits);
router.get("/subscription/invoices", getInvoices);

// Admin
router.get("/stats", getSubscriptionStats);
router.post("/seed", seedPlans);

module.exports = router;
