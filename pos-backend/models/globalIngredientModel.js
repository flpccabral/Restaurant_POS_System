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
        enum: ['g', 'kg', 'ml', 'L', 'unidade', 'pacote', 'caixa'],
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
    minimumStock: {
        type: Number,
        default: 0,
        min: 0,
        comment: 'Estoque mínimo sugerido para alerta de reposição'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Campos Fase 5.1A — produção interna e subprodutos
    // Fase 9.1A — adicionado 'industrialized'
    itemType: {
        type: String,
        enum: ['raw_material', 'prepared', 'byproduct', 'packaging', 'consumable', 'industrialized'],
        default: 'raw_material',
        index: true,
        comment: 'Tipo do item no estoque (Fase 5.1A / 9.1A)'
    },
    productionState: {
        type: String,
        enum: ['raw', 'cleaned', 'ground', 'seasoned', 'portioned', 'assembled', 'cooked', 'frozen', 'ready_to_use', 'ready_to_sell', 'waste'],
        default: 'raw',
        index: true,
        comment: 'Estado operacional do item (Fase 5.1A)'
    },
    isByproduct: {
        type: Boolean,
        default: false,
        index: true,
        comment: 'True se é subproduto de produção interna (Fase 5.1A)'
    },
    parentIngredient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GlobalIngredient',
        comment: 'Ingrediente bruto de origem para subprodutos/preparados (Fase 5.1A)'
    },
    // Fase 9.1A — pode ser vendido diretamente como stock_item_direct
    isSellableDirectly: {
        type: Boolean,
        default: false,
        index: true,
        comment: 'True se pode ser vendido diretamente como stock_item_direct (Fase 9.1A)'
    },
    compatibleOperations: {
        type: [String],
        enum: ['bar', 'hamburgueria', 'pizzaria', 'arabe', 'cozinha', 'geral'],
        default: ['geral'],
        comment: 'Quais operações podem usar este item (Fase 5.1A)'
    }
}, { timestamps: true });

globalIngredientSchema.index({ category: 1, isActive: 1 });
globalIngredientSchema.index({ itemType: 1, productionState: 1, isActive: 1 });
globalIngredientSchema.index({ isByproduct: 1, isActive: 1 });

module.exports = mongoose.model("GlobalIngredient", globalIngredientSchema);
