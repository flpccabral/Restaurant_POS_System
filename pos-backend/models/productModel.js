const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

// Subdocumento de Variação
const variationSchema = new mongoose.Schema({
    variationId: {
        type: String,
        default: uuidv4,
        unique: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    sku: {
        type: String,
        required: true,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { _id: false });

const productSchema = new mongoose.Schema({
    productId: {
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
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true,
        index: true
    },
    variations: {
        type: [variationSchema],
        default: []
    },
    attributes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Attribute'
    }],
    image: {
        type: String
    },
    isCurrent: {
        type: Boolean,
        default: true,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    tags: [{
        type: String,
        trim: true
    }],
    // Fase 9.1A — Regra de Impacto em Estoque
    sellableType: {
        type: String,
        enum: ['prepared_product', 'industrialized_resale', 'combo', 'service_fee'],
        default: 'prepared_product'
    },
    stockImpactRule: {
        type: String,
        enum: ['recipe_composition', 'stock_item_direct', 'no_stock_impact', 'combo_components'],
        default: 'recipe_composition'
    },
    directStockItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GlobalIngredient',
        default: null
    },
    directStockQuantity: {
        type: Number,
        default: 1,
        min: 0
    },
    directStockUnit: {
        type: String,
        default: null
    }
}, { timestamps: true });

// Índices compostos
productSchema.index({ store: 1, category: 1 });
productSchema.index({ store: 1, isActive: 1, isCurrent: 1 });
productSchema.index({ 'variations.sku': 1 });

// Virtual para retornar o menor preço entre as variações
productSchema.virtual('startingAt').get(function() {
    if (!this.variations || this.variations.length === 0) {
        return null;
    }

    const activeVariations = this.variations.filter(v => v.isActive !== false);
    if (activeVariations.length === 0) {
        return null;
    }

    return Math.min(...activeVariations.map(v => v.price));
});

// Virtual para verificar se tem variações
productSchema.virtual('hasVariations').get(function() {
    return this.variations && this.variations.length > 0;
});

// Método para gerar SKU baseado no nome do produto e variação
productSchema.methods.generateSku = function(variationName) {
    const normalize = (str) => str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    const productName = normalize(this.name);
    const variationPart = variationName ? '-' + normalize(variationName) : '';

    return `${productName}${variationPart}`;
};

// Método para adicionar variação com SKU automático
productSchema.methods.addVariation = async function(name, price) {
    const sku = this.generateSku(name);

    // Verificar se SKU já existe
    let counter = 1;
    let uniqueSku = sku;
    while (this.variations.some(v => v.sku === uniqueSku)) {
        uniqueSku = `${sku}-${counter}`;
        counter++;
    }

    this.variations.push({
        name,
        price,
        sku: uniqueSku
    });

    await this.save();
    return this.variations[this.variations.length - 1];
};

// Método para obter variação por SKU
productSchema.methods.getVariationBySku = function(sku) {
    return this.variations.find(v => v.sku === sku);
};

// Garantir que variações tenham nome único dentro do produto
productSchema.path('variations').validate(function(variations) {
    const names = variations.map(v => v.name.toLowerCase());
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    return duplicates.length === 0;
}, 'Variation names must be unique within a product');

// Validação de stockImpactRule
productSchema.pre('validate', function(next) {
    // stock_item_direct exige directStockItem, directStockQuantity > 0, directStockUnit
    if (this.stockImpactRule === 'stock_item_direct') {
        if (!this.directStockItem) {
            this.invalidate('directStockItem', 'stock_item_direct requires a directStockItem');
        }
        if (!this.directStockQuantity || this.directStockQuantity <= 0) {
            this.invalidate('directStockQuantity', 'stock_item_direct requires directStockQuantity > 0');
        }
        if (!this.directStockUnit) {
            this.invalidate('directStockUnit', 'stock_item_direct requires a directStockUnit');
        }
    }

    // no_stock_impact não deve ter directStockItem nem exigir Recipe
    if (this.stockImpactRule === 'no_stock_impact') {
        this.directStockItem = null;
        this.directStockQuantity = 0;
        this.directStockUnit = null;
    }

    // combo_components não deve ter directStockItem
    if (this.stockImpactRule === 'combo_components') {
        this.directStockItem = null;
        this.directStockQuantity = 0;
        this.directStockUnit = null;
    }

    // recipe_composition não deve ter directStockItem
    if (this.stockImpactRule === 'recipe_composition') {
        this.directStockItem = null;
        this.directStockQuantity = 0;
        this.directStockUnit = null;
    }

    next();
});

module.exports = mongoose.model("Product", productSchema);
