const createHttpError = require("http-errors");
const Attribute = require("../models/attributeModel");

/**
 * Criar atributo
 */
const createAttribute = async (req, res, next) => {
    try {
        const { name, description, isRequired, minSelected, maxSelected, options } = req.body;

        // Validação de campos obrigatórios
        if (!name) {
            const error = createHttpError(400, "Name is required!");
            return next(error);
        }

        // Determinar loja (CREATE precisa de store, mesmo para master admin)
        const storeRef = req.user.isMasterAdmin
            ? (req.body.store || req.storeId || req.user.store)
            : req.user.store;

        if (!storeRef) {
            const error = createHttpError(400, "Store ID is required to create an attribute. Pass storeId in query or store in body.");
            return next(error);
        }

        // Verificar duplicidade
        const existing = await Attribute.findOne({
            store: storeRef,
            name: new RegExp(`^${name}$`, 'i')
        });

        if (existing) {
            const error = createHttpError(400, "Attribute with this name already exists!");
            return next(error);
        }

        // Validar isRequired com minSelected
        if (isRequired && (!minSelected || minSelected < 1)) {
            const error = createHttpError(400, "Required attributes must have minSelected >= 1!");
            return next(error);
        }

        // Validar maxSelected >= minSelected
        if (maxSelected !== undefined && maxSelected !== null && maxSelected < minSelected) {
            const error = createHttpError(400, "maxSelected must be greater than or equal to minSelected!");
            return next(error);
        }

        // Criar atributo
        const attribute = await Attribute.create({
            store: storeRef,
            name,
            description,
            isRequired: isRequired || false,
            minSelected: minSelected || 0,
            maxSelected: maxSelected || null,
            options: options || []
        });

        res.status(201).json({
            success: true,
            message: "Attribute created successfully!",
            data: attribute
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listar atributos
 */
const getAttributes = async (req, res, next) => {
    try {
        const { isActive, isRequired } = req.query;
        const filter = {};

        // Aplicar store isolation
        if (!req.user.isMasterAdmin) {
            filter.store = req.user.store;
        } else if (req.storeId) {
            filter.store = req.storeId;
        }

        // Filtros opcionais
        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }

        if (isRequired !== undefined) {
            filter.isRequired = isRequired === 'true';
        }

        const attributes = await Attribute.find(filter)
            .sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: attributes.length,
            data: attributes
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter atributo por ID
 */
const getAttributeById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const attribute = await Attribute.findById(id);

        if (!attribute) {
            const error = createHttpError(404, "Attribute not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && attribute.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Attribute belongs to different store!");
            return next(error);
        }

        res.status(200).json({
            success: true,
            data: attribute
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Atualizar atributo
 */
const updateAttribute = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, isRequired, minSelected, maxSelected, options, isActive } = req.body;

        const attribute = await Attribute.findById(id);

        if (!attribute) {
            const error = createHttpError(404, "Attribute not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && attribute.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Attribute belongs to different store!");
            return next(error);
        }

        // Verificar duplicidade se nome foi alterado
        if (name && name !== attribute.name) {
            const existing = await Attribute.findOne({
                store: attribute.store,
                name: new RegExp(`^${name}$`, 'i'),
                _id: { $ne: attribute._id }
            });

            if (existing) {
                const error = createHttpError(400, "Attribute with this name already exists!");
                return next(error);
            }
        }

        // Validar isRequired com minSelected
        if (isRequired && (!minSelected || minSelected < 1)) {
            const error = createHttpError(400, "Required attributes must have minSelected >= 1!");
            return next(error);
        }

        // Validar maxSelected >= minSelected
        if (maxSelected !== undefined && maxSelected !== null && maxSelected < (minSelected || attribute.minSelected)) {
            const error = createHttpError(400, "maxSelected must be greater than or equal to minSelected!");
            return next(error);
        }

        // Atualizar campos
        if (name !== undefined) attribute.name = name;
        if (description !== undefined) attribute.description = description;
        if (isRequired !== undefined) attribute.isRequired = isRequired;
        if (minSelected !== undefined) attribute.minSelected = minSelected;
        if (maxSelected !== undefined) attribute.maxSelected = maxSelected;
        if (options !== undefined) attribute.options = options;
        if (isActive !== undefined) attribute.isActive = isActive;

        await attribute.save();

        res.status(200).json({
            success: true,
            message: "Attribute updated successfully!",
            data: attribute
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Adicionar opção ao atributo
 */
const addOption = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, price } = req.body;

        if (!name) {
            const error = createHttpError(400, "Option name is required!");
            return next(error);
        }

        const attribute = await Attribute.findById(id);

        if (!attribute) {
            const error = createHttpError(404, "Attribute not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && attribute.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Attribute belongs to different store!");
            return next(error);
        }

        // Verificar se opção já existe
        const existingOption = attribute.options.find(
            o => o.name.toLowerCase() === name.toLowerCase()
        );

        if (existingOption) {
            const error = createHttpError(400, "Option with this name already exists!");
            return next(error);
        }

        // Usar método do model para adicionar opção
        const option = await attribute.addOption(name, price || 0);

        res.status(200).json({
            success: true,
            message: "Option added successfully!",
            data: option
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Atualizar opção
 */
const updateOption = async (req, res, next) => {
    try {
        const { attributeId, optionId } = req.params;
        const { name, price } = req.body;

        const attribute = await Attribute.findById(attributeId);

        if (!attribute) {
            const error = createHttpError(404, "Attribute not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && attribute.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Attribute belongs to different store!");
            return next(error);
        }

        const option = attribute.options.id(optionId);

        if (!option) {
            const error = createHttpError(404, "Option not found!");
            return next(error);
        }

        // Atualizar campos
        if (name !== undefined) option.name = name;
        if (price !== undefined) option.price = price;

        await attribute.save();

        res.status(200).json({
            success: true,
            message: "Option updated successfully!",
            data: option
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Remover opção
 */
const removeOption = async (req, res, next) => {
    try {
        const { attributeId, optionId } = req.params;

        const attribute = await Attribute.findById(attributeId);

        if (!attribute) {
            const error = createHttpError(404, "Attribute not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && attribute.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Attribute belongs to different store!");
            return next(error);
        }

        const option = attribute.options.id(optionId);

        if (!option) {
            const error = createHttpError(404, "Option not found!");
            return next(error);
        }

        // Não permitir remover se for obrigatório e for a única opção
        if (attribute.isRequired && attribute.options.length <= 1) {
            const error = createHttpError(400, "Required attribute must have at least one option!");
            return next(error);
        }

        option.remove();
        await attribute.save();

        res.status(200).json({
            success: true,
            message: "Option removed successfully!"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Ativar/Desativar atributo
 */
const toggleAttributeStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        const attribute = await Attribute.findById(id);

        if (!attribute) {
            const error = createHttpError(404, "Attribute not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && attribute.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Attribute belongs to different store!");
            return next(error);
        }

        attribute.isActive = isActive;
        await attribute.save();

        res.status(200).json({
            success: true,
            message: `Attribute ${isActive ? 'activated' : 'deactivated'} successfully!`,
            data: attribute
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Deletar atributo
 */
const deleteAttribute = async (req, res, next) => {
    try {
        const { id } = req.params;

        const attribute = await Attribute.findById(id);

        if (!attribute) {
            const error = createHttpError(404, "Attribute not found!");
            return next(error);
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && attribute.store.toString() !== req.user.store.toString()) {
            const error = createHttpError(403, "Access denied: Attribute belongs to different store!");
            return next(error);
        }

        await Attribute.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: "Attribute deleted successfully!"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Validar seleção de opções
 */
const validateSelection = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { selectedOptions } = req.body;

        if (!selectedOptions || !Array.isArray(selectedOptions)) {
            const error = createHttpError(400, "selectedOptions array is required!");
            return next(error);
        }

        const attribute = await Attribute.findById(id);

        if (!attribute) {
            const error = createHttpError(404, "Attribute not found!");
            return next(error);
        }

        const result = attribute.validateSelection(selectedOptions);

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createAttribute,
    getAttributes,
    getAttributeById,
    updateAttribute,
    addOption,
    updateOption,
    removeOption,
    toggleAttributeStatus,
    deleteAttribute,
    validateSelection
};
