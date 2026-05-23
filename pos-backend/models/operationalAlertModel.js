const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const operationalAlertSchema = new mongoose.Schema({
    alertId: {
        type: String,
        default: uuidv4,
        unique: true,
        index: true,
        immutable: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            'stockout',
            'critical_stock',
            'low_stock',
            'excess_stock',
            'dead_stock',
            'no_policy',
            'byproduct_available',
            'replenishment_needed',
            'transfer_recommended',
            'refund_without_stock_reversal',
            'sale_without_stock_deduction',
            'product_without_recipe',
            'purchase_registered'
        ],
        index: true
    },
    severity: {
        type: String,
        required: true,
        enum: ['info', 'low', 'medium', 'high', 'critical'],
        default: 'medium',
        index: true
    },
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: true,
        index: true
    },
    location: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StockLocation'
    },
    ingredient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GlobalIngredient',
        index: true
    },
    status: {
        type: String,
        enum: ['new', 'acknowledged', 'resolved', 'dismissed'],
        default: 'new',
        index: true
    },
    message: {
        type: String,
        required: true,
        maxlength: 1000
    },
    currentValue: { type: Number },
    thresholdValue: { type: Number },
    recommendationRef: { type: String },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
    dismissedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dismissedAt: { type: Date },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { timestamps: true });

operationalAlertSchema.index({ store: 1, status: 1, createdAt: -1 });
operationalAlertSchema.index({ type: 1, status: 1, createdAt: -1 });

// Resolve alert
operationalAlertSchema.methods.resolve = function (userId, notes) {
    this.status = 'resolved';
    this.resolvedBy = userId;
    this.resolvedAt = new Date();
    if (notes) {
        this.metadata.resolutionNotes = notes;
    }
    return this.save();
};

// Dismiss alert
operationalAlertSchema.methods.dismiss = function (userId, reason) {
    this.status = 'dismissed';
    this.dismissedBy = userId;
    this.dismissedAt = new Date();
    if (reason) {
        this.metadata.dismissalReason = reason;
    }
    return this.save();
};

// Static: create or update alert (prevent duplicates for same store/type/ingredient within 24h)
operationalAlertSchema.statics.findOrCreate = async function (data) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const existing = await this.findOne({
        store: data.store,
        type: data.type,
        ingredient: data.ingredient || null,
        status: { $in: ['new', 'acknowledged'] },
        createdAt: { $gte: twentyFourHoursAgo }
    });

    if (existing) {
        return existing;
    }

    return this.create(data);
};

// Static: get alerts for a store
operationalAlertSchema.statics.findByStore = async function (storeId, options = {}) {
    const filter = { store: storeId };
    if (options.status) filter.status = options.status;
    if (options.type) filter.type = options.type;
    if (options.ingredient) filter.ingredient = options.ingredient;

    return this.find(filter)
        .populate('ingredient', 'name category baseUnit')
        .populate('location', 'name type')
        .sort({ severity: -1, createdAt: -1 })
        .limit(options.limit || 50);
};

module.exports = mongoose.model("OperationalAlert", operationalAlertSchema);
