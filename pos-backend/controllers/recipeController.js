const createHttpError = require("http-errors");
const Recipe = require("../models/recipeModel");
const Product = require("../models/productModel");
const GlobalIngredient = require("../models/globalIngredientModel");
const recipeService = require("../services/recipeService");
const StockBalance = require("../models/stockBalanceModel");
const ws = require("../services/websocketService");

/**
 * Criar receita (Ficha Técnica)
 */
const createRecipe = async (req, res, next) => {
    try {
        const { sku, product, variation, name, ingredients, preparationTime, instructions, yieldQuantity } = req.body;

        // Validação de campos obrigatórios
        if (!sku || !product || !variation || !name) {
            const error = createHttpError(400, "SKU, product, variation and name are required!");
            return next(error);
        }

        if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
            const error = createHttpError(400, "At least one ingredient is required!");
            return next(error);
        }

        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Verificar se produto existe
        const productDoc = await Product.findOne({
            _id: product,
            store: storeRef
        });

        if (!productDoc) {
            const error = createHttpError(400, "Invalid product ID!");
            return next(error);
        }

        // Verificar se SKU já existe
        const existing = await Recipe.findOne({
            store: storeRef,
            sku
        });

        if (existing) {
            const error = createHttpError(400, "Recipe with this SKU already exists!");
            return next(error);
        }

        // Validar ingredientes
        const validatedIngredients = [];
        for (const item of ingredients) {
            if (!item.ingredientId || !item.netQuantity || !item.unit) {
                continue; // Pular ingredientes inválidos
            }

            // Verificar se ingrediente existe
            const ingredient = await GlobalIngredient.findById(item.ingredientId);
            if (!ingredient) {
                const error = createHttpError(400, `Ingredient not found: ${item.ingredientId}`);
                return next(error);
            }

            validatedIngredients.push({
                ingredient: item.ingredientId,
                netQuantity: item.netQuantity,
                lossFactor: item.lossFactor || 0,
                substitute: item.substituteId || null,
                unit: item.unit
            });
        }

        // Criar receita
        const recipe = await Recipe.create({
            store: storeRef,
            sku,
            product,
            variation,
            name,
            ingredients: validatedIngredients,
            preparationTime: preparationTime || 0,
            instructions: instructions || '',
            yieldQuantity: yieldQuantity || 1
        });

        const populatedRecipe = await Recipe.findById(recipe._id)
            .populate('product', 'name')
            .populate('ingredients.ingredient', 'name category');

        res.status(201).json({
            success: true,
            message: "Recipe created successfully!",
            data: populatedRecipe
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listar receitas
 */
const getRecipes = async (req, res, next) => {
    try {
        const { productId, isActive } = req.query;
        const filter = {};

        // Aplicar store isolation
        if (!req.user.isMasterAdmin) {
            filter.store = req.user.store;
        } else if (req.storeId) {
            filter.store = req.storeId;
        }

        // Filtros opcionais
        if (productId) {
            filter.product = productId;
        }

        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }

        const recipes = await Recipe.find(filter)
            .populate('product', 'name')
            .populate('ingredients.ingredient', 'name category')
            .sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: recipes.length,
            data: recipes
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter receita por ID
 */
const getRecipeById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const recipe = await Recipe.findById(id)
            .populate('product', 'name category')
            .populate('ingredients.ingredient', 'name category averageCost')
            .populate('ingredients.substitute', 'name');

        if (!recipe) {
            const error = createHttpError(404, "Recipe not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && recipe.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Recipe belongs to different store!");
            return next(error);
        }

        res.status(200).json({
            success: true,
            data: recipe
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter receita por SKU
 */
const getRecipeBySku = async (req, res, next) => {
    try {
        const { sku } = req.params;

        const recipe = await Recipe.findOne({ sku })
            .populate('product', 'name category')
            .populate('ingredients.ingredient', 'name category averageCost')
            .populate('ingredients.substitute', 'name');

        if (!recipe) {
            const error = createHttpError(404, "Recipe with this SKU not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && recipe.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Recipe belongs to different store!");
            return next(error);
        }

        res.status(200).json({
            success: true,
            data: recipe
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Atualizar receita
 */
const updateRecipe = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, ingredients, preparationTime, instructions, yieldQuantity, isActive } = req.body;

        const recipe = await Recipe.findById(id);

        if (!recipe) {
            const error = createHttpError(404, "Recipe not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && recipe.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Recipe belongs to different store!");
            return next(error);
        }

        // Atualizar campos
        if (name !== undefined) recipe.name = name;
        if (preparationTime !== undefined) recipe.preparationTime = preparationTime;
        if (instructions !== undefined) recipe.instructions = instructions;
        if (yieldQuantity !== undefined) recipe.yieldQuantity = yieldQuantity;
        if (isActive !== undefined) recipe.isActive = isActive;

        // Atualizar ingredientes se fornecidos
        if (ingredients && Array.isArray(ingredients)) {
            const validatedIngredients = [];

            for (const item of ingredients) {
                if (!item.ingredientId || !item.netQuantity || !item.unit) {
                    continue;
                }

                const ingredient = await GlobalIngredient.findById(item.ingredientId);
                if (!ingredient) {
                    continue; // Pular ingredientes inválidos
                }

                validatedIngredients.push({
                    ingredient: item.ingredientId,
                    netQuantity: item.netQuantity,
                    lossFactor: item.lossFactor || 0,
                    substitute: item.substituteId || null,
                    unit: item.unit
                });
            }

            recipe.ingredients = validatedIngredients;
        }

        await recipe.save();

        const populatedRecipe = await Recipe.findById(recipe._id)
            .populate('product', 'name')
            .populate('ingredients.ingredient', 'name category');

        res.status(200).json({
            success: true,
            message: "Recipe updated successfully!",
            data: populatedRecipe
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Calcular custo da receita
 */
const calculateRecipeCost = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { ingredientPrices } = req.body;

        const result = await recipeService.calculateCost(id, ingredientPrices);

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Verificar disponibilidade de estoque
 */
const checkStockAvailability = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { quantity } = req.query;

        const result = await recipeService.checkStockAvailability(id, parseInt(quantity) || 1);

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Realizar baixa de ingredientes
 */
const deductStock = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { quantity } = req.body;

        if (!quantity || quantity < 1) {
            const error = createHttpError(400, "Valid quantity is required!");
            return next(error);
        }

        // Determinar loja para evento WebSocket
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        const result = await recipeService.deductStock(id, quantity, req.user._id);

        // Emit WebSocket events para cada ingrediente baixado
        const io = req.app.get('io');

        if (result.deducted && result.deducted.length > 0) {
            for (const item of result.deducted) {
                ws.emitInventoryUpdated(io, storeRef, {
                    type: 'recipe_deduction',
                    ingredientId: item.ingredientId,
                    ingredientName: item.ingredientName,
                    quantity: item.quantityDeducted,
                    balance: item.balanceAfter,
                    unit: item.unit
                });
            }
        }

        // Emitir evento de receita produzida
        ws.emitRecipeProduced(io, storeRef, {
            recipeId: id,
            quantity: quantity,
            ingredients: result.deducted
        });

        if (!result.success) {
            res.status(400).json({
                success: false,
                message: "Failed to deduct stock for some ingredients",
                data: result
            });
        } else {
            res.status(200).json({
                success: true,
                message: "Stock deducted successfully!",
                data: result
            });
        }
    } catch (error) {
        next(error);
    }
};

/**
 * Deletar receita
 */
const deleteRecipe = async (req, res, next) => {
    try {
        const { id } = req.params;

        const recipe = await Recipe.findById(id);

        if (!recipe) {
            const error = createHttpError(404, "Recipe not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && recipe.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Recipe belongs to different store!");
            return next(error);
        }

        await Recipe.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: "Recipe deleted successfully!"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Ativar/Desativar receita
 */
const toggleRecipeStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        const recipe = await Recipe.findById(id);

        if (!recipe) {
            const error = createHttpError(404, "Recipe not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && recipe.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Recipe belongs to different store!");
            return next(error);
        }

        recipe.isActive = isActive;
        await recipe.save();

        res.status(200).json({
            success: true,
            message: `Recipe ${isActive ? 'activated' : 'deactivated'} successfully!`,
            data: recipe
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createRecipe,
    getRecipes,
    getRecipeById,
    getRecipeBySku,
    updateRecipe,
    calculateRecipeCost,
    checkStockAvailability,
    deductStock,
    toggleRecipeStatus,
    deleteRecipe
};
