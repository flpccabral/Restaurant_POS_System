const createHttpError = require("http-errors");
const Store = require("../models/storeModel");

/**
 * Criar nova loja (apenas Master Admin do sistema)
 */
const createStore = async (req, res, next) => {
    try {
        const { name, cnpj, email, phone, address, subscriptionPlan, settings } = req.body;

        if (!name || !cnpj || !email || !phone) {
            const error = createHttpError(400, "Name, CNPJ, email and phone are required!");
            return next(error);
        }

        // Verificar se CNPJ já existe
        const existingStore = await Store.findOne({ cnpj });
        if (existingStore) {
            const error = createHttpError(400, "CNPJ already registered!");
            return next(error);
        }

        const store = await Store.create({
            name,
            cnpj,
            email,
            phone,
            address,
            subscriptionPlan: subscriptionPlan || 'basic',
            settings: settings || {}
        });

        res.status(201).json({
            success: true,
            message: "Store created successfully!",
            data: store
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listar lojas
 */
const getStores = async (req, res, next) => {
    try {
        const { isActive, subscriptionPlan } = req.query;
        const filter = {};

        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }

        if (subscriptionPlan) {
            filter.subscriptionPlan = subscriptionPlan;
        }

        // Se não for master admin, mostrar apenas sua loja
        if (!req.user || !req.user.isMasterAdmin) {
            filter._id = req.user.store;
        }

        const stores = await Store.find(filter).sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: stores.length,
            data: stores
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter detalhes de uma loja
 */
const getStoreById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const store = await Store.findById(id);

        if (!store) {
            const error = createHttpError(404, "Store not found!");
            return next(error);
        }

        res.status(200).json({
            success: true,
            data: store
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Atualizar loja
 */
const updateStore = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Remover campos que não podem ser atualizados
        delete updateData._id;
        delete updateData.storeId;
        delete updateData.cnpj;

        const store = await Store.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!store) {
            const error = createHttpError(404, "Store not found!");
            return next(error);
        }

        res.status(200).json({
            success: true,
            message: "Store updated successfully!",
            data: store
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Ativar/Desativar loja
 */
const toggleStoreStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        const store = await Store.findByIdAndUpdate(
            id,
            { isActive },
            { new: true }
        );

        if (!store) {
            const error = createHttpError(404, "Store not found!");
            return next(error);
        }

        res.status(200).json({
            success: true,
            message: `Store ${isActive ? 'activated' : 'deactivated'} successfully!`,
            data: store
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter configurações da loja atual
 */
const getCurrentStoreSettings = async (req, res, next) => {
    try {
        if (!req.user || !req.user.store) {
            const error = createHttpError(404, "Store not found!");
            return next(error);
        }

        const store = await Store.findById(req.user.store);

        if (!store) {
            const error = createHttpError(404, "Store not found!");
            return next(error);
        }

        res.status(200).json({
            success: true,
            data: {
                _id: store._id,
                storeId: store.storeId,
                name: store.name,
                cnpj: store.cnpj,
                email: store.email,
                phone: store.phone,
                address: store.address,
                subscriptionPlan: store.subscriptionPlan,
                settings: store.settings,
                isActive: store.isActive
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter configuracao de gorjeta/servico da loja atual
 */
const getServiceChargeConfig = async (req, res, next) => {
    try {
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;
        const store = await Store.findById(storeRef);

        if (!store) {
            throw createHttpError(404, "Loja nao encontrada!");
        }

        res.status(200).json({
            success: true,
            data: store.settings?.serviceCharge || {
                enabled: true,
                rate: 10,
                mode: 'optional'
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Atualizar configuracao de gorjeta/servico da loja atual
 */
const updateServiceChargeConfig = async (req, res, next) => {
    try {
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;
        const { enabled, rate, mode } = req.body;

        const store = await Store.findById(storeRef);
        if (!store) {
            throw createHttpError(404, "Loja nao encontrada!");
        }

        // Validacoes
        if (rate !== undefined && (rate < 0 || rate > 100)) {
            throw createHttpError(400, "Taxa de servico deve estar entre 0 e 100!");
        }
        if (mode !== undefined && !['optional', 'mandatory', 'disabled'].includes(mode)) {
            throw createHttpError(400, "Modo invalido! Use: optional, mandatory ou disabled");
        }

        // Atualizar configuracao
        if (!store.settings) store.settings = {};
        if (!store.settings.serviceCharge) store.settings.serviceCharge = {};

        if (enabled !== undefined) store.settings.serviceCharge.enabled = enabled;
        if (rate !== undefined) store.settings.serviceCharge.rate = rate;
        if (mode !== undefined) store.settings.serviceCharge.mode = mode;

        await store.save();

        res.status(200).json({
            success: true,
            message: "Configuracao de gorjeta atualizada!",
            data: store.settings.serviceCharge
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createStore,
    getStores,
    getStoreById,
    updateStore,
    toggleStoreStatus,
    getCurrentStoreSettings,
    getServiceChargeConfig,
    updateServiceChargeConfig
};
