const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const cashSessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        default: uuidv4,
        unique: true,
        index: true,
        immutable: true
    },
    sessionNumber: {
        type: String,
        required: true,
        comment: 'Número sequencial da sessão'
    },
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: true,
        index: true
    },
    cashier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    device: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device'
    },
    status: {
        type: String,
        enum: ['open', 'closed', 'suspended'],
        default: 'open',
        index: true
    },
    openedAt: {
        type: Date,
        required: true,
        default: Date.now
    },
    closedAt: Date,
    closedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    initialBalance: {
        type: Number,
        required: true,
        default: 0,
        comment: 'Fundo de troco inicial'
    },
    finalBalance: {
        type: Number,
        default: 0,
        comment: 'Saldo final conferido'
    },
    expectedBalance: {
        type: Number,
        default: 0,
        comment: 'Saldo esperado pelo sistema'
    },
    difference: {
        type: Number,
        default: 0,
        comment: 'Diferença entre esperado e conferido (quebra de caixa)'
    },
    movements: [{
        type: {
            type: String,
            enum: ['sangria', 'suprimento', 'abertura', 'fechamento', 'pagamento', 'cancelamento'],
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        method: {
            type: String,
            enum: ['cash', 'credit_card', 'debit_card', 'pix', 'voucher']
        },
        description: String,
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        metadata: mongoose.Schema.Types.Mixed
    }],
    payments: [{
        payment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Payment'
        },
        orderNumber: String,
        amount: Number,
        method: String,
        createdAt: Date
    }],
    totals: {
        cash: { type: Number, default: 0 },
        credit_card: { type: Number, default: 0 },
        debit_card: { type: Number, default: 0 },
        pix: { type: Number, default: 0 },
        voucher: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        refunds: { type: Number, default: 0 },
        cancellations: { type: Number, default: 0 }
    },
    observations: {
        opening: String,
        closing: String
    },
    signed: {
        cashier: Boolean,
        manager: Boolean
    }
}, { timestamps: true });

// Índices
cashSessionSchema.index({ store: 1, cashier: 1, status: 1 });
cashSessionSchema.index({ store: 1, openedAt: -1 });
cashSessionSchema.index({ sessionNumber: 1 }, { unique: true });

// Hook para atualizar totals ao salvar
cashSessionSchema.pre('save', async function(next) {
    if (this.isModified('movements') || this.isModified('payments')) {
        // Recalcular totais
        const totals = {
            cash: 0,
            credit_card: 0,
            debit_card: 0,
            pix: 0,
            voucher: 0,
            total: 0,
            refunds: 0,
            cancellations: 0
        };

        // Somar pagamentos
        this.payments.forEach(p => {
            if (p.method === 'cash') totals.cash += p.amount;
            else if (p.method === 'credit_card') totals.credit_card += p.amount;
            else if (p.method === 'debit_card') totals.debit_card += p.amount;
            else if (p.method === 'pix') totals.pix += p.amount;
            else if (p.method === 'voucher') totals.voucher += p.amount;
            totals.total += p.amount;
        });

        // Subtrair sangrias
        this.movements.forEach(m => {
            if (m.type === 'sangria') {
                if (m.method === 'cash') totals.cash -= m.amount;
                totals.total -= m.amount;
            }
            if (m.type === 'suprimento') {
                if (m.method === 'cash') totals.cash += m.amount;
                totals.total += m.amount;
            }
        });

        this.totals = totals;
        this.expectedBalance = this.initialBalance + totals.total;
    }
    next();
});

// Método para abrir sessão
cashSessionSchema.methods.open = async function(initialBalance = 0) {
    if (this.status !== 'open') {
        throw new Error(`Session is not open: ${this.status}`);
    }

    this.initialBalance = initialBalance;
    this.openedAt = new Date();

    // Registrar movimento de abertura
    this.movements.push({
        type: 'abertura',
        amount: initialBalance,
        method: 'cash',
        description: 'Fundo de troco inicial',
        user: this.cashier
    });

    await this.save();
    return this;
};

// Método para adicionar sangria (retirada de dinheiro)
cashSessionSchema.methods.sangria = async function(amount, description, userId) {
    if (this.status !== 'open') {
        throw new Error('Session is not open');
    }

    if (amount > this.totals.cash) {
        throw new Error('Insufficient cash for sangria');
    }

    this.movements.push({
        type: 'sangria',
        amount,
        method: 'cash',
        description: description || 'Sangria de caixa',
        user: userId
    });

    await this.save();
    return this;
};

// Método para adicionar suprimento (entrada de dinheiro)
cashSessionSchema.methods.suprimento = async function(amount, description, userId) {
    if (this.status !== 'open') {
        throw new Error('Session is not open');
    }

    this.movements.push({
        type: 'suprimento',
        amount,
        method: 'cash',
        description: description || 'Suprimento de caixa',
        user: userId
    });

    await this.save();
    return this;
};

// Método para registrar pagamento
cashSessionSchema.methods.addPayment = async function(paymentData) {
    if (this.status !== 'open') {
        throw new Error('Session is not open');
    }

    this.payments.push({
        payment: paymentData.paymentId,
        orderNumber: paymentData.orderNumber,
        amount: paymentData.amount,
        method: paymentData.method,
        createdAt: new Date()
    });

    await this.save();
    return this;
};

// Método para fechar sessão
cashSessionSchema.methods.close = async function(finalBalance, observations, userId) {
    if (this.status !== 'open') {
        throw new Error('Session is not open');
    }

    this.finalBalance = finalBalance;
    this.difference = finalBalance - this.expectedBalance;
    this.observations.closing = observations;
    this.closedAt = new Date();
    this.closedBy = userId;
    this.status = 'closed';

    // Registrar movimento de fechamento
    this.movements.push({
        type: 'fechamento',
        amount: finalBalance,
        method: 'cash',
        description: observations || 'Fechamento de caixa',
        user: userId,
        metadata: {
            expectedBalance: this.expectedBalance,
            difference: this.difference
        }
    });

    await this.save();
    return this;
};

// Método para obter resumo
cashSessionSchema.methods.getSummary = function() {
    return {
        sessionId: this.sessionId,
        sessionNumber: this.sessionNumber,
        cashier: this.cashier,
        status: this.status,
        openedAt: this.openedAt,
        closedAt: this.closedAt,
        duration: this.closedAt ?
            Math.round((this.closedAt - this.openedAt) / 60000) : // minutos
            Math.round((new Date() - this.openedAt) / 60000),
        initialBalance: this.initialBalance,
        expectedBalance: this.expectedBalance,
        finalBalance: this.finalBalance,
        difference: this.difference,
        totals: this.totals,
        movementsCount: this.movements.length,
        paymentsCount: this.payments.length
    };
};

// Método estático para sessão aberta do caixa
cashSessionSchema.statics.getActiveSession = async function(storeId, cashierId) {
    return this.findOne({
        store: new mongoose.Types.ObjectId(storeId),
        cashier: new mongoose.Types.ObjectId(cashierId),
        status: 'open'
    }).sort({ openedAt: -1 });
};

// Método estático para gerar número de sessão
cashSessionSchema.statics.generateSessionNumber = async function() {
    const today = new Date();
    const prefix = today.toISOString().split('T')[0].replace(/-/g, '');

    const lastSession = await this.findOne({
        sessionNumber: new RegExp(`^${prefix}`)
    }).sort({ sessionNumber: -1 });

    let sequence = 1;
    if (lastSession && lastSession.sessionNumber) {
        const lastSeq = parseInt(lastSession.sessionNumber.slice(-3));
        sequence = lastSeq + 1;
    }

    return `${prefix}${String(sequence).padStart(3, '0')}`;
};

module.exports = mongoose.model("CashSession", cashSessionSchema);
