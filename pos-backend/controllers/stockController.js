const createHttpError = require("http-errors");
const StockBalance = require("../models/stockBalanceModel");
const StockMovement = require("../models/stockMovementModel");
const StockAlert = require("../models/stockAlertModel");
const GlobalIngredient = require("../models/globalIngredientModel");
const recipeService = require("../services/recipeService");

/**
 * Obter saldo de estoque
 */
const getStockBalance = async (req, res, next) => {
    try {
        const { ingredient, needsRestock } = req.query;
        const filter = {};

        // Aplicar store isolation
        if (!req.user.isMasterAdmin) {
            filter.store = req.user.store;
        } else if (req.storeId) {
            filter.store = req.storeId;
        }

        // Filtros opcionais
        if (ingredient) {
            filter.ingredient = ingredient;
        }

        if (needsRestock === 'true') {
            filter.minimumStock = { $gt: 0 };
        }

        const stockItems = await StockBalance.find(filter)
            .populate('ingredient', 'name category unit')
            .populate('supplier', 'name email')
            .sort({ balance: 1 });

        res.status(200).json({
            success: true,
            count: stockItems.length,
            data: stockItems.map(item => ({
                ...item.toObject(),
                needsRestock: item.needsRestock,
                totalValue: item.totalValue
            }))
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Atualizar saldo de estoque (entrada/saída manual)
 */
const updateStockBalance = async (req, res, next) => {
    try {
        const { ingredientId, quantity, unit, minimumStock, lastPurchasePrice, supplier } = req.body;

        if (!ingredientId) {
            const error = createHttpError(400, "Ingredient ID is required!");
            return next(error);
        }

        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Verificar se ingrediente existe
        const ingredient = await GlobalIngredient.findById(ingredientId);
        if (!ingredient) {
            const error = createHttpError(400, "Ingredient not found!");
            return next(error);
        }

        // Buscar ou criar saldo
        let stockBalance = await StockBalance.findOne({
            store: storeRef,
            ingredient: ingredientId
        });

        if (!stockBalance) {
            stockBalance = await StockBalance.create({
                store: storeRef,
                ingredient: ingredientId,
                balance: 0,
                reserved: 0,
                available: 0,
                unit: unit || ingredient.baseUnit,
                minimumStock: minimumStock || 0
            });
        }

        // Atualizar campos
        if (quantity !== undefined) stockBalance.balance = quantity;
        if (minimumStock !== undefined) stockBalance.minimumStock = minimumStock;
        if (lastPurchasePrice !== undefined) stockBalance.lastPurchasePrice = lastPurchasePrice;
        if (supplier !== undefined) stockBalance.supplier = supplier;
        if (unit !== undefined) stockBalance.unit = unit;

        await stockBalance.save();

        const populatedStock = await StockBalance.findById(stockBalance._id)
            .populate('ingredient', 'name category')
            .populate('supplier', 'name email');

        res.status(200).json({
            success: true,
            message: "Stock balance updated successfully!",
            data: {
                ...populatedStock.toObject(),
                needsRestock: stockBalance.needsRestock,
                totalValue: stockBalance.totalValue
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Registrar entrada de estoque
 */
const stockIn = async (req, res, next) => {
    try {
        const { ingredientId, quantity, price, reason, supplierId } = req.body;

        // Validação
        if (!ingredientId || !quantity || quantity <= 0) {
            const error = createHttpError(400, "Ingredient ID and positive quantity are required!");
            return next(error);
        }

        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Buscar saldo
        let stockBalance = await StockBalance.findOne({
            store: storeRef,
            ingredient: ingredientId
        }).populate('ingredient');

        if (!stockBalance) {
            const ingredient = await GlobalIngredient.findById(ingredientId);
            if (!ingredient) {
                const error = createHttpError(400, "Ingredient not found!");
                return next(error);
            }

            stockBalance = await StockBalance.create({
                store: storeRef,
                ingredient: ingredientId,
                balance: 0,
                reserved: 0,
                available: 0,
                unit: ingredient.baseUnit,
                minimumStock: 0
            });
        }

        // Criar movimento de entrada
        const movement = await StockMovement.createMovement({
            store: storeRef,
            ingredient: ingredientId,
            type: 'in',
            quantity,
            unit: stockBalance.unit,
            reason: reason || 'Entrada manual de estoque',
            user: req.user._id,
            metadata: {
                price,
                supplierId
            }
        });

        // Atualizar preço da última compra
        if (price !== undefined) {
            stockBalance.lastPurchasePrice = price;
            stockBalance.lastPurchaseDate = new Date();
        }
        if (supplierId) {
            stockBalance.supplier = supplierId;
        }
        await stockBalance.save();

        res.status(200).json({
            success: true,
            message: "Stock entry registered successfully!",
            data: {
                movement,
                newBalance: stockBalance.balance
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Registrar saída de estoque
 */
const stockOut = async (req, res, next) => {
    try {
        const { ingredientId, quantity, reason } = req.body;

        // Validação
        if (!ingredientId || !quantity || quantity <= 0) {
            const error = createHttpError(400, "Ingredient ID and positive quantity are required!");
            return next(error);
        }

        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Criar movimento de saída
        const movement = await StockMovement.createMovement({
            store: storeRef,
            ingredient: ingredientId,
            type: 'out',
            quantity,
            unit: 'auto',
            reason: reason || 'Saída manual de estoque',
            user: req.user._id
        });

        res.status(200).json({
            success: true,
            message: "Stock output registered successfully!",
            data: {
                movement,
                newBalance: movement.balanceAfter
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Ajuste manual de estoque
 */
const stockAdjustment = async (req, res, next) => {
    try {
        const { ingredientId, quantity, reason } = req.body;

        // Validação
        if (!ingredientId || quantity === undefined) {
            const error = createHttpError(400, "Ingredient ID and quantity are required!");
            return next(error);
        }

        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Buscar saldo
        const stockBalance = await StockBalance.findOne({
            store: storeRef,
            ingredient: ingredientId
        });

        if (!stockBalance) {
            const error = createHttpError(404, "Stock balance not found!");
            return next(error);
        }

        // Criar movimento de ajuste
        const movement = await StockMovement.create({
            store: storeRef,
            ingredient: ingredientId,
            type: 'adjustment',
            quantity,
            unit: stockBalance.unit,
            balanceBefore: stockBalance.balance,
            balanceAfter: quantity,
            reason: reason || 'Ajuste manual',
            user: req.user._id
        });

        // Atualizar saldo
        stockBalance.balance = quantity;
        await stockBalance.save();

        res.status(200).json({
            success: true,
            message: "Stock adjustment registered successfully!",
            data: {
                movement,
                previousBalance: movement.balanceBefore,
                newBalance: movement.balanceAfter
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Histórico de movimentos
 */
const getStockHistory = async (req, res, next) => {
    try {
        const { ingredientId, type, limit } = req.query;
        const filter = {};

        // Aplicar store isolation
        if (!req.user.isMasterAdmin) {
            filter.store = req.user.store;
        } else if (req.storeId) {
            filter.store = req.storeId;
        }

        // Filtros opcionais
        if (ingredientId) {
            filter.ingredient = ingredientId;
        }

        if (type) {
            filter.type = type;
        }

        const movements = await StockMovement.find(filter)
            .populate('ingredient', 'name category')
            .populate('user', 'name email')
            .populate('recipe', 'name')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit) || 50);

        res.status(200).json({
            success: true,
            count: movements.length,
            data: movements
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter alertas de estoque
 */
const getStockAlerts = async (req, res, next) => {
    try {
        const { status, type, severity } = req.query;

        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        const alerts = await StockAlert.getStoreAlerts(storeRef, {
            status,
            type,
            severity
        });

        res.status(200).json({
            success: true,
            count: alerts.length,
            data: alerts
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Verificar e criar alertas
 */
const checkStockAlerts = async (req, res, next) => {
    try {
        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        const alerts = await StockAlert.checkAndCreateAlerts(storeRef);

        res.status(200).json({
            success: true,
            message: `Checked and created ${alerts.length} new alerts`,
            data: alerts
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Reconhecer alerta
 */
const acknowledgeAlert = async (req, res, next) => {
    try {
        const { id } = req.params;

        const alert = await StockAlert.findById(id);

        if (!alert) {
            const error = createHttpError(404, "Alert not found!");
            return next(error);
        }

        await alert.acknowledge(req.user._id);

        res.status(200).json({
            success: true,
            message: "Alert acknowledged!",
            data: alert
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

        const alert = await StockAlert.findById(id);

        if (!alert) {
            const error = createHttpError(404, "Alert not found!");
            return next(error);
        }

        await alert.resolve(req.user._id, notes);

        res.status(200).json({
            success: true,
            message: "Alert resolved!",
            data: alert
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Gerar lista de compras
 */
const generateShoppingList = async (req, res, next) => {
    try {
        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        const shoppingList = await recipeService.generateShoppingList(storeRef);

        res.status(200).json({
            success: true,
            data: shoppingList
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obter alertas de reposição
 */
const getRestockAlerts = async (req, res, next) => {
    try {
        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        const alerts = await recipeService.getRestockAlerts(storeRef);

        res.status(200).json({
            success: true,
            count: alerts.length,
            data: alerts
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getStockBalance,
    updateStockBalance,
    stockIn,
    stockOut,
    stockAdjustment,
    getStockHistory,
    getStockAlerts,
    checkStockAlerts,
    acknowledgeAlert,
    resolveAlert,
    generateShoppingList,
    getRestockAlerts
};
