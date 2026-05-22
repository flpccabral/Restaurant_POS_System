const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema({
    subscriptionId: {
        type: String,
        default: () => `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
    plan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
        required: true
    },
    status: {
        type: String,
        enum: ['trialing', 'active', 'past_due', 'cancelled', 'canceled', 'expired', 'incomplete'],
        default: 'trialing',
        index: true
    },
    currentPeriodStart: {
        type: Date,
        required: true
    },
    currentPeriodEnd: {
        type: Date,
        required: true
    },
    trialStart: {
        type: Date,
        comment: 'Início do período de trial'
    },
    trialEnd: {
        type: Date,
        comment: 'Fim do período de trial'
    },
    canceledAt: {
        type: Date,
        comment: 'Data do cancelamento (soft delete)'
    },
    cancelReason: {
        type: String,
        enum: ['too_expensive', 'missing_features', 'switched_service', 'too_complex', 'other'],
        maxlength: 500
    },
    cancelFeedback: {
        type: String,
        maxlength: 1000
    },
    billingCycle: {
        type: String,
        enum: ['monthly', 'quarterly', 'yearly'],
        default: 'monthly'
    },
    price: {
        type: Number,
        required: true,
        min: 0,
        comment: 'Preço atual em centavos'
    },
    discountPercent: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    paymentMethod: {
        type: String,
        enum: ['credit_card', 'pix', 'boleto', 'bank_transfer'],
        default: 'credit_card'
    },
    stripeSubscriptionId: {
        type: String,
        index: true,
        sparse: true,
        comment: 'ID da assinatura no Stripe'
    },
    stripeCustomerId: {
        type: String,
        index: true,
        sparse: true,
        comment: 'ID do cliente no Stripe'
    },
    lastPayment: {
        date: Date,
        amount: Number,
        status: {
            type: String,
            enum: ['succeeded', 'failed', 'pending']
        },
        invoiceId: String,
        chargeId: String
    },
    nextBillingDate: {
        type: Date,
        index: true
    },
    invoices: [{
        invoiceId: String,
        date: Date,
        amount: Number,
        status: {
            type: String,
            enum: ['paid', 'pending', 'failed', 'void']
        },
        dueDate: Date,
        paidDate: Date,
        stripeInvoiceId: String
    }],
    usage: {
        stores: { type: Number, default: 0 },
        users: { type: Number, default: 0 },
        devices: { type: Number, default: 0 },
        orders: { type: Number, default: 0 },
        products: { type: Number, default: 0 }
    },
    autoRenew: {
        type: Boolean,
        default: true
    },
    metadata: {
        type: Map,
        of: String
    }
}, { timestamps: true });

// Índices compostos
subscriptionSchema.index({ store: 1, status: 1 });
subscriptionSchema.index({ status: 1, nextBillingDate: 1 });
subscriptionSchema.index({ trialEnd: 1, status: 1 });

// Virtual para verificar se está em trial
subscriptionSchema.virtual('isTrial').get(function() {
    return this.status === 'trialing' && this.trialEnd && this.trialEnd > new Date();
});

// Virtual para verificar se está vencida
subscriptionSchema.virtual('isExpired').get(function() {
    return this.currentPeriodEnd && this.currentPeriodEnd < new Date() &&
           this.status !== 'active' && this.status !== 'trialing';
});

// Virtual para verificar se pode usar
subscriptionSchema.virtual('isActive').get(function() {
    return ['active', 'trialing'].includes(this.status);
});

// Hook para atualizar usage antes de salvar
subscriptionSchema.pre('save', async function(next) {
    if (this.isModified('store')) {
        const Store = mongoose.model('Store');
        const storeCount = await Store.countDocuments({ _id: this.store });
        this.usage.stores = storeCount;
    }
    next();
});

// Método para verificar se excedeu limites
subscriptionSchema.methods.checkLimits = async function() {
    const Plan = mongoose.model('Plan');
    const plan = await Plan.findById(this.plan);

    if (!plan) {
        throw new Error('Plan not found');
    }

    const violations = [];

    for (const [resource, current] of Object.entries(this.usage)) {
        const result = plan.checkLimit(resource, current);
        if (!result.allowed) {
            violations.push({
                resource,
                limit: result.limit,
                current
            });
        }
    }

    return {
        allowed: violations.length === 0,
        violations
    };
};

// Método para atualizar usage
subscriptionSchema.methods.updateUsage = async function() {
    const Store = mongoose.model('Store');
    const User = mongoose.model('User');
    const Device = mongoose.model('Device');
    const Order = mongoose.model('Order');
    const Product = mongoose.model('Product');

    // Contar stores (apenas esta)
    this.usage.stores = 1;

    // Contar usuários da store
    const storeDoc = await Store.findById(this.store);
    if (storeDoc) {
        this.usage.users = await User.countDocuments({ store: this.store });
        this.usage.devices = await Device.countDocuments({ store: this.store });
        this.usage.orders = await Order.countDocuments({ store: this.store });
        this.usage.products = await Product.countDocuments({ store: this.store });
    }

    await this.save();
    return this.usage;
};

// Método para cancelar assinatura
subscriptionSchema.methods.cancel = async function(reason = null, feedback = null) {
    this.status = 'canceled';
    this.canceledAt = new Date();
    this.cancelReason = reason;
    this.cancelFeedback = feedback;
    this.autoRenew = false;
    await this.save();
    return this;
};

// Método para reativar assinatura
subscriptionSchema.methods.reactivate = async function() {
    if (this.status !== 'canceled' && this.status !== 'expired') {
        throw new Error(`Cannot reactivate subscription with status: ${this.status}`);
    }

    this.status = 'active';
    this.canceledAt = null;
    this.cancelReason = null;
    this.cancelFeedback = null;
    this.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 dias
    await this.save();
    return this;
};

// Método para verificar trial
subscriptionSchema.methods.checkTrial = function() {
    if (this.status !== 'trialing') {
        return { isTrial: false, daysRemaining: 0 };
    }

    if (!this.trialEnd) {
        return { isTrial: false, daysRemaining: 0 };
    }

    const now = new Date();
    const diff = this.trialEnd.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));

    return {
        isTrial: true,
        daysRemaining: Math.max(0, daysRemaining),
        trialEnd: this.trialEnd
    };
};

// Método estático para criar assinatura com trial
subscriptionSchema.statics.createWithTrial = async function(storeId, planId, trialDays = 7) {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const Plan = mongoose.model('Plan');
    const plan = await Plan.findById(planId);

    if (!plan) {
        throw new Error('Plan not found');
    }

    const subscription = await this.create({
        store: storeId,
        plan: planId,
        status: 'trialing',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialStart: now,
        trialEnd: trialEnd,
        billingCycle: plan.billingCycle,
        price: plan.price,
        discountPercent: plan.discountPercent
    });

    return subscription;
};

// Método estático para obter assinatura ativa da loja
subscriptionSchema.statics.getActiveSubscription = async function(storeId) {
    return this.findOne({
        store: storeId,
        status: { $in: ['active', 'trialing'] }
    }).populate('plan', 'name slug limits features');
};

module.exports = mongoose.model("Subscription", subscriptionSchema);
