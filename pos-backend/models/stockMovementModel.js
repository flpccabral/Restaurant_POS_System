const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const stockMovementSchema = new mongoose.Schema({
    movementId: {
        type: String,
        default: uuidv4,
        unique: true,
        index: true,
        immutable: true
    },
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: true,
        index: true
    },
    ingredient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GlobalIngredient',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['in', 'out', 'adjustment', 'transfer', 'waste', 'recipe_deduction'],
        required: true,
        index: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    unit: {
        type: String,
        required: true
    },
    balanceBefore: {
        type: Number,
        required: true
    },
    balanceAfter: {
        type: Number,
        required: true
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    reference: {
        type: String,
        index: true,
        comment: 'Referência externa (pedido, receita, etc.)'
    },
    recipe: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recipe',
        comment: 'Receita que causou a baixa (se aplicável)'
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        comment: 'Produto vendido (se aplicável)'
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    notes: {
        type: String,
        maxlength: 1000
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { timestamps: true });

// Índices para consultas
stockMovementSchema.index({ store: 1, ingredient: 1, createdAt: -1 });
stockMovementSchema.index({ store: 1, type: 1, createdAt: -1 });
stockMovementSchema.index({ recipe: 1, createdAt: -1 });

// Método estático para criar movimento
stockMovementSchema.statics.createMovement = async function(data) {
    const Movement = this;
    const StockBalance = mongoose.model('StockBalance');

    // Buscar saldo atual
    let stockBalance = await StockBalance.findOne({
        store: data.store,
        ingredient: data.ingredient
    });

    if (!stockBalance) {
        throw new Error('Stock balance not found for this ingredient');
    }

    const balanceBefore = stockBalance.balance;
    let balanceAfter = balanceBefore;

    // Calcular novo saldo
    if (data.type === 'in') {
        balanceAfter += data.quantity;
    } else if (['out', 'waste', 'recipe_deduction'].includes(data.type)) {
        if (balanceBefore < data.quantity) {
            throw new Error(`Insufficient stock. Available: ${balanceBefore}, Requested: ${data.quantity}`);
        }
        balanceAfter -= data.quantity;
    } else if (data.type === 'adjustment') {
        balanceAfter = data.quantity; // Ajuste direto
    }

    // Criar movimento
    const movement = await Movement.create({
        ...data,
        balanceBefore,
        balanceAfter
    });

    // Atualizar saldo
    stockBalance.balance = balanceAfter;
    await stockBalance.save();

    return movement;
};

// Método estático para histórico de ingrediente
stockMovementSchema.statics.getIngredientHistory = async function(storeId, ingredientId, limit = 50) {
    return this.find({ store: storeId, ingredient: ingredientId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('user', 'name email')
        .populate('ingredient', 'name category');
};

module.exports = mongoose.model("StockMovement", stockMovementSchema);
