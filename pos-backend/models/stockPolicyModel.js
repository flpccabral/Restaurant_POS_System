const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const stockPolicySchema = new mongoose.Schema({
    policyId: {
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
        index: true
    },
    ingredient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GlobalIngredient',
        required: true,
        index: true
    },
    minQuantity: {
        type: Number,
        required: true,
        min: 0
    },
    reorderPoint: {
        type: Number,
        required: true,
        min: 0
    },
    idealQuantity: {
        type: Number,
        required: true,
        min: 0
    },
    maxQuantity: {
        type: Number,
        required: true,
        min: 0
    },
    unit: {
        type: String,
        required: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    }
}, { timestamps: true });

// Unique compound: one policy per store/location/ingredient
stockPolicySchema.index({ store: 1, location: 1, ingredient: 1 }, { unique: true });

// Validation: min <= reorder <= ideal <= max
stockPolicySchema.pre('validate', function (next) {
    if (this.minQuantity > this.reorderPoint) {
        this.invalidate('minQuantity', 'minQuantity must be <= reorderPoint');
    }
    if (this.reorderPoint > this.idealQuantity) {
        this.invalidate('reorderPoint', 'reorderPoint must be <= idealQuantity');
    }
    if (this.idealQuantity > this.maxQuantity) {
        this.invalidate('idealQuantity', 'idealQuantity must be <= maxQuantity');
    }
    next();
});

// Static: get policy for a store/location/ingredient
stockPolicySchema.statics.findByStoreLocationIngredient = async function (storeId, locationId, ingredientId) {
    return this.findOne({
        store: storeId,
        location: locationId,
        ingredient: ingredientId,
        isActive: true
    });
};

// Static: get all policies for a store
stockPolicySchema.statics.findByStore = async function (storeId, options = {}) {
    const filter = { store: storeId, isActive: true };
    if (options.location) filter.location = options.location;
    if (options.ingredient) filter.ingredient = options.ingredient;

    return this.find(filter)
        .populate('ingredient', 'name category baseUnit itemType productionState')
        .populate('location', 'name type')
        .sort({ priority: -1, createdAt: -1 })
        .limit(options.limit || 100);
};

module.exports = mongoose.model("StockPolicy", stockPolicySchema);
