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
        index: true,
        comment: 'Contexto operacional. Opcional — movimentacoes no estoque central compartilhado podem nao ter store.'
    },
    location: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StockLocation',
        required: true,
        index: true,
        comment: 'Localizacao onde a movimentacao ocorreu (afetada)'
    },
    originLocation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StockLocation',
        index: true,
        comment: 'Localizacao de origem (para transferencias)'
    },
    destinationLocation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StockLocation',
        index: true,
        comment: 'Localizacao de destino (para transferencias)'
    },
    ingredient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GlobalIngredient',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: [
            'purchase_receipt',
            'transfer_out',
            'transfer_in',
            'recipe_deduction',
            'adjustment',
            'waste',
            'inventory_count_adjustment',
            // Fase 5.1A — movimentos de produção
            'production_consumption',
            'production_output',
            'production_byproduct',
            'production_waste'
        ],
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
        comment: 'Referencia externa (pedido, receita, etc.)'
    },
    recipe: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recipe',
        comment: 'Receita que causou a baixa (se aplicavel)'
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        comment: 'Produto vendido (se aplicavel)'
    },
    productionBatch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductionBatch',
        comment: 'Vincula movimento a uma producao interna (Fase 5.1A)'
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

// Validacoes por tipo de movimentacao
stockMovementSchema.pre('validate', function(next) {
    // Transferencias exigem origem e destino
    if ((this.type === 'transfer_out' || this.type === 'transfer_in') && (!this.originLocation || !this.destinationLocation)) {
        return next(new Error(`StockMovement of type ${this.type} requires originLocation and destinationLocation`));
    }

    // Baixas por venda/receita exigem store (estoque local da loja)
    if ((this.type === 'recipe_deduction' || this.type === 'waste') && !this.store) {
        return next(new Error(`StockMovement of type ${this.type} requires a store reference`));
    }

    next();
});

// Indices — store pode ser null, usar sparse
stockMovementSchema.index({ store: 1, location: 1, ingredient: 1, createdAt: -1 }, { sparse: true });
stockMovementSchema.index({ store: 1, type: 1, createdAt: -1 }, { sparse: true });
stockMovementSchema.index({ originLocation: 1, createdAt: -1 }, { sparse: true });
stockMovementSchema.index({ destinationLocation: 1, createdAt: -1 }, { sparse: true });
stockMovementSchema.index({ recipe: 1, createdAt: -1 }, { sparse: true });
stockMovementSchema.index({ productionBatch: 1, createdAt: -1 }, { sparse: true });
stockMovementSchema.index({ location: 1, ingredient: 1, createdAt: -1 });

// Metodo estatico para criar movimento
stockMovementSchema.statics.createMovement = async function(data) {
    const Movement = this;
    const StockBalance = mongoose.model('StockBalance');

    // Buscar saldo atual por localizacao + ingrediente
    let stockBalance = await StockBalance.findOne({
        location: data.location,
        ingredient: data.ingredient
    });

    if (!stockBalance) {
        throw new Error('Stock balance not found for this ingredient at this location');
    }

    const balanceBefore = stockBalance.balance;
    let balanceAfter = balanceBefore;

    // Calcular novo saldo
    if (data.type === 'purchase_receipt' || data.type === 'transfer_in' || data.type === 'inventory_count_adjustment' || data.type === 'production_output' || data.type === 'production_byproduct') {
        balanceAfter += data.quantity;
    } else if (['recipe_deduction', 'waste', 'transfer_out', 'adjustment', 'production_consumption', 'production_waste'].includes(data.type)) {
        if (balanceBefore < data.quantity) {
            throw new Error(`Insufficient stock. Available: ${balanceBefore}, Requested: ${data.quantity}`);
        }
        balanceAfter -= data.quantity;
    }

    // Criar movimento
    const movement = await Movement.create({
        store: data.store || null,
        location: data.location,
        originLocation: data.originLocation || null,
        destinationLocation: data.destinationLocation || null,
        ingredient: data.ingredient,
        type: data.type,
        quantity: data.quantity,
        unit: data.unit,
        reason: data.reason,
        reference: data.reference || null,
        recipe: data.recipe || null,
        product: data.product || null,
        productionBatch: data.productionBatch || null,
        user: data.user,
        notes: data.notes,
        metadata: data.metadata || {}
    });

    // Atualizar saldo
    stockBalance.balance = balanceAfter;
    await stockBalance.save();

    return movement;
};

// Metodo estatico para historico de ingrediente por localizacao
stockMovementSchema.statics.getIngredientHistory = async function(storeId, locationId, ingredientId, limit = 50) {
    const filter = { location: locationId, ingredient: ingredientId };
    if (storeId) {
        filter.store = storeId;
    }
    return this.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('user', 'name email')
        .populate('ingredient', 'name category')
        .populate('location', 'name type')
        .populate('originLocation', 'name type')
        .populate('destinationLocation', 'name type');
};

module.exports = mongoose.model("StockMovement", stockMovementSchema);
