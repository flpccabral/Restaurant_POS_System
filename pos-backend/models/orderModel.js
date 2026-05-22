const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    status: { type: String, default: "pending" }
}, { _id: true });

const orderSchema = new mongoose.Schema({
    // MULTI-TENANCY FIX: Renamed from storeId → store for consistency with all other models
    store: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    customerDetails: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        guests: { type: Number, required: true },
    },
    orderStatus: {
        type: String,
        required: true,
        index: true
    },
    orderDate: {
        type: Date,
        default: Date.now,
        index: true
    },
    bills: {
        total: { type: Number, required: true },
        tax: { type: Number, required: true },
        totalWithTax: { type: Number, required: true }
    },
    items: [orderItemSchema],
    table: { type: mongoose.Schema.Types.ObjectId, ref: "Table" },
    paymentMethod: String,
    paymentData: {
        razorpay_order_id: String,
        razorpay_payment_id: String
    }
}, { timestamps: true });

// Compound index for efficient store-scoped order queries
orderSchema.index({ store: 1, orderDate: 1, orderStatus: 1 });

module.exports = mongoose.model("Order", orderSchema);
