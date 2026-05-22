const createHttpError = require("http-errors");
const stockHealthService = require("../services/stockHealthService");
const replenishmentService = require("../services/replenishmentService");
const observabilityService = require("../services/observabilityService");

/**
 * Saúde do estoque por loja
 */
const getStockHealth = async (req, res, next) => {
    try {
        const { storeId } = req.params;
        const { locationId } = req.query;

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;
        const targetStoreId = req.user.isMasterAdmin ? (storeId || storeRef) : storeRef;

        const health = await stockHealthService.getStoreStockHealth(targetStoreId, { locationId });

        res.status(200).json({
            success: true,
            data: health
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Saúde de um ingrediente na rede
 */
const getIngredientHealth = async (req, res, next) => {
    try {
        const { ingredientId } = req.params;

        const health = await stockHealthService.getIngredientNetworkHealth(ingredientId);

        res.status(200).json({
            success: true,
            data: health
        });
    } catch (error) {
        if (error.message === 'Ingredient not found') {
            return next(createHttpError(404, error.message));
        }
        next(error);
    }
};

/**
 * Recomendações para uma loja
 */
const getStoreRecommendations = async (req, res, next) => {
    try {
        const { storeId } = req.params;

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;
        const targetStoreId = req.user.isMasterAdmin ? (storeId || storeRef) : storeRef;

        const recs = await replenishmentService.generateStoreRecommendations(targetStoreId);

        res.status(200).json({
            success: true,
            data: recs
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Recomendações da rede
 */
const getNetworkRecommendations = async (req, res, next) => {
    try {
        const recs = await replenishmentService.generateNetworkRecommendations();

        res.status(200).json({
            success: true,
            data: recs
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listar alertas operacionais
 */
const getAlerts = async (req, res, next) => {
    try {
        const { storeId, status, type, severity, ingredient, limit } = req.query;

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;
        const targetStoreId = req.user.isMasterAdmin ? (storeId || storeRef) : storeRef;

        const alerts = await observabilityService.getAlerts(targetStoreId, {
            status,
            type,
            severity,
            ingredient,
            limit: parseInt(limit) || 50
        });

        res.status(200).json({
            success: true,
            data: alerts
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Resolver alerta
 */
const resolveAlert = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const alert = await observabilityService.resolveAlert(id, req.user._id, notes);

        res.status(200).json({
            success: true,
            message: "Alert resolved successfully!",
            data: alert
        });
    } catch (error) {
        if (error.message === 'Alert not found') {
            return next(createHttpError(404, error.message));
        }
        if (error.message.includes('already')) {
            return next(createHttpError(400, error.message));
        }
        next(error);
    }
};

/**
 * Timeline operacional
 */
const getTimeline = async (req, res, next) => {
    try {
        const { storeId, startDate, endDate, ingredient, limit } = req.query;

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;
        const targetStoreId = req.user.isMasterAdmin ? (storeId || storeRef) : storeRef;

        const timeline = await observabilityService.getOperationalTimeline(targetStoreId, {
            startDate,
            endDate,
            ingredientId: ingredient,
            limit: parseInt(limit) || 100
        });

        res.status(200).json({
            success: true,
            data: timeline
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Gerar alertas para uma loja
 */
const generateAlerts = async (req, res, next) => {
    try {
        const { storeId } = req.params;

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;
        const targetStoreId = req.user.isMasterAdmin ? (storeId || storeRef) : storeRef;

        const result = await observabilityService.generateAlerts(targetStoreId);

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getStockHealth,
    getIngredientHealth,
    getStoreRecommendations,
    getNetworkRecommendations,
    getAlerts,
    resolveAlert,
    getTimeline,
    generateAlerts
};
