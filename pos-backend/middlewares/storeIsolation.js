const createHttpError = require("http-errors");
const Store = require("../models/storeModel");

/**
 * Middleware para isolamento de dados por loja (Multi-tenancy)
 *
 * Funcionamento:
 * - Usuários normais: dados filtrados automaticamente pela sua store
 * - Master Admin: pode acessar todas as lojas ou filtrar via query param
 *
 * O storeId é injetado em req.storeId para uso transparente nos controllers
 */
const storeIsolation = async (req, res, next) => {
    try {
        const user = req.user;

        if (!user) {
            const error = createHttpError(401, "User not authenticated!");
            return next(error);
        }

        // Master Admin pode acessar todas as lojas ou filtrar por uma específica
        if (user.isMasterAdmin) {
            const { storeId } = req.query;

            if (storeId) {
                // Validar se a store existe
                const store = await Store.findOne({
                    $or: [
                        { storeId },
                        { _id: storeId }
                    ]
                });

                if (!store) {
                    const error = createHttpError(404, "Store not found!");
                    return next(error);
                }

                req.storeId = store._id.toString();
                req.store = store;
            } else {
                // Sem filtro = acessa todas as lojas (para listagens gerais)
                req.storeId = null;
                req.store = null;
            }

            // Flag para controllers saberem que é master admin
            req.isMasterAdmin = true;

            return next();
        }

        // Usuário comum: usa obrigatoriamente a store do próprio usuário
        if (!user.store) {
            const error = createHttpError(403, "User not associated with any store!");
            return next(error);
        }

        // Injetar storeId para uso transparente nos controllers
        req.storeId = user.store.toString();

        // Popula a store para referência
        const store = await Store.findById(user.store);
        req.store = store;
        req.isMasterAdmin = false;

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Middleware para forçar storeId em rotas específicas
 * Usado quando mesmo Master Admin precisa especificar uma store
 */
const requireStore = async (req, res, next) => {
    if (!req.storeId) {
        const error = createHttpError(
            400,
            "Store ID is required. Master Admins: pass storeId in query params."
        );
        return next(error);
    }
    next();
};

/**
 * Helper para aplicar filtro de store em queries Mongoose
 * Retorna um objeto filter pronto para uso
 *
 * @param {Object} req - Request object
 * @param {Object} additionalFilters - Filtros adicionais para aplicar
 * @returns {Object} Filter object para usar em Model.find() ou Model.findOne()
 */
const getStoreFilter = (req, additionalFilters = {}) => {
    const filter = { ...additionalFilters };

    // Se req.storeId existe e não é null, aplicar filtro
    if (req.storeId) {
        filter.storeId = req.storeId;
    }

    // Para modelos que usam ref Store em vez de storeId string
    if (req.user?.store && !req.isMasterAdmin) {
        filter.store = req.user.store;
    }

    return filter;
};

/**
 * Helper para aplicar filtro de store em agregações MongoDB
 * Adiciona $match no início do pipeline
 *
 * @param {Object} req - Request object
 * @param {Array} pipeline - Aggregation pipeline
 * @returns {Array} Pipeline com $match de store adicionado
 */
const applyStoreToAggregation = (req, pipeline) => {
    const storeMatch = {};

    if (req.storeId) {
        storeMatch.storeId = req.storeId;
    } else if (req.user?.store && !req.isMasterAdmin) {
        storeMatch.store = req.user.store;
    }

    // Se não tem filtro, retorna pipeline original
    if (Object.keys(storeMatch).length === 0) {
        return pipeline;
    }

    // Adicionar $match no início do pipeline
    return [
        { $match: storeMatch },
        ...pipeline
    ];
};

/**
 * Decorator para methods de Model que automaticamente aplica store filter
 *
 * Uso:
 *   const filter = applyStoreFilter(req, { status: 'active', category: 'food' });
 *   const items = await Item.find(filter);
 */
const applyStoreFilter = (req, filter = {}) => {
    return getStoreFilter(req, filter);
};

module.exports = {
    storeIsolation,
    requireStore,
    getStoreFilter,
    applyStoreToAggregation,
    applyStoreFilter
};
