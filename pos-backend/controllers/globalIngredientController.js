const createHttpError = require("http-errors");
const GlobalIngredient = require("../models/globalIngredientModel");

/**
 * Criar ingrediente global (apenas Master Admin do sistema)
 */
const createIngredient = async (req, res, next) => {
    try {
        const { name, category, baseUnit, conversionToBase, averageCost, supplier } = req.body;

        if (!name || !category || !baseUnit || !averageCost) {
            const error = createHttpError(400, "Name, category, baseUnit and averageCost are required!");
            return next(error);
        }

        // Verificar se nome já existe
        const existing = await GlobalIngredient.findOne({ name });
        if (existing) {
            const error = createHttpError(400, "Ingredient with this name already exists!");
            return next(error);
        }

        const ingredient = await GlobalIngredient.create({
            name,
            category,
            baseUnit,
            conversionToBase: conversionToBase || {},
            averageCost,
            supplier
        });

        res.status(201).json({
            success: true,
            message: "Ingredient created successfully!",
            data: ingredient
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listar ingredientes globais
 */
const getIngredients = async (req, res, next) => {
    try {
        const { category, isActive } = req.query;
        const filter = {};

        if (category) {
            filter.category = category;
        }

        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }

        const ingredients = await GlobalIngredient.find(filter)
            .populate('supplier', 'name email')
            .sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: ingredients.length,
            data: ingredients
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter ingrediente por ID
 */
const getIngredientById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const ingredient = await GlobalIngredient.findById(id)
            .populate('supplier', 'name email phone');

        if (!ingredient) {
            const error = createHttpError(404, "Ingredient not found!");
            return next(error);
        }

        res.status(200).json({
            success: true,
            data: ingredient
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Atualizar ingrediente
 */
const updateIngredient = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Remover campos imutáveis
        delete updateData._id;
        delete updateData.ingredientId;

        const ingredient = await GlobalIngredient.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!ingredient) {
            const error = createHttpError(404, "Ingredient not found!");
            return next(error);
        }

        res.status(200).json({
            success: true,
            message: "Ingredient updated successfully!",
            data: ingredient
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Ativar/Desativar ingrediente
 */
const toggleIngredientStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        const ingredient = await GlobalIngredient.findByIdAndUpdate(
            id,
            { isActive },
            { new: true }
        );

        if (!ingredient) {
            const error = createHttpError(404, "Ingredient not found!");
            return next(error);
        }

        res.status(200).json({
            success: true,
            message: `Ingredient ${isActive ? 'activated' : 'deactivated'} successfully!`,
            data: ingredient
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Deletar ingrediente
 */
const deleteIngredient = async (req, res, next) => {
    try {
        const { id } = req.params;

        const ingredient = await GlobalIngredient.findByIdAndDelete(id);

        if (!ingredient) {
            const error = createHttpError(404, "Ingredient not found!");
            return next(error);
        }

        res.status(200).json({
            success: true,
            message: "Ingredient deleted successfully!"
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createIngredient,
    getIngredients,
    getIngredientById,
    updateIngredient,
    toggleIngredientStatus,
    deleteIngredient
};
