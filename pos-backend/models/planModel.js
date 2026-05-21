const mongoose = require("mongoose");

const planSchema = new mongoose.Schema({
    planId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        immutable: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    description: {
        type: String,
        maxlength: 500
    },
    price: {
        type: Number,
        required: true,
        min: 0,
        comment: 'Preço mensal em centavos'
    },
    billingCycle: {
        type: String,
        enum: ['monthly', 'quarterly', 'yearly'],
        default: 'monthly'
    },
    discountPercent: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
        comment: 'Desconto para pagamento anual'
    },
    limits: {
        stores: {
            type: Number,
            required: true,
            min: 1
        },
        users: {
            type: Number,
            required: true,
            min: 1
        },
        devices: {
            type: Number,
            required: true,
            min: 1
        },
        orders: {
            type: Number,
            min: 0,
            comment: '0 = ilimitado'
        },
        products: {
            type: Number,
            min: 0,
            comment: '0 = ilimitado'
        }
    },
    features: [{
        name: String,
        description: String,
        included: {
            type: Boolean,
            default: true
        }
    }],
    trialDays: {
        type: Number,
        default: 7,
        min: 0
    },
    isPopular: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    stripeProductId: {
        type: String,
        comment: 'ID do produto no Stripe'
    },
    stripePriceId: {
        type: String,
        comment: 'ID do preço no Stripe'
    }
}, { timestamps: true });

// Índices
planSchema.index({ slug: 1, isActive: 1 });
planSchema.index({ billingCycle: 1 });

// Virtual para preço com desconto
planSchema.virtual('discountedPrice').get(function() {
    if (this.billingCycle === 'yearly' && this.discountPercent > 0) {
        return this.price * (1 - this.discountPercent / 100);
    }
    return this.price;
});

// Virtual para formato do preço
planSchema.virtual('formattedPrice').get(function() {
    return (this.price / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
});

// Método para verificar se recurso está incluído
planSchema.methods.hasFeature = function(featureName) {
    const feature = this.features.find(f => f.name === featureName);
    return feature ? feature.included : false;
};

// Método para verificar limites
planSchema.methods.checkLimit = function(resource, current, requested = 1) {
    const limit = this.limits[resource];
    if (limit === 0) return { allowed: true, limit: 'unlimited' }; // 0 = ilimitado
    return {
        allowed: current + requested <= limit,
        limit,
        current,
        remaining: Math.max(0, limit - current)
    };
};

// Método estático para obter planos ativos
planSchema.statics.getActivePlans = async function() {
    return this.find({ isActive: true }).sort({ price: 1 });
};

// Método estático para obter plano por slug
planSchema.statics.getBySlug = async function(slug) {
    return this.findOne({ slug, isActive: true });
};

module.exports = mongoose.model("Plan", planSchema);
