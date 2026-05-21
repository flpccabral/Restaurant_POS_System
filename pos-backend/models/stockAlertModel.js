const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const stockAlertSchema = new mongoose.Schema({
    alertId: {
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
        enum: ['low_stock', 'out_of_stock', 'expiring_soon', 'expired'],
        required: true,
        index: true
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    currentBalance: {
        type: Number,
        required: true
    },
    minimumStock: {
        type: Number,
        required: true
    },
    suggestedQuantity: {
        type: Number,
        comment: 'Quantidade sugerida para compra'
    },
    status: {
        type: String,
        enum: ['pending', 'acknowledged', 'resolved', 'dismissed'],
        default: 'pending',
        index: true
    },
    resolvedAt: Date,
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    resolvedNotes: {
        type: String,
        maxlength: 500
    },
    purchaseOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PurchaseOrder',
        comment: 'Pedido de compra vinculado'
    }
}, { timestamps: true });

// Índices compostos
stockAlertSchema.index({ store: 1, status: 1, createdAt: -1 });
stockAlertSchema.index({ store: 1, type: 1, status: 1 });

// Método estático para verificar e criar alertas
stockAlertSchema.statics.checkAndCreateAlerts = async function(storeId) {
    const StockBalance = mongoose.model('StockBalance');
    const Alert = this;

    // Buscar ingredientes abaixo do mínimo
    const lowStockItems = await StockBalance.find({
        store: storeId,
        isActive: { $ne: false }
    })
    .populate('ingredient', 'name category')
    .exec();

    const alerts = [];

    for (const item of lowStockItems) {
        if (item.available <= item.minimumStock) {
            // Verificar se já existe alerta pendente
            const existingAlert = await Alert.findOne({
                store: storeId,
                ingredient: item.ingredient,
                status: { $in: ['pending', 'acknowledged'] }
            });

            if (!existingAlert) {
                const type = item.available === 0 ? 'out_of_stock' : 'low_stock';
                const severity = item.available === 0 ? 'critical' :
                                 item.available <= item.minimumStock * 0.5 ? 'high' : 'medium';

                const alert = await Alert.create({
                    store: storeId,
                    ingredient: item.ingredient,
                    type,
                    severity,
                    currentBalance: item.available,
                    minimumStock: item.minimumStock,
                    suggestedQuantity: item.minimumStock * 3 - item.available // Sugere 3x o mínimo
                });

                alerts.push(alert);
            }
        }
    }

    return alerts;
};

// Método estático para obter alertas por loja
stockAlertSchema.statics.getStoreAlerts = async function(storeId, options = {}) {
    const filter = { store: storeId };

    if (options.status) {
        filter.status = options.status;
    }
    if (options.type) {
        filter.type = options.type;
    }
    if (options.severity) {
        filter.severity = options.severity;
    }

    return this.find(filter)
        .populate('ingredient', 'name category unit')
        .populate('resolvedBy', 'name email')
        .sort({ severity: 1, createdAt: -1 });
};

// Método para reconhecer alerta
stockAlertSchema.methods.acknowledge = async function(userId) {
    this.status = 'acknowledged';
    await this.save();
    return this;
};

// Método para resolver alerta
stockAlertSchema.methods.resolve = async function(userId, notes = null) {
    this.status = 'resolved';
    this.resolvedAt = new Date();
    this.resolvedBy = userId;
    if (notes) {
        this.resolvedNotes = notes;
    }
    await this.save();
    return this;
};

module.exports = mongoose.model("StockAlert", stockAlertSchema);
