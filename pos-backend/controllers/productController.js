const createHttpError = require("http-errors");
const Product = require("../models/productModel");
const Category = require("../models/categoryModel");
const { generateUniqueSku } = require("../utils/slugGenerator");

/**
 * Criar produto
 */
const createProduct = async (req, res, next) => {
    try {
        const { name, description, categoryId, variations, attributes, image, tags } = req.body;

        // Validação de campos obrigatórios
        if (!name) {
            const error = createHttpError(400, "Name is required!");
            return next(error);
        }

        if (!categoryId) {
            const error = createHttpError(400, "Category ID is required!");
            return next(error);
        }

        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Verificar se categoria existe e pertence à loja
        const category = await Category.findOne({
            _id: categoryId,
            store: storeRef
        });

        if (!category) {
            const error = createHttpError(400, "Invalid category ID!");
            return next(error);
        }

        // Criar produto base
        const product = new Product({
            store: storeRef,
            name,
            description,
            category: categoryId,
            image,
            tags: tags || []
        });

        // Adicionar variações se fornecidas
        if (variations && Array.isArray(variations) && variations.length > 0) {
            const existingSkus = [];

            for (const variation of variations) {
                if (!variation.name || variation.price === undefined) {
                    continue; // Pular variações inválidas
                }

                // Gerar SKU único
                const sku = generateUniqueSku(name, variation.name, existingSkus);
                existingSkus.push(sku);

                product.variations.push({
                    name: variation.name,
                    price: variation.price,
                    sku,
                    isActive: variation.isActive !== false
                });
            }
        }

        // Adicionar atributos se fornecidos
        if (attributes && Array.isArray(attributes)) {
            product.attributes = attributes;
        }

        await product.save();

        // Popular dados para resposta
        const populatedProduct = await Product.findById(product._id)
            .populate('category', 'name')
            .populate('attributes', 'name options');

        res.status(201).json({
            success: true,
            message: "Product created successfully!",
            data: populatedProduct
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listar produtos
 */
const getProducts = async (req, res, next) => {
    try {
        const { categoryId, isActive, isCurrent, search } = req.query;
        const filter = {};

        // Aplicar store isolation
        if (!req.user.isMasterAdmin) {
            filter.store = req.user.store;
        } else if (req.storeId) {
            filter.store = req.storeId;
        }

        // Filtros opcionais
        if (categoryId) {
            filter.category = categoryId;
        }

        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }

        if (isCurrent !== undefined) {
            filter.isCurrent = isCurrent === 'true';
        }

        // Busca por nome
        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }

        const products = await Product.find(filter)
            .populate('category', 'name')
            .populate('attributes', 'name options')
            .sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: products.length,
            data: products.map(p => ({
                ...p.toObject(),
                startingAt: p.startingAt,
                hasVariations: p.hasVariations
            }))
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter produto por ID
 */
const getProductById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id)
            .populate('category', 'name')
            .populate('attributes', 'name options');

        if (!product) {
            const error = createHttpError(404, "Product not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && product.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Product belongs to different store!");
            return next(error);
        }

        res.status(200).json({
            success: true,
            data: {
                ...product.toObject(),
                startingAt: product.startingAt,
                hasVariations: product.hasVariations
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter produto por SKU
 */
const getProductBySku = async (req, res, next) => {
    try {
        const { sku } = req.params;

        const product = await Product.findOne({
            'variations.sku': sku
        }).populate('category', 'name');

        if (!product) {
            const error = createHttpError(404, "Product with this SKU not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && product.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Product belongs to different store!");
            return next(error);
        }

        const variation = product.variations.find(v => v.sku === sku);

        res.status(200).json({
            success: true,
            data: {
                ...product.toObject(),
                startingAt: product.startingAt,
                hasVariations: product.hasVariations,
                selectedVariation: variation
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Atualizar produto
 */
const updateProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, categoryId, image, tags, isCurrent, isActive } = req.body;

        const product = await Product.findById(id);

        if (!product) {
            const error = createHttpError(404, "Product not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && product.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Product belongs to different store!");
            return next(error);
        }

        // Atualizar campos básicos
        if (name !== undefined) product.name = name;
        if (description !== undefined) product.description = description;
        if (image !== undefined) product.image = image;
        if (tags !== undefined) product.tags = tags;
        if (isCurrent !== undefined) product.isCurrent = isCurrent;
        if (isActive !== undefined) product.isActive = isActive;

        // Atualizar categoria se fornecida
        if (categoryId) {
            const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;
            const category = await Category.findOne({
                _id: categoryId,
                store: storeRef
            });

            if (!category) {
                const error = createHttpError(400, "Invalid category ID!");
                return next(error);
            }

            product.category = categoryId;
        }

        await product.save();

        const populatedProduct = await Product.findById(product._id)
            .populate('category', 'name')
            .populate('attributes', 'name options');

        res.status(200).json({
            success: true,
            message: "Product updated successfully!",
            data: populatedProduct
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Adicionar variação ao produto
 */
const addVariation = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, price } = req.body;

        if (!name || price === undefined) {
            const error = createHttpError(400, "Name and price are required!");
            return next(error);
        }

        const product = await Product.findById(id);

        if (!product) {
            const error = createHttpError(404, "Product not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && product.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Product belongs to different store!");
            return next(error);
        }

        // Usar método do model para adicionar variação com SKU automático
        const variation = await product.addVariation(name, price);

        await product.save();

        res.status(200).json({
            success: true,
            message: "Variation added successfully!",
            data: variation
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Atualizar variação
 */
const updateVariation = async (req, res, next) => {
    try {
        const { productId, variationId } = req.params;
        const { name, price, isActive } = req.body;

        const product = await Product.findById(productId);

        if (!product) {
            const error = createHttpError(404, "Product not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && product.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Product belongs to different store!");
            return next(error);
        }

        const variation = product.variations.id(variationId);

        if (!variation) {
            const error = createHttpError(404, "Variation not found!");
            return next(error);
        }

        // Atualizar campos
        if (name !== undefined) variation.name = name;
        if (price !== undefined) variation.price = price;
        if (isActive !== undefined) variation.isActive = isActive;

        // Regenerar SKU se nome mudou
        if (name !== undefined) {
            variation.sku = generateUniqueSku(product.name, name,
                product.variations.filter(v => v._id.toString() !== variationId.toString()).map(v => v.sku)
            );
        }

        await product.save();

        res.status(200).json({
            success: true,
            message: "Variation updated successfully!",
            data: variation
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Remover variação
 */
const removeVariation = async (req, res, next) => {
    try {
        const { productId, variationId } = req.params;

        const product = await Product.findById(productId);

        if (!product) {
            const error = createHttpError(404, "Product not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && product.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Product belongs to different store!");
            return next(error);
        }

        const variation = product.variations.id(variationId);

        if (!variation) {
            const error = createHttpError(404, "Variation not found!");
            return next(error);
        }

        // Não permitir remover última variação
        if (product.variations.length <= 1) {
            const error = createHttpError(400, "Product must have at least one variation!");
            return next(error);
        }

        variation.remove();
        await product.save();

        res.status(200).json({
            success: true,
            message: "Variation removed successfully!"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Deletar produto
 */
const deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id);

        if (!product) {
            const error = createHttpError(404, "Product not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && product.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Product belongs to different store!");
            return next(error);
        }

        await Product.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: "Product deleted successfully!"
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createProduct,
    getProducts,
    getProductById,
    getProductBySku,
    updateProduct,
    addVariation,
    updateVariation,
    removeVariation,
    deleteProduct
};
