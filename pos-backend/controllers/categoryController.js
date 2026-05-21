const createHttpError = require("http-errors");
const Category = require("../models/categoryModel");

/**
 * Criar categoria
 */
const createCategory = async (req, res, next) => {
    try {
        const { name, description, image } = req.body;

        // Validação de campos obrigatórios
        if (!name) {
            const error = createHttpError(400, "Name is required!");
            return next(error);
        }

        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Verificar duplicidade
        const existing = await Category.findOne({
            store: storeRef,
            name: new RegExp(`^${name}$`, 'i')
        });

        if (existing) {
            const error = createHttpError(400, "Category with this name already exists!");
            return next(error);
        }

        // Criar categoria (order é auto-incrementado pelo hook pre-save)
        const category = await Category.create({
            store: storeRef,
            name,
            description,
            image,
            isActive: true
        });

        res.status(201).json({
            success: true,
            message: "Category created successfully!",
            data: category
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listar categorias
 */
const getCategories = async (req, res, next) => {
    try {
        const { isActive } = req.query;
        const filter = {};

        // Aplicar store isolation
        if (!req.user.isMasterAdmin) {
            filter.store = req.user.store;
        } else if (req.storeId) {
            filter.store = req.storeId;
        }

        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }

        const categories = await Category.find(filter)
            .sort({ order: 1, name: 1 });

        res.status(200).json({
            success: true,
            count: categories.length,
            data: categories
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter categoria por ID
 */
const getCategoryById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const category = await Category.findById(id);

        if (!category) {
            const error = createHttpError(404, "Category not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && category.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Category belongs to different store!");
            return next(error);
        }

        res.status(200).json({
            success: true,
            data: category
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Atualizar categoria
 */
const updateCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, image, isActive, order } = req.body;

        const category = await Category.findById(id);

        if (!category) {
            const error = createHttpError(404, "Category not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && category.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Category belongs to different store!");
            return next(error);
        }

        // Verificar duplicidade se nome foi alterado
        if (name && name !== category.name) {
            const existing = await Category.findOne({
                store: category.store,
                name: new RegExp(`^${name}$`, 'i'),
                _id: { $ne: category._id }
            });

            if (existing) {
                const error = createHttpError(400, "Category with this name already exists!");
                return next(error);
            }
        }

        // Atualizar campos
        if (name !== undefined) category.name = name;
        if (description !== undefined) category.description = description;
        if (image !== undefined) category.image = image;
        if (isActive !== undefined) category.isActive = isActive;
        if (order !== undefined) category.order = order;

        await category.save();

        res.status(200).json({
            success: true,
            message: "Category updated successfully!",
            data: category
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Mover categoria na ordem
 */
const moveCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { newOrder } = req.body;

        if (newOrder === undefined || newOrder < 0) {
            const error = createHttpError(400, "Valid newOrder is required!");
            return next(error);
        }

        const category = await Category.findById(id);

        if (!category) {
            const error = createHttpError(404, "Category not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && category.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Category belongs to different store!");
            return next(error);
        }

        await category.moveOrder(newOrder);

        res.status(200).json({
            success: true,
            message: "Category order updated successfully!",
            data: category
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Ativar/Desativar categoria
 */
const toggleCategoryStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        const category = await Category.findById(id);

        if (!category) {
            const error = createHttpError(404, "Category not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && category.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Category belongs to different store!");
            return next(error);
        }

        category.isActive = isActive;
        await category.save();

        res.status(200).json({
            success: true,
            message: `Category ${isActive ? 'activated' : 'deactivated'} successfully!`,
            data: category
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Deletar categoria
 */
const deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.params;

        const category = await Category.findById(id);

        if (!category) {
            const error = createHttpError(404, "Category not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && category.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Category belongs to different store!");
            return next(error);
        }

        await Category.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: "Category deleted successfully!"
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createCategory,
    getCategories,
    getCategoryById,
    updateCategory,
    moveCategory,
    toggleCategoryStatus,
    deleteCategory
};
