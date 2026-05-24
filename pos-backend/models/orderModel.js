const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    status: { type: String, default: "pending" },
    // Campos Fase 9.1D — metadados operacionais
    sellableType: { type: String, comment: 'Tipo de venda (product, service_fee, etc.)' },
    stockImpactRule: { type: String, default: 'recipe_composition', comment: 'Regra de impacto em estoque (recipe_composition, stock_item_direct, no_stock_impact, combo_components)' },
    variation: { type: String, comment: 'Variação do produto (ex: P, M, G)' },
    sku: { type: String, comment: 'SKU do produto no momento da venda' },
    pricePerQuantity: { type: Number, comment: 'Preço unitário no momento da venda' },
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
    stockDeductionStatus: { type: String, default: 'pending', enum: ['pending', 'deducted', 'completed', 'not_applicable', 'no_recipe', 'insufficient_stock', 'error'] },
    stockMovements: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StockMovement' }],
    stockDeductionReason: { type: String, maxlength: 500, comment: 'Motivo de erro/soft error na baixa de estoque (Fase 9.1D)' },
    productReadinessStatus: { type: String, comment: 'Status de prontidão do produto no momento da venda (Fase 9.1D)' },
    // Campos Fase 5.5 — reversão por item
    stockReversalStatus: { type: String, default: 'not_applicable', enum: ['not_applicable', 'reversed', 'partial'], comment: 'Reversão por item (Fase 5.5)' },
    stockReversalMovements: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StockMovement', comment: 'Movimentos de reversão do item (Fase 5.5)' }]
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
    stockDeductionStatus: { type: String, default: 'pending', enum: ['pending', 'completed', 'partial', 'failed', 'no_recipes'] },
    stockDeductedAt: { type: Date, comment: 'Timestamp da baixa de estoque (Fase 9.1C)' },
    stockDeductionError: { type: String, maxlength: 500, comment: 'Mensagem de erro da baixa de estoque (Fase 9.1C)' },
    // Campos Fase 5.5 — reversão de baixa
    stockReversalStatus: { type: String, default: 'not_applicable', enum: ['not_applicable', 'pending', 'reversed', 'partial', 'failed'], comment: 'Status da reversão de estoque (Fase 5.5)' },
    stockReversedAt: { type: Date, comment: 'Timestamp da reversão (Fase 5.5)' },
    stockReversalReason: { type: String, maxlength: 500, comment: 'Motivo da reversão (Fase 5.5)' },
    stockReversalMovements: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StockMovement', comment: 'Movimentos de reversão (Fase 5.5)' }]
}, { timestamps: true });

// Compound index for efficient store-scoped order queries
orderSchema.index({ store: 1, orderDate: 1, orderStatus: 1 });

module.exports = mongoose.model("Order", orderSchema);
