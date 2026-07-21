const express = require("express");
const router = express.Router();
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const { createOrder, verifyPayment, webHookVerification, getPayments } = require("../controllers/paymentController");

// Listar pagamentos
router.route("/").get(isVerifiedUser, getPayments);

router.route("/create-order").post(isVerifiedUser , createOrder);
router.route("/verify-payment").post(isVerifiedUser , verifyPayment);
router.route("/webhook-verification").post(webHookVerification);


module.exports = router;