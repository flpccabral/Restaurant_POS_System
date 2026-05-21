const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const globalIngredientSchema = new mongoose.Schema({
    ingredientId: {
        type: String,
        default: uuidv4,
        unique: true,
        index: true,
        immutable: true
    },
    name: {
        type: String,
        required: true,
        unique: true
    },
    category: {
        type: String,
        enum: ['proteina', 'carboidrato', 'vegetal', 'laticinio', 'tempero', 'bebida', 'outro'],
        required: true
    },
    baseUnit: {
        type: String,
        enum: ['g', 'kg', 'ml', 'L', 'unidade'],
        required: true
    },
    conversionToBase: {
        type: Map,
        of: Number
    },
    averageCost: {
        type: Number,
        required: true
    },
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

globalIngredientSchema.index({ category: 1, isActive: 1 });

module.exports = mongoose.model("GlobalIngredient", globalIngredientSchema);
