const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

// Subdocumento de Ingrediente da Receita
const recipeIngredientSchema = new mongoose.Schema({
    ingredient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GlobalIngredient',
        required: true
    },
    netQuantity: {
        type: Number,
        required: true,
        min: 0,
        comment: 'Quantidade líquida necessária (sem perdas)'
    },
    lossFactor: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
        comment: 'Percentual de perda no preparo (0-100)'
    },
    substitute: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GlobalIngredient',
        default: null,
        comment: 'Ingrediente substituto caso o principal falte'
    },
    unit: {
        type: String,
        required: true,
        comment: 'Unidade de medida (g, ml, unidade, etc.)'
    }
}, { _id: false });

const recipeSchema = new mongoose.Schema({
    recipeId: {
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
    sku: {
        type: String,
        required: true,
        index: true,
        comment: 'SKU do produto vinculado a esta receita'
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true
    },
    variation: {
        type: String,
        required: true,
        comment: 'SKU da variação específica'
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    ingredients: {
        type: [recipeIngredientSchema],
        default: [],
        validate: {
            validator: function(ingredients) {
                return ingredients.length > 0;
            },
            message: 'Recipe must have at least one ingredient'
        }
    },
    preparationTime: {
        type: Number,
        default: 0,
        comment: 'Tempo de preparo em minutos'
    },
    instructions: {
        type: String,
        maxlength: 5000,
        comment: 'Instruções de preparo'
    },
    yieldQuantity: {
        type: Number,
        default: 1,
        min: 1,
        comment: 'Quantidade de porções que a receita rende'
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    }
}, { timestamps: true });

// Índices compostos
recipeSchema.index({ store: 1, sku: 1 }, { unique: true });
recipeSchema.index({ store: 1, product: 1 });
recipeSchema.index({ store: 1, isActive: 1 });

// Método para calcular quantidade com perda
recipeIngredientSchema.methods.getQuantityWithLoss = function() {
    return this.netQuantity * (1 + this.lossFactor / 100);
};

// Método estático para calcular custo total da receita
recipeSchema.statics.calculateCost = async function(recipeId, ingredientPrices = null) {
    const recipe = await this.findById(recipeId).populate('ingredients.ingredient');
    if (!recipe) return null;

    let totalCost = 0;
    const costBreakdown = [];

    for (const item of recipe.ingredients) {
        const ingredient = item.ingredient;
        const quantityWithLoss = item.netQuantity * (1 + item.lossFactor / 100);

        // Usar preço fornecido ou do ingrediente
        let unitCost = 0;
        if (ingredientPrices && ingredientPrices[ingredient._id.toString()]) {
            unitCost = ingredientPrices[ingredient._id.toString()];
        } else if (ingredient.averageCost) {
            unitCost = ingredient.averageCost;
        }

        const itemCost = quantityWithLoss * unitCost;
        totalCost += itemCost;

        costBreakdown.push({
            ingredientId: ingredient._id,
            ingredientName: ingredient.name,
            netQuantity: item.netQuantity,
            lossFactor: item.lossFactor,
            quantityWithLoss: quantityWithLoss,
            unitCost: unitCost,
            totalCost: itemCost
        });
    }

    return {
        totalCost,
        costPerYield: totalCost / recipe.yieldQuantity,
        yieldQuantity: recipe.yieldQuantity,
        breakdown: costBreakdown
    };
};

// Método para obter ingredientes com substitutos
recipeSchema.methods.getIngredientsWithSubstitutes = async function() {
    const result = [];

    for (const item of this.ingredients) {
        const ingredientData = {
            ingredient: item.ingredient,
            netQuantity: item.netQuantity,
            lossFactor: item.lossFactor,
            unit: item.unit,
            hasSubstitute: !!item.substitute
        };

        if (item.substitute) {
            ingredientData.substitute = item.substitute;
        }

        result.push(ingredientData);
    }

    return result;
};

// Método para validar estoque de ingredientes
recipeSchema.methods.checkStockAvailability = async function(quantity = 1) {
    const StockBalance = mongoose.model('StockBalance');
    const results = {
        available: true,
        items: []
    };

    for (const item of this.ingredients) {
        const requiredQuantity = item.netQuantity * (1 + item.lossFactor / 100) * quantity;

        const stock = await StockBalance.findOne({
            store: this.store,
            ingredient: item.ingredient
        }).populate('ingredient');

        const itemResult = {
            ingredientId: item.ingredient,
            ingredientName: stock?.ingredient?.name || 'Unknown',
            required: requiredQuantity,
            available: stock?.balance || 0,
            hasStock: (stock?.balance || 0) >= requiredQuantity,
            substitute: item.substitute
        };

        if (!itemResult.hasStock) {
            results.available = false;

            // Verificar substituto se disponível
            if (item.substitute) {
                const substituteStock = await StockBalance.findOne({
                    store: this.store,
                    ingredient: item.substitute
                }).populate('ingredient');

                itemResult.substituteAvailable = (substituteStock?.balance || 0) >= requiredQuantity;
                itemResult.substituteName = substituteStock?.ingredient?.name || 'Unknown';
            }
        }

        results.items.push(itemResult);
    }

    return results;
};

module.exports = mongoose.model("Recipe", recipeSchema);
