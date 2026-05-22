const createHttpError = require("http-errors");
const StockPolicy = require("../models/stockPolicyModel");
const StockLocation = require("../models/stockLocationModel");

/**
 * Criar política de estoque
 */
const createStockPolicy = async (req, res, next) => {
    try {
        const { storeId, locationId, ingredientId, minQuantity, reorderPoint, idealQuantity, maxQuantity, unit, priority } = req.body;

        if (!storeId || !locationId || !ingredientId) {
            const error = createHttpError(400, "Store, location and ingredient are required!");
            return next(error);
        }
        if (minQuantity === undefined || reorderPoint === undefined || idealQuantity === undefined || maxQuantity === undefined) {
            const error = createHttpError(400, "All quantity fields (min, reorder, ideal, max) are required!");
            return next(error);
        }

        // Validar location pertence à store
        const location = await StockLocation.findById(locationId);
        if (!location) {
            const error = createHttpError(404, "Location not found!");
            return next(error);
        }
        if (location.store.toString() !== storeId.toString()) {
            const error = createHttpError(400, "Location does not belong to the specified store!");
            return next(error);
        }

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;
        if (!req.user.isMasterAdmin && location.store.toString() !== storeRef.toString()) {
            const error = createHttpError(403, "Access denied!");
            return next(error);
        }

        const policy = await StockPolicy.create({
            store: storeId,
            location: locationId,
            ingredient: ingredientId,
            minQuantity,
            reorderPoint,
            idealQuantity,
            maxQuantity,
            unit: unit || 'g',
            priority: priority || 'medium',
            isActive: true
        });

        res.status(201).json({
            success: true,
            message: "Stock policy created successfully!",
            data: policy
        });
    } catch (error) {
        if (error.code === 11000) {
            return next(createHttpError(409, "A policy already exists for this store/location/ingredient combination!"));
        }
        next(error);
    }
};

/**
 * Listar políticas de estoque
 */
const listStockPolicies = async (req, res, next) => {
    try {
        const { storeId, locationId, ingredientId, isActive } = req.query;

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;
        const filter = {};

        if (storeId) {
            if (!req.user.isMasterAdmin && storeId.toString() !== storeRef.toString()) {
                const error = createHttpError(403, "Access denied!");
                return next(error);
            }
            filter.store = storeId;
        } else {
            filter.store = storeRef;
        }

        if (locationId) filter.location = locationId;
        if (ingredientId) filter.ingredient = ingredientId;
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        const policies = await StockPolicy.find(filter)
            .populate('ingredient', 'name category baseUnit itemType productionState')
            .populate('location', 'name type')
            .populate('store', 'name operationType')
            .sort({ priority: -1, createdAt: -1 })
            .limit(200);

        res.status(200).json({
            success: true,
            count: policies.length,
            data: policies
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Atualizar política de estoque
 */
const updateStockPolicy = async (req, res, next) => {
    try {
        const policy = await StockPolicy.findById(req.params.id);
        if (!policy) {
            const error = createHttpError(404, "Stock policy not found!");
            return next(error);
        }

        const { minQuantity, reorderPoint, idealQuantity, maxQuantity, unit, priority, isActive } = req.body;

        if (minQuantity !== undefined) policy.minQuantity = minQuantity;
        if (reorderPoint !== undefined) policy.reorderPoint = reorderPoint;
        if (idealQuantity !== undefined) policy.idealQuantity = idealQuantity;
        if (maxQuantity !== undefined) policy.maxQuantity = maxQuantity;
        if (unit !== undefined) policy.unit = unit;
        if (priority !== undefined) policy.priority = priority;
        if (isActive !== undefined) policy.isActive = isActive;

        await policy.save();

        res.status(200).json({
            success: true,
            message: "Stock policy updated successfully!",
            data: policy
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Deletar política de estoque (soft delete)
 */
const deleteStockPolicy = async (req, res, next) => {
    try {
        const policy = await StockPolicy.findById(req.params.id);
        if (!policy) {
            const error = createHttpError(404, "Stock policy not found!");
            return next(error);
        }

        policy.isActive = false;
        await policy.save();

        res.status(200).json({
            success: true,
            message: "Stock policy deactivated successfully!",
            data: policy
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createStockPolicy,
    listStockPolicies,
    updateStockPolicy,
    deleteStockPolicy
};
