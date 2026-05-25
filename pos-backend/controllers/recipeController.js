const createHttpError = require("http-errors");
const Recipe = require("../models/recipeModel");
const Product = require("../models/productModel");
const GlobalIngredient = require("../models/globalIngredientModel");
const recipeService = require("../services/recipeService");
const unitConversion = require("../services/unitConversionService");
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
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

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
                const error = createHttpError(400, "Each ingredient requires ingredientId, netQuantity, and unit");
                return next(error);
            }

            if (item.netQuantity <= 0) {
                const error = createHttpError(400, "Ingredient netQuantity must be greater than 0");
                return next(error);
            }

            // Verificar se ingrediente existe
            const ingredient = await GlobalIngredient.findById(item.ingredientId);
            if (!ingredient) {
                const error = createHttpError(400, `Ingredient not found: ${item.ingredientId}`);
                return next(error);
            }

            // Validar compatibilidade de unidades
            const unitCheck = unitConversion.validateUnit(item.unit, ingredient.baseUnit);
            if (!unitCheck.valid) {
                const error = createHttpError(400, `Unit incompatibility for ingredient ${ingredient.name}: ${unitCheck.reason}`);
                return next(error);
            }

            // Verificar substituto se fornecido
            if (item.substituteId) {
                const substitute = await GlobalIngredient.findById(item.substituteId);
                if (!substitute) {
                    const error = createHttpError(400, `Substitute ingredient not found: ${item.substituteId}`);
                    return next(error);
                }
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

        // Calcular custo da receita
        try {
            await recipeService.calculateCost(recipe._id);
        } catch (err) {
            console.error('Recipe cost calculation failed:', err.message);
        }

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
                    const error = createHttpError(400, "Each ingredient requires ingredientId, netQuantity, and unit");
                    return next(error);
                }

                if (item.netQuantity <= 0) {
                    const error = createHttpError(400, "Ingredient netQuantity must be greater than 0");
                    return next(error);
                }

                const ingredient = await GlobalIngredient.findById(item.ingredientId);
                if (!ingredient) {
                    const error = createHttpError(400, `Ingredient not found: ${item.ingredientId}`);
                    return next(error);
                }

                const unitCheck = unitConversion.validateUnit(item.unit, ingredient.baseUnit);
                if (!unitCheck.valid) {
                    const error = createHttpError(400, `Unit incompatibility for ingredient ${ingredient.name}: ${unitCheck.reason}`);
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

            recipe.ingredients = validatedIngredients;
            recipe.version = (recipe.version || 1) + 1;
        }

        await recipe.save();

        // Recalcular custo apos atualizacao
        try {
            await recipeService.calculateCost(recipe._id);
        } catch (err) {
            console.error('Recipe cost calculation failed:', err.message);
        }

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
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

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

/**
 * Validar receita sem salvar (simulacao)
 */
const validateRecipe = async (req, res, next) => {
    try {
        const { sku, product, variation, name, ingredients, yieldQuantity } = req.body;

        const errors = [];

        if (!sku) errors.push('SKU is required');
        if (!product) errors.push('Product is required');
        if (!variation) errors.push('Variation is required');
        if (!name) errors.push('Name is required');

        if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
            errors.push('At least one ingredient is required');
        } else {
            const seen = new Set();
            for (const item of ingredients) {
                if (!item.ingredientId) errors.push('Ingredient missing ingredientId');
                if (!item.netQuantity || item.netQuantity <= 0) errors.push(`Ingredient netQuantity must be > 0`);
                if (!item.unit) errors.push('Ingredient unit is required');

                if (item.ingredientId) {
                    const ingredient = await GlobalIngredient.findById(item.ingredientId);
                    if (!ingredient) {
                        errors.push(`Ingredient not found: ${item.ingredientId}`);
                    } else {
                        const unitCheck = unitConversion.validateUnit(item.unit, ingredient.baseUnit);
                        if (!unitCheck.valid) {
                            errors.push(`Unit incompatibility for ${ingredient.name}: ${unitCheck.reason}`);
                        }
                    }
                }

                const key = item.ingredientId?.toString();
                if (key && seen.has(key)) {
                    errors.push(`Duplicate ingredient: ${key}`);
                }
                if (key) seen.add(key);
            }
        }

        if (product) {
            const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;
            const productDoc = await Product.findOne({ _id: product, store: storeRef });
            if (!productDoc) {
                errors.push('Product not found or does not belong to this store');
            } else {
                const hasVariation = productDoc.variations.some(v => v.sku === variation);
                if (!hasVariation) {
                    errors.push(`Product does not have variation with SKU: ${variation}`);
                }
            }
        }

        res.status(errors.length > 0 ? 400 : 200).json({
            success: errors.length === 0,
            valid: errors.length === 0,
            errors
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listar produtos sem ficha tecnica valida
 */
const getProductsWithoutRecipe = async (req, res, next) => {
    try {
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const products = await Product.find({ store: storeRef, isActive: true })
            .populate('category', 'name');

        const recipes = await Recipe.find({ store: storeRef, isActive: true })
            .select('product variation sku isActive');

        const recipeMap = new Map();
        for (const r of recipes) {
            recipeMap.set(`${r.product.toString()}:${r.variation}`, r);
        }

        const withoutRecipe = [];
        for (const product of products) {
            if (!product.variations || product.variations.length === 0) {
                withoutRecipe.push({
                    productId: product._id,
                    productName: product.name,
                    category: product.category,
                    missingAllRecipes: true
                });
                continue;
            }

            for (const variation of product.variations) {
                if (!variation.isActive) continue;
                const key = `${product._id.toString()}:${variation.sku}`;
                if (!recipeMap.has(key)) {
                    withoutRecipe.push({
                        productId: product._id,
                        productName: product.name,
                        variationId: variation.variationId,
                        variationName: variation.name,
                        sku: variation.sku,
                        missingRecipe: true
                    });
                }
            }
        }

        res.status(200).json({
            success: true,
            count: withoutRecipe.length,
            data: withoutRecipe
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listar produtos vendaveis (com ficha tecnica ativa e valida)
 */
const getSellableProducts = async (req, res, next) => {
    try {
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const recipes = await Recipe.find({ store: storeRef, isActive: true })
            .populate('product', 'name category')
            .select('product variation sku name isActive totalCost');

        const sellable = recipes
            .filter(r => r.product && r.product.isActive)
            .map(r => ({
                productId: r.product._id,
                productName: r.product.name,
                category: r.product.category,
                variation: r.variation,
                sku: r.sku,
                recipeName: r.name,
                recipeId: r._id,
                totalCost: r.totalCost || 0,
                sellable: true
            }));

        res.status(200).json({
            success: true,
            count: sellable.length,
            data: sellable
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listar produtos nao vendaveis (sem ficha tecnica ou ficha inativa)
 */
const getNonSellableProducts = async (req, res, next) => {
    try {
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const products = await Product.find({ store: storeRef, isActive: true })
            .populate('category', 'name');

        const recipes = await Recipe.find({ store: storeRef })
            .select('product variation sku isActive');

        const recipeMap = new Map();
        for (const r of recipes) {
            recipeMap.set(`${r.product.toString()}:${r.variation}`, r);
        }

        const nonSellable = [];
        for (const product of products) {
            if (!product.variations || product.variations.length === 0) {
                nonSellable.push({
                    productId: product._id,
                    productName: product.name,
                    reason: 'no_variations'
                });
                continue;
            }

            for (const variation of product.variations) {
                if (!variation.isActive) continue;
                const key = `${product._id.toString()}:${variation.sku}`;
                const recipe = recipeMap.get(key);
                if (!recipe) {
                    nonSellable.push({
                        productId: product._id,
                        productName: product.name,
                        variation: variation.name,
                        sku: variation.sku,
                        reason: 'no_recipe'
                    });
                } else if (!recipe.isActive) {
                    nonSellable.push({
                        productId: product._id,
                        productName: product.name,
                        variation: variation.name,
                        sku: variation.sku,
                        reason: 'recipe_inactive'
                    });
                }
            }
        }

        res.status(200).json({
            success: true,
            count: nonSellable.length,
            data: nonSellable
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Simular consumo sem executar baixa (preparacao Fase 5)
 */
const simulateConsumption = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { quantity, locationId } = req.query;

        const result = await recipeService.simulateConsumption(
            id,
            parseInt(quantity) || 1,
            locationId
        );

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Verificar se produto e vendavel (tem ficha tecnica ativa)
 */
const checkProductSellability = async (req, res, next) => {
    try {
        const { productId } = req.params;
        const { variation } = req.query;

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const product = await Product.findOne({ _id: productId, store: storeRef, isActive: true });
        if (!product) {
            const error = createHttpError(404, 'Product not found or inactive');
            return next(error);
        }

        const variationSku = variation || (product.variations?.[0]?.sku);
        if (!variationSku) {
            return res.status(200).json({
                success: true,
                data: { productId, sellable: false, reason: 'no_variations' }
            });
        }

        const recipe = await Recipe.findOne({
            store: storeRef,
            product: productId,
            variation: variationSku,
            isActive: true
        });

        if (!recipe) {
            return res.status(200).json({
                success: true,
                data: {
                    productId,
                    product: product.name,
                    sku: variationSku,
                    sellable: false,
                    reason: 'no_active_recipe'
                }
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                productId,
                product: product.name,
                sku: variationSku,
                sellable: true,
                recipeId: recipe._id,
                recipeName: recipe.name,
                totalCost: recipe.totalCost || 0
            }
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
    deleteRecipe,
    validateRecipe,
    getProductsWithoutRecipe,
    getSellableProducts,
    getNonSellableProducts,
    checkProductSellability,
    simulateConsumption
};
