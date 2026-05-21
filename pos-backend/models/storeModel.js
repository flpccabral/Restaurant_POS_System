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
    subscriptionPlan: {
        type: String,
        enum: ['basic', 'pro', 'enterprise'],
        default: 'basic'
    },
    settings: {
        taxRate: { type: Number, default: 5.25 },
        currency: { type: String, default: 'BRL' },
        timezone: { type: String, default: 'America/Sao_Paulo' }
    }
}, { timestamps: true });

storeSchema.index({ isActive: 1 });

module.exports = mongoose.model("Store", storeSchema);
