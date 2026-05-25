const mongoose = require("mongoose");

const kdsOrderItemSchema = new mongoose.Schema({
    orderItem: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: false
    },
    productName: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'preparing', 'ready', 'served', 'cancelled'],
        default: 'pending'
    },
    station: {
        type: String,
        required: true,
        index: true
    },
    prepTimeMinutes: {
        type: Number,
        default: 15
    },
    startedAt: Date,
    completedAt: Date,
    servedAt: Date,
    notes: String,
    modifiers: [{
        name: String,
        extra: { type: Number, default: 0 }
    }],
    priority: {
        type: String,
        enum: ['normal', 'urgent', 'vip'],
        default: 'normal'
    }
}, { _id: false });

const kdsOrderSchema = new mongoose.Schema({
    kdsOrderId: {
        type: String,
        default: () => `kds_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true
    },
    orderNumber: {
        type: String,
        required: true,
        index: true
    },
    table: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Table'
    },
    tableNumber: String,
    customerName: String,
    orderType: {
        type: String,
        enum: ['dine-in', 'takeout', 'delivery', 'counter', 'pickup'],
        default: 'dine-in'
    },
    items: [kdsOrderItemSchema],
    status: {
        type: String,
        enum: ['pending', 'preparing', 'partially_ready', 'ready', 'served', 'cancelled'],
        default: 'pending',
        index: true
    },
    priority: {
        type: String,
        enum: ['normal', 'urgent', 'vip'],
        default: 'normal',
        index: true
    },
    estimatedReady: {
        type: Date,
        index: true
    },
    actualReady: Date,
    servedAt: Date,
    acceptedAt: Date,
    acceptedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    stations: [{
        station: String,
        status: {
            type: String,
            enum: ['pending', 'preparing', 'ready', 'completed'],
            default: 'pending'
        },
        startedAt: Date,
        completedAt: Date
    }],
    timers: {
        createdAt: {
            type: Date,
            default: Date.now
        },
        acceptedAt: Date,
        firstPrepAt: Date,
        readyAt: Date,
        servedAt: Date
    },
    flags: {
        isRushed: {
            type: Boolean,
            default: false
        },
        isRefire: {
            type: Boolean,
            default: false,
            comment: 'Pedido refeita (cozinha errou)'
        },
        is86: {
            type: Boolean,
            default: false,
            comment: 'Item sem estoque'
        },
        allergyAlert: {
            type: Boolean,
            default: false
        }
    },
    metadata: {
        channel: {
            type: String,
            enum: ['pos', 'kiosk', 'mobile', 'third_party'],
            default: 'pos'
        },
        deviceId: mongoose.Schema.Types.ObjectId,
        notes: String
    }
}, { timestamps: true });

// Índices compostos
kdsOrderSchema.index({ store: 1, status: 1, createdAt: -1 });
kdsOrderSchema.index({ store: 1, table: 1, status: 1 });
kdsOrderSchema.index({ estimatedReady: 1, status: 1 });

// Virtual para tempo decorrido
kdsOrderSchema.virtual('elapsedMinutes').get(function() {
    const start = this.timers?.createdAt || this.createdAt;
    if (!start) return 0;
    return Math.floor((new Date() - start) / 60000);
});

// Virtual para tempo até ficar pronto
kdsOrderSchema.virtual('minutesUntilReady').get(function() {
    if (!this.estimatedReady) return 0;
    return Math.floor((this.estimatedReady - new Date()) / 60000);
});

// Virtual para verificar se está atrasado
kdsOrderSchema.virtual('isLate').get(function() {
    if (!this.estimatedReady) return false;
    return new Date() > this.estimatedReady && this.status !== 'ready' && this.status !== 'served';
});

// Virtual para verificar se é urgente
kdsOrderSchema.virtual('isUrgent').get(function() {
    const elapsed = this.elapsedMinutes;
    const remaining = this.minutesUntilReady;
    return remaining <= 5 && this.status !== 'ready';
});

// Método para aceitar pedido
kdsOrderSchema.methods.accept = async function(userId) {
    this.status = 'preparing';
    this.acceptedAt = new Date();
    this.acceptedBy = userId;
    this.timers.acceptedAt = new Date();
    await this.save();
    return this;
};

// Método para atualizar status de item
kdsOrderSchema.methods.updateItemStatus = async function(itemId, status, station = null) {
    const item = this.items.find(i => i._id.toString() === itemId.toString());
    if (!item) throw new Error('Item not found');

    item.status = status;
    if (station) item.station = station;

    if (status === 'preparing' && !item.startedAt) {
        item.startedAt = new Date();
        this.timers.firstPrepAt = this.timers.firstPrepAt || new Date();
    }

    if (status === 'ready' && !item.completedAt) {
        item.completedAt = new Date();
    }

    // Atualizar status do pedido
    await this.updateOverallStatus();
    await this.save();
    return this;
};

// Método para atualizar status geral
kdsOrderSchema.methods.updateOverallStatus = function() {
    const totalItems = this.items.length;
    const cancelledItems = this.items.filter(i => i.status === 'cancelled').length;
    const readyItems = this.items.filter(i => i.status === 'ready').length;
    const preparingItems = this.items.filter(i => i.status === 'preparing').length;
    const servedItems = this.items.filter(i => i.status === 'served').length;

    if (cancelledItems === totalItems) {
        this.status = 'cancelled';
    } else if (servedItems === totalItems) {
        this.status = 'served';
        this.servedAt = new Date();
        this.timers.servedAt = new Date();
    } else if (readyItems === totalItems - cancelledItems) {
        this.status = 'ready';
        this.actualReady = new Date();
        this.timers.readyAt = new Date();
    } else if (preparingItems > 0 || readyItems > 0) {
        this.status = 'partially_ready';
    } else {
        this.status = 'pending';
    }

    return this.status;
};

// Método para marcar pedido como pronto
kdsOrderSchema.methods.markReady = async function() {
    this.status = 'ready';
    this.actualReady = new Date();
    this.timers.readyAt = new Date();

    // Marcar todos os itens como ready
    this.items.forEach(item => {
        if (item.status !== 'served' && item.status !== 'cancelled') {
            item.status = 'ready';
            item.completedAt = new Date();
        }
    });

    await this.save();
    return this;
};

// Método para marcar pedido como servido
kdsOrderSchema.methods.markServed = async function() {
    this.status = 'served';
    this.servedAt = new Date();
    this.timers.servedAt = new Date();

    this.items.forEach(item => {
        if (item.status !== 'cancelled') {
            item.status = 'served';
            item.servedAt = new Date();
        }
    });

    await this.save();
    return this;
};

// Método para calcular tempo estimado
kdsOrderSchema.methods.calculateEstimatedReady = function() {
    const maxPrepTime = Math.max(...this.items.map(i => i.prepTimeMinutes || 15));
    const startTime = this.acceptedAt || new Date();
    this.estimatedReady = new Date(startTime.getTime() + maxPrepTime * 60000);
    return this.estimatedReady;
};

// Método para adicionar flag de urgência
kdsOrderSchema.methods.rush = async function() {
    this.priority = 'urgent';
    this.flags.isRushed = true;
    await this.save();
    return this;
};

// Método estático para obter pedidos da cozinha
kdsOrderSchema.statics.getKitchenOrders = async function(storeId, station = 'kitchen', options = {}) {
    const { status, tableId, limit = 50 } = options;

    const filter = {
        store: new mongoose.Types.ObjectId(storeId),
        'items.station': station
    };

    if (status) {
        filter.status = status;
    }

    if (tableId) {
        filter.table = new mongoose.Types.ObjectId(tableId);
    }

    return this.find(filter)
        .populate('table', 'name number')
        .populate('order', 'orderStatus')
        .sort({ createdAt: 1 })
        .limit(parseInt(limit));
};

// Método estático para obter estatísticas
kdsOrderSchema.statics.getStationStats = async function(storeId, station) {
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));

    const stats = await this.aggregate([
        {
            $match: {
                store: new mongoose.Types.ObjectId(storeId),
                'items.station': station,
                createdAt: { $gte: today }
            }
        },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgPrepTime: { $avg: { $subtract: ['$timers.readyAt', '$timers.acceptedAt'] } }
            }
        }
    ]);

    const result = {
        pending: 0,
        preparing: 0,
        ready: 0,
        served: 0,
        cancelled: 0,
        avgPrepMinutes: 0
    };

    stats.forEach(s => {
        result[s._id] = s.count;
        if (s._id === 'served' && s.avgPrepTime) {
            result.avgPrepMinutes = Math.round(s.avgPrepTime / 60000);
        }
    });

    return result;
};

module.exports = mongoose.model("KDSOrder", kdsOrderSchema);
