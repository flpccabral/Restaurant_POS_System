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
        cancellations: { type: Number, default: 0 },
        sangrias: { type: Number, default: 0 },
        supplies: { type: Number, default: 0 }
    },
    observations: {
        opening: String,
        closing: String
    },
    signed: {
        cashier: Boolean,
        manager: Boolean
    },
    // Transações unificadas (substitui movements e payments)
    transactions: [{
        type: {
            type: String,
            enum: [
                'opening',        // Abertura (saldo inicial)
                'closing',        // Fechamento (conferência)
                'sale_cash',      // Venda em dinheiro
                'sale_pix',       // Venda em PIX
                'sale_credit',    // Venda em crédito
                'sale_debit',     // Venda em débito
                'sale_voucher',   // Venda em voucher
                'sangria',        // Retirada de dinheiro
                'supply',         // Reforço de dinheiro
                'adjustment',     // Ajuste manual (supervisor)
            ],
            required: true
        },
        value: {
            type: Number,
            required: true
        },
        paymentMethod: {
            type: String,
            enum: ['cash', 'pix', 'credit_card', 'debit_card', 'voucher']
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order'
        },
        orderNumber: String,
        description: String,
        reason: String,
        operatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        metadata: mongoose.Schema.Types.Mixed
    }],
    // Resumo do fechamento (preenchido no ato)
    closingSummary: {
        expectedCash: { type: Number },
        actualCash: { type: Number },
        difference: { type: Number },
        differenceReason: { type: String },
        confirmedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            comment: 'Supervisor que aprovou (para diferenças > R$50)'
        },
        confirmedAt: { type: Date },
        approved: { type: Boolean, default: false },
        notes: { type: String }
    },
    forced: {
        type: Boolean,
        default: false,
        comment: 'Fechamento forçado pelo sistema (cron meia-noite)'
    },
    // Manter movements e payments para compatibilidade (deprecated)
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
    }]
}, { timestamps: true });

// Índices
cashSessionSchema.index({ store: 1, cashier: 1, status: 1 });
cashSessionSchema.index({ store: 1, openedAt: -1 });
cashSessionSchema.index({ sessionNumber: 1 }, { unique: true });

// Hook para atualizar totals ao salvar
cashSessionSchema.pre('save', async function(next) {
    if (this.isModified('transactions') || this.isModified('movements') || this.isModified('payments')) {
        // Recalcular totais
        const totals = {
            cash: 0,
            credit_card: 0,
            debit_card: 0,
            pix: 0,
            voucher: 0,
            total: 0,
            refunds: 0,
            cancellations: 0,
            sangrias: 0,
            supplies: 0
        };

        // Processar transactions unificadas
        if (this.transactions && this.transactions.length > 0) {
            this.transactions.forEach(t => {
                if (t.type.startsWith('sale_')) {
                    // Vendas
                    const method = t.paymentMethod || t.type.replace('sale_', '');
                    if (method === 'cash') totals.cash += t.value;
                    else if (method === 'credit' || method === 'credit_card') totals.credit_card += t.value;
                    else if (method === 'debit' || method === 'debit_card') totals.debit_card += t.value;
                    else if (method === 'pix') totals.pix += t.value;
                    else if (method === 'voucher') totals.voucher += t.value;
                    totals.total += t.value;
                } else if (t.type === 'sangria') {
                    totals.sangrias += t.value;
                    // Não afeta totals.cash - sangria é contabilizada separadamente
                } else if (t.type === 'supply') {
                    totals.supplies += t.value;
                    // Não afeta totals.cash - supply é contabilizado separadamente
                }
            });
        }

        // Manter compatibilidade com movements e payments (deprecated)
        if (this.payments && this.payments.length > 0) {
            this.payments.forEach(p => {
                if (p.method === 'cash') totals.cash += p.amount;
                else if (p.method === 'credit_card') totals.credit_card += p.amount;
                else if (p.method === 'debit_card') totals.debit_card += p.amount;
                else if (p.method === 'pix') totals.pix += p.amount;
                else if (p.method === 'voucher') totals.voucher += p.amount;
                totals.total += p.amount;
            });
        }

        if (this.movements && this.movements.length > 0) {
            this.movements.forEach(m => {
                if (m.type === 'sangria') {
                    totals.sangrias += m.amount;
                    if (m.method === 'cash') totals.cash -= m.amount;
                }
                if (m.type === 'suprimento') {
                    totals.supplies += m.amount;
                    if (m.method === 'cash') totals.cash += m.amount;
                }
            });
        }

        this.totals = totals;
        // FLUXO_CAIXA: expectedBalance inclui TODAS as vendas (não apenas cash)
        this.expectedBalance = this.initialBalance + totals.total + totals.supplies - totals.sangrias;
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

    // Registrar transação de abertura
    this.transactions.push({
        type: 'opening',
        value: initialBalance,
        paymentMethod: 'cash',
        description: 'Fundo de troco inicial',
        operatorId: this.cashier
    });

    // Manter compatibilidade
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

// Método unificado para registrar qualquer tipo de transação
cashSessionSchema.methods.registerTransaction = async function(transactionData) {
    if (this.status !== 'open') {
        throw new Error('Session is not open');
    }

    // Validar sangria
    if (transactionData.type === 'sangria') {
        const availableCash = this.initialBalance + this.totals.cash + this.totals.supplies - this.totals.sangrias;
        if (transactionData.value > availableCash) {
            throw new Error(`Insufficient cash for sangria. Available: R$ ${availableCash.toFixed(2)}, Requested: R$ ${transactionData.value.toFixed(2)}`);
        }
    }

    // Adicionar transação (apenas em transactions, sem duplicar em movements/payments)
    this.transactions.push({
        type: transactionData.type,
        value: transactionData.value,
        paymentMethod: transactionData.paymentMethod,
        orderId: transactionData.orderId,
        orderNumber: transactionData.orderNumber,
        description: transactionData.description,
        reason: transactionData.reason,
        operatorId: transactionData.operatorId,
        metadata: transactionData.metadata
    });

    // Forçar Mongoose a detectar modificação no array
    this.markModified('transactions');

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

// Método para obter saldo disponível em dinheiro
cashSessionSchema.methods.getAvailableCash = function() {
    return this.initialBalance + this.totals.cash + this.totals.supplies - this.totals.sangrias;
};

// Método para fechar sessão
cashSessionSchema.methods.close = async function(closingData) {
    if (this.status !== 'open') {
        throw new Error('Session is not open');
    }

    const { finalBalance, observations, userId, confirmedBy, differenceReason } = closingData;

    this.finalBalance = finalBalance;
    this.difference = finalBalance - this.expectedBalance;
    this.observations.closing = observations;
    this.closedAt = new Date();
    this.closedBy = userId;
    this.status = 'closed';

    // Preencher closingSummary
    this.closingSummary = {
        expectedCash: this.expectedBalance,
        actualCash: finalBalance,
        difference: this.difference,
        differenceReason: differenceReason,
        confirmedBy: confirmedBy,
        confirmedAt: confirmedBy ? new Date() : null,
        approved: !confirmedBy || Math.abs(this.difference) <= 50,
        notes: observations
    };

    // Registrar transação de fechamento
    this.transactions.push({
        type: 'closing',
        value: finalBalance,
        paymentMethod: 'cash',
        description: observations || 'Fechamento de caixa',
        operatorId: userId,
        metadata: {
            expectedCash: this.expectedBalance,
            difference: this.difference,
            confirmedBy: confirmedBy
        }
    });

    // Manter compatibilidade
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
        openingBalance: this.initialBalance,
        expectedBalance: this.expectedBalance,
        finalBalance: this.finalBalance,
        difference: this.difference,
        totals: this.totals,
        transactionsCount: this.transactions.length,
        movementsCount: this.movements.length,
        paymentsCount: this.payments.length,
        closingSummary: this.closingSummary,
        forced: this.forced,
        availableCash: this.getAvailableCash()
    };
};

// Método estático para sessão aberta do caixa
cashSessionSchema.statics.getActiveSession = async function(storeId, cashierId) {
    return this.findOne({
        store: new mongoose.Types.ObjectId(storeId),
        cashier: new mongoose.Types.ObjectId(cashierId),
        status: 'open'
    })
    .populate('cashier', 'name email')
    .populate('closedBy', 'name')
    .sort({ openedAt: -1 });
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
