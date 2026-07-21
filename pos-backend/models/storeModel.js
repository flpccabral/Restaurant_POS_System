const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const storeSchema = new mongoose.Schema({
    storeId: {
        type: String,
        default: uuidv4,
        unique: true,
        index: true,
        immutable: true
    },
    name: {
        type: String,
        required: true
    },
    cnpj: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    address: {
        street: String,
        number: String,
        neighborhood: String,
        city: String,
        state: String,
        zipCode: String
    },
    isActive: {
        type: Boolean,
        default: true
    },
    operationType: {
        type: String,
        enum: ['bar', 'hamburgueria', 'pizzaria', 'arabe', 'cozinha', 'geral'],
        default: 'geral',
        index: true
    },
    subscriptionPlan: {
        type: String,
        enum: ['basic', 'pro', 'enterprise'],
        default: 'basic'
    },
    settings: {
        taxRate: { type: Number, default: 5.25 },
        currency: { type: String, default: 'BRL' },
        timezone: { type: String, default: 'America/Sao_Paulo' },
        // Gorjeta/Servico opcional (Prompt B.2 — Lei Brasileira)
        serviceCharge: {
            enabled: { type: Boolean, default: true },
            rate: { type: Number, default: 10, min: 0, max: 100, comment: 'Percentual de gorjeta (padrao: 10%)' },
            mode: { type: String, enum: ['optional', 'mandatory', 'disabled'], default: 'optional', comment: 'optional = cliente escolhe; mandatory = sempre cobrada; disabled = desativada' }
        }
    }
}, { timestamps: true });

storeSchema.index({ isActive: 1 });

module.exports = mongoose.model("Store", storeSchema);
