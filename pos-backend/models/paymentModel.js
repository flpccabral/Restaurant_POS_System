const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const paymentSchema = new mongoose.Schema({
    paymentId: {
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
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true
    },
    orderNumber: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'BRL'
    },
    method: {
        type: String,
        enum: ['cash', 'credit_card', 'debit_card', 'pix', 'boleto', 'voucher', 'gift_card'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'declined', 'refunded', 'cancelled'],
        default: 'pending',
        index: true
    },
    installments: {
        type: Number,
        min: 1,
        max: 12,
        default: 1,
        comment: 'Número de parcelas (cartão de crédito)'
    },
    cardInfo: {
        brand: String,
        last4: String,
        cardType: {
            type: String,
            enum: ['credit', 'debit']
        }
    },
    pixInfo: {
        qrCode: String,
        txid: String,
        expiresAt: Date
    },
    voucherInfo: {
        provider: String,
        cardNumber: String
    },
    change: {
        type: Number,
        default: 0,
        comment: 'Troco (para pagamento em dinheiro)'
    },
    paidAmount: {
        type: Number,
        comment: 'Valor pago (pode ser maior que amount para troco)'
    },
    gateway: {
        provider: String,
        transactionId: String,
        authorizationCode: String,
        nsu: String
    },
    device: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device'
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    cashier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    session: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CashSession',
        comment: 'Sessão de caixa vinculada'
    },
    notes: String,
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    }
}, { timestamps: true });

// Índices
paymentSchema.index({ store: 1, status: 1, createdAt: -1 });
// index on order already declared via field-level index: true
paymentSchema.index({ method: 1, status: 1 });
paymentSchema.index({ 'gateway.transactionId': 1 }, { unique: true, sparse: true });

// Virtual para verificar se está pago
paymentSchema.virtual('isPaid').get(function() {
    return this.status === 'approved';
});

// Hook para validar pagamento
paymentSchema.pre('save', function(next) {
    if (this.status === 'approved' && !this.paidAmount) {
        this.paidAmount = this.amount;
    }
    if (this.method === 'cash' && this.paidAmount > this.amount) {
        this.change = this.paidAmount - this.amount;
    }
    next();
});

// Método para aprovar pagamento
paymentSchema.methods.approve = async function(gatewayData = {}) {
    this.status = 'approved';
    if (gatewayData.transactionId) {
        this.gateway.transactionId = gatewayData.transactionId;
    }
    if (gatewayData.authorizationCode) {
        this.gateway.authorizationCode = gatewayData.authorizationCode;
    }
    if (gatewayData.nsu) {
        this.gateway.nsu = gatewayData.nsu;
    }
    await this.save();
    return this;
};

// Método para recusar pagamento
paymentSchema.methods.decline = async function(reason) {
    this.status = 'declined';
    this.notes = reason || 'Payment declined';
    await this.save();
    return this;
};

// Método para estornar pagamento
paymentSchema.methods.refund = async function(amount = null, reason = null) {
    if (this.status !== 'approved') {
        throw new Error('Cannot refund non-approved payment');
    }

    this.status = 'refunded';
    this.metadata = this.metadata || new Map();
    this.metadata.set('refundAmount', amount || this.amount);
    this.metadata.set('refundReason', reason);
    this.metadata.set('refundDate', new Date());

    await this.save();
    return this;
};

// Método estático para obter pagamentos da loja
paymentSchema.statics.getStorePayments = async function(storeId, options = {}) {
    const { status, method, limit = 50 } = options;

    const filter = { store: new mongoose.Types.ObjectId(storeId) };

    if (status) {
        filter.status = status;
    }
    if (method) {
        filter.method = method;
    }

    return this.find(filter)
        .populate('order', 'orderNumber table')
        .populate('user', 'name email')
        .populate('cashier', 'name')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));
};

// Método estático para totais por método
paymentSchema.statics.getTotalsByMethod = async function(storeId, startDate, endDate) {
    const result = await this.aggregate([
        {
            $match: {
                store: new mongoose.Types.ObjectId(storeId),
                status: 'approved',
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: '$method',
                total: { $sum: '$amount' },
                count: { $sum: 1 },
                fees: { $sum: '$gateway.fee' }
            }
        }
    ]);

    const totals = {
        cash: { total: 0, count: 0 },
        credit_card: { total: 0, count: 0 },
        debit_card: { total: 0, count: 0 },
        pix: { total: 0, count: 0 },
        voucher: { total: 0, count: 0 },
        total: 0,
        totalCount: 0
    };

    result.forEach(item => {
        totals[item._id] = { total: item.total, count: item.count };
        totals.total += item.total;
        totals.totalCount += item.count;
    });

    return totals;
};

module.exports = mongoose.model("Payment", paymentSchema);
