const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    status: { type: String, default: "pending" },
    // Campos Fase 5 — rastreabilidade de CMV
    recipe: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe', comment: 'Ficha técnica usada para baixa' },
    recipeVersion: { type: Number, comment: 'Versão da ficha técnica usada' },
    cogs: { type: Number, default: 0, comment: 'Custo de mercadoria vendida (CMV) do item' },
    ingredientCosts: [{
        ingredient: { type: mongoose.Schema.Types.ObjectId, ref: 'GlobalIngredient' },
        ingredientName: String,
        quantity: Number,
        unit: String,
        cost: Number,
        balanceBefore: Number,
        balanceAfter: Number
    }],
    stockDeductionStatus: { type: String, default: 'pending', enum: ['pending', 'deducted', 'no_recipe', 'insufficient_stock', 'error'] },
    stockMovements: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StockMovement' }]
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
    },
    // Campos Fase 5 — CMV total e status de baixa
    totalCOGS: { type: Number, default: 0, comment: 'CMV total do pedido (soma dos items)' },
    stockDeductionStatus: { type: String, default: 'pending', enum: ['pending', 'completed', 'partial', 'failed', 'no_recipes'] }
}, { timestamps: true });

// Compound index for efficient store-scoped order queries
orderSchema.index({ store: 1, orderDate: 1, orderStatus: 1 });

module.exports = mongoose.model("Order", orderSchema);
