const Razorpay = require("razorpay");
const config = require("../config/config");
const crypto = require("crypto");
const Payment = require("../models/paymentModel");

const createOrder = async (req, res, next) => {
  const razorpay = new Razorpay({
    key_id: config.razorpayKeyId,
    key_secret: config.razorpaySecretKey,
  });

  try {
    const { amount } = req.body;
    const options = {
      amount: amount * 100, // Amount in paisa (1 INR = 100 paisa)
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.status(200).json({ success: true, order });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const expectedSignature = crypto
      .createHmac("sha256", config.razorpaySecretKey)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      res.json({ success: true, message: "Payment verified successfully!" });
    } else {
      const error = createHttpError(400, "Payment verification failed!");
      return next(error);
    }
  } catch (error) {
    next(error);
  }
};

const webHookVerification = async (req, res, next) => {
  try {
    const secret = config.razorpyWebhookSecret;
    const signature = req.headers["x-razorpay-signature"];

    const body = JSON.stringify(req.body);

    // 🛑 Verify the signature
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (expectedSignature === signature) {
      console.log("✅ Webhook verified:", req.body);

      // ✅ Process payment (e.g., update DB, send confirmation email)
      if (req.body.event === "payment.captured") {
        const payment = req.body.payload.payment.entity;
        console.log(`💰 Payment Captured: ${payment.amount / 100} INR`);

        // Add Payment Details in Database
        const newPayment = new Payment({
          paymentId: payment.id,
          orderId: payment.order_id,
          amount: payment.amount / 100,
          currency: payment.currency,
          status: payment.status,
          method: payment.method,
          email: payment.email,
          contact: payment.contact,
          createdAt: new Date(payment.created_at * 1000)
        })

        await newPayment.save();
      }

      res.json({ success: true });
    } else {
      const error = createHttpError(400, "❌ Invalid Signature!");
      return next(error);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Listar pagamentos da loja
 * GET /api/payment
 *
 * Query params:
 * - status: filter by status
 * - method: filter by method
 * - startDate: filter by start date
 * - endDate: filter by end date
 * - limit: max results (default 50)
 */
const getPayments = async (req, res, next) => {
  try {
    const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;
    const { status, method, startDate, endDate, limit = 50 } = req.query;

    const filter = { store: storeRef };

    if (status) filter.status = status;
    if (method) filter.method = method;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const payments = await Payment.find(filter)
      .populate('order', 'orderNumber customerDetails bills')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Calcular totais por método
    const totalsByMethod = {};
    payments.forEach(p => {
      const m = p.method || 'unknown';
      if (!totalsByMethod[m]) {
        totalsByMethod[m] = { total: 0, count: 0 };
      }
      totalsByMethod[m].total += p.amount || 0;
      totalsByMethod[m].count += 1;
    });

    // Total geral
    const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    res.status(200).json({
      success: true,
      count: payments.length,
      data: {
        payments,
        totalAmount,
        totalsByMethod
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createOrder, verifyPayment, webHookVerification, getPayments };
