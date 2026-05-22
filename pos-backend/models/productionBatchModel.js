const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

// --- Sub-schemas ---

const productionInputSchema = new mongoose.Schema({
    ingredient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GlobalIngredient',
        required: true
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
    costAllocated: {
        type: Number,
        default: 0,
        min: 0
    }
}, { _id: false });

const productionOutputSchema = new mongoose.Schema({
    ingredient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GlobalIngredient',
        required: true
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
    outputType: {
        type: String,
        enum: ['main_output', 'byproduct', 'waste', 'loss', 'rework', 'transferable_surplus'],
        required: true
    },
    costAllocated: {
        type: Number,
        default: 0,
        min: 0
    },
    destinationLocation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StockLocation',
        comment: 'Para onde o output vai (se diferente da location do batch)'
    }
}, { _id: false });

// --- Main schema ---

const productionBatchSchema = new mongoose.Schema({
    batchId: {
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
    location: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StockLocation',
        required: true,
        comment: 'Estoque local onde a produção ocorreu'
    },
    status: {
        type: String,
        enum: ['draft', 'in_progress', 'completed', 'cancelled'],
        default: 'draft',
        index: true
    },
    // Inputs (o que foi consumido)
    inputs: {
        type: [productionInputSchema],
        default: [],
        validate: {
            validator: function(inputs) {
                return inputs.length > 0;
            },
            message: 'Production batch must have at least one input'
        }
    },
    // Outputs (o que foi gerado)
    outputs: {
        type: [productionOutputSchema],
        default: [],
        validate: {
            validator: function(outputs) {
                return outputs.length > 0;
            },
            message: 'Production batch must have at least one output'
        }
    },
    // Rendimento
    yieldPercentage: {
        type: Number,
        comment: '(output principal total / input total) * 100 — calculado automaticamente'
    },
    // Custos
    totalInputCost: {
        type: Number,
        default: 0,
        min: 0
    },
    totalOutputCost: {
        type: Number,
        default: 0,
        min: 0
    },
    // Responsável
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // Produção opcionalmente vinculada a uma receita de produção
    productionRecipe: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recipe',
        comment: 'Receita de produção usada como template (opcional)'
    },
    // Timestamps e observações
    startedAt: {
        type: Date
    },
    completedAt: {
        type: Date
    },
    observations: {
        type: String,
        maxlength: 2000
    }
}, { timestamps: true });

productionBatchSchema.index({ store: 1, status: 1, createdAt: -1 });
productionBatchSchema.index({ store: 1, location: 1, createdAt: -1 });

// --- Instance methods ---

productionBatchSchema.methods.complete = function() {
    this.status = 'completed';
    this.completedAt = new Date();
};

productionBatchSchema.methods.cancel = function() {
    if (this.status === 'completed') {
        throw new Error('Cannot cancel a completed production batch');
    }
    this.status = 'cancelled';
};

// --- Statics ---

productionBatchSchema.statics.getCompletedByStore = async function(storeId, options = {}) {
    const { limit = 30, startDate, endDate } = options;
    const filter = { store: storeId, status: 'completed' };
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    return this.find(filter)
        .populate('inputs.ingredient', 'name itemType productionState')
        .populate('outputs.ingredient', 'name itemType productionState isByproduct')
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .limit(limit);
};

productionBatchSchema.statics.getAvailableByproducts = async function(storeId) {
    return this.find({
        store: storeId,
        status: 'completed',
        'outputs.outputType': { $in: ['byproduct', 'transferable_surplus'] }
    })
    .populate('outputs.ingredient', 'name itemType productionState compatibleOperations')
    .populate('outputs.destinationLocation', 'name type store')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model("ProductionBatch", productionBatchSchema);
