const mongoose = require("mongoose");
const createHttpError = require("http-errors");
const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const StockAlert = require("../models/stockAlertModel");
const StockBalance = require("../models/stockBalanceModel");
const StockMovement = require("../models/stockMovementModel");
const Recipe = require("../models/recipeModel");
const Store = require("../models/storeModel");

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve storeId: se usuário é master admin, usa query param; senão, usa store do user.
 */
function resolveStoreId(req) {
    if (req.user?.isMasterAdmin && req.query.storeId) {
        if (!mongoose.Types.ObjectId.isValid(req.query.storeId)) {
            throw createHttpError(400, "Invalid storeId parameter");
        }
        return new mongoose.Types.ObjectId(req.query.storeId);
    }
    if (!req.user?.store) {
        throw createHttpError(403, "No store associated with user");
    }
    return new mongoose.Types.ObjectId(req.user.store);
}

/**
 * Converter período (query param) em { startDate, endDate }.
 */
function getDateRange(period) {
    const now = new Date();
    const start = new Date();

    switch (period) {
        case "today":
            start.setHours(0, 0, 0, 0);
            break;
        case "yesterday":
            start.setDate(start.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            now.setDate(now.getDate() - 1);
            now.setHours(23, 59, 59, 999);
            break;
        case "7days":
            start.setDate(start.getDate() - 7);
            break;
        case "30days":
            start.setDate(start.getDate() - 30);
            break;
        case "this_week": {
            const dayOfWeek = now.getDay();
            start.setDate(now.getDate() - dayOfWeek);
            start.setHours(0, 0, 0, 0);
            break;
        }
        case "this_month":
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            break;
        case "last_month": {
            const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
            start.setTime(firstDayLastMonth.getTime());
            now.setTime(lastDayLastMonth.getTime());
            now.setHours(23, 59, 59, 999);
            break;
        }
        default:
            start.setDate(start.getDate() - 30);
    }

    return { start, end: now };
}

/**
 * Classificação do CMV com benchmarks do setor.
 */
function classifyCMV(cmvPercent) {
    if (cmvPercent < 25) return { level: "excelente", color: "green" };
    if (cmvPercent <= 35) return { level: "dentro_da_media", color: "green" };
    if (cmvPercent <= 45) return { level: "atencao", color: "yellow" };
    return { level: "critico", color: "red" };
}

/**
 * Formatar data para exibição pt-BR.
 */
function formatDateBR(date) {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${d}/${m}`;
}

/**
 * Formatar resposta padrão.
 */
function respond(res, data, period, storeId) {
    return res.status(200).json({
        success: true,
        data,
        metadata: {
            period,
            storeId: storeId.toString()
        }
    });
}

// ─── A) GET /api/dashboard/kpi ──────────────────────────────────────────────

const getDashboardKPIs = async (req, res, next) => {
    try {
        const period = req.query.period || "today";
        const storeId = resolveStoreId(req);
        const { start, end } = getDateRange(period);

        // ── 1. Métricas de pedidos (Orders) ──────────────────────────────
        const orderAgg = await Order.aggregate([
            {
                $match: {
                    store: storeId,
                    orderDate: { $gte: start, $lte: end },
                    orderStatus: { $nin: ["cancelled"] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$bills.totalWithTax" },
                    totalTax: { $sum: "$bills.tax" },
                    orderCount: { $sum: 1 }
                }
            }
        ]);

        const { totalRevenue = 0, totalTax = 0, orderCount = 0 } = orderAgg[0] || {};
        const netRevenue = totalRevenue - totalTax;
        const avgTicket = orderCount > 0 ? netRevenue / orderCount : 0;

        // ── 2. Taxa da loja (para cálculos de receita líquida real) ─────
        const store = await Store.findById(storeId, "settings.taxRate settings.currency");
        const taxRate = store?.settings?.taxRate || 0;

        // ── 3. Alertas de estoque ativos ────────────────────────────────
        const activeAlerts = await StockAlert.countDocuments({
            store: storeId,
            status: { $in: ["pending", "acknowledged"] }
        });

        // ── 4. Produtos ativos ──────────────────────────────────────────
        const activeProducts = await Product.countDocuments({
            store: storeId,
            isActive: true,
            isCurrent: true
        });

        respond(res, {
            revenue: {
                gross: totalRevenue,
                net: netRevenue,
                tax: totalTax
            },
            orders: {
                count: orderCount,
                avgTicket
            },
            operational: {
                activeAlerts,
                activeProducts
            },
            store: {
                taxRate,
                currency: store?.settings?.currency || "BRL"
            }
        }, period, storeId);
    } catch (error) {
        next(error);
    }
};

// ─── B) GET /api/dashboard/sales ────────────────────────────────────────────

const getSalesReport = async (req, res, next) => {
    try {
        const period = req.query.period || "7days";
        const groupBy = req.query.groupBy || "day"; // "day", "week", "month", "hour"
        const storeId = resolveStoreId(req);
        const { start, end } = getDateRange(period);

        // Definir expressão de agrupamento por data
        let dateExpr;
        switch (groupBy) {
            case "hour":
                dateExpr = {
                    $dateToString: { format: "%Y-%m-%d %H", date: "$orderDate" }
                };
                break;
            case "day":
                dateExpr = {
                    $dateToString: { format: "%Y-%m-%d", date: "$orderDate" }
                };
                break;
            case "week":
                dateExpr = {
                    $dateToString: { format: "%Y-W%V", date: "$orderDate" }
                };
                break;
            case "month":
                dateExpr = {
                    $dateToString: { format: "%Y-%m", date: "$orderDate" }
                };
                break;
            default:
                dateExpr = {
                    $dateToString: { format: "%Y-%m-%d", date: "$orderDate" }
                };
        }

        const salesData = await Order.aggregate([
            {
                $match: {
                    store: storeId,
                    orderDate: { $gte: start, $lte: end },
                    orderStatus: { $nin: ["cancelled"] }
                }
            },
            {
                $group: {
                    _id: dateExpr,
                    revenue: { $sum: "$bills.totalWithTax" },
                    netRevenue: {
                        $sum: { $subtract: ["$bills.totalWithTax", "$bills.tax"] }
                    },
                    orders: { $sum: 1 },
                    tax: { $sum: "$bills.tax" },
                    avgTicket: { $avg: "$bills.totalWithTax" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Formatar para Recharts: [{ date: 'DD/MM', revenue, netRevenue, orders }]
        const formatted = salesData.map(item => {
            // Tentar extrair data legível do _id agrupado
            let displayDate = item._id;
            const dateParts = item._id.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (dateParts) {
                const [, year, month, day] = dateParts;
                displayDate = `${day}/${month}`;
            }

            return {
                date: displayDate,
                revenue: Math.round(item.revenue * 100) / 100,
                netRevenue: Math.round(item.netRevenue * 100) / 100,
                orders: item.orders,
                tax: Math.round(item.tax * 100) / 100,
                avgTicket: Math.round(item.avgTicket * 100) / 100
            };
        });

        const summary = {
            totalRevenue: Math.round(formatted.reduce((a, b) => a + b.revenue, 0) * 100) / 100,
            totalOrders: formatted.reduce((a, b) => a + b.orders, 0),
            avgDailyRevenue: formatted.length > 0
                ? Math.round((formatted.reduce((a, b) => a + b.revenue, 0) / formatted.length) * 100) / 100
                : 0
        };

        respond(res, {
            sales: formatted,
            summary,
            groupBy,
            dateRange: { start, end }
        }, period, storeId);
    } catch (error) {
        next(error);
    }
};

// ─── C) GET /api/dashboard/products/top ─────────────────────────────────────

const getTopProducts = async (req, res, next) => {
    try {
        const period = req.query.period || "7days";
        const limit = parseInt(req.query.limit) || 5;
        const storeId = resolveStoreId(req);
        const { start, end } = getDateRange(period);

        const topProducts = await Order.aggregate([
            {
                $match: {
                    store: storeId,
                    orderDate: { $gte: start, $lte: end },
                    orderStatus: { $nin: ["cancelled"] },
                    items: { $exists: true, $ne: [] }
                }
            },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.product",
                    productName: { $first: "$items.name" },
                    totalQuantity: { $sum: "$items.quantity" },
                    totalRevenue: {
                        $sum: { $multiply: ["$items.quantity", "$items.price"] }
                    },
                    timesOrdered: { $sum: 1 }
                }
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: limit }
        ]);

        // Se o $lookup com Products for necessário para nome, enriquecer aqui
        // Como já temos items.name, o nome já está disponível
        const products = topProducts.map(p => ({
            productId: p._id ? p._id.toString() : null,
            productName: p.productName || "Produto removido",
            totalQuantity: p.totalQuantity,
            totalRevenue: Math.round(p.totalRevenue * 100) / 100,
            timesOrdered: p.timesOrdered,
            avgPrice: p.totalQuantity > 0
                ? Math.round((p.totalRevenue / p.totalQuantity) * 100) / 100
                : 0
        }));

        respond(res, {
            period,
            limit,
            products
        }, period, storeId);
    } catch (error) {
        next(error);
    }
};

// ─── D) GET /api/dashboard/cmv ──────────────────────────────────────────────

const getCMVReport = async (req, res, next) => {
    try {
        const period = req.query.period || "30days";
        const storeId = resolveStoreId(req);
        const { start, end } = getDateRange(period);

        // ── 1. Receita total (vendas confirmadas) ────────────────────────
        const salesAgg = await Order.aggregate([
            {
                $match: {
                    store: storeId,
                    orderDate: { $gte: start, $lte: end },
                    orderStatus: { $nin: ["cancelled"] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$bills.totalWithTax" },
                    totalTax: { $sum: "$bills.tax" }
                }
            }
        ]);

        const { totalRevenue = 0, totalTax = 0 } = salesAgg[0] || {};
        const netRevenue = totalRevenue - totalTax;

        // ── 2. Custo das mercadorias vendidas (CMV) ─────────────────────
        // Método: somar o custo dos ingredientes consumidos via StockMovements do tipo recipe_deduction
        // (baixas automáticas do estoque baseadas em fichas técnicas quando pedidos são finalizados)
        const cmvAgg = await StockMovement.aggregate([
            {
                $match: {
                    store: storeId,
                    type: { $in: ["recipe_deduction", "out", "waste"] },
                    createdAt: { $gte: start, $lte: end }
                }
            },
            {
                $lookup: {
                    from: "stockbalances",
                    let: { ingredientId: "$ingredient" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$ingredient", "$$ingredientId"] },
                                        { $eq: ["$store", storeId] }
                                    ]
                                }
                            }
                        },
                        { $limit: 1 },
                        { $project: { lastPurchasePrice: 1 } }
                    ],
                    as: "stockInfo"
                }
            },
            {
                $addFields: {
                    unitCost: { $ifNull: [{ $first: "$stockInfo.lastPurchasePrice" }, 0] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalCost: {
                        $sum: { $multiply: ["$quantity", "$unitCost"] }
                    }
                }
            }
        ]);

        const totalCost = cmvAgg[0]?.totalCost || 0;

        // Se não há dados de StockMovement, fallback: usar Purchase Orders recebidos
        let costMethod = "stock_movements";
        let fallbackCost = 0;
        if (totalCost === 0) {
            const PurchaseOrder = mongoose.model("PurchaseOrder");
            const poAgg = await PurchaseOrder.aggregate([
                {
                    $match: {
                        store: storeId,
                        status: "received",
                        receivedDate: { $gte: start, $lte: end }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalCost: { $sum: "$total" }
                    }
                }
            ]);
            fallbackCost = poAgg[0]?.totalCost || 0;
            costMethod = "purchase_orders_fallback";
        }

        const effectiveCost = totalCost > 0 ? totalCost : fallbackCost;

        // ── 3. Cálculos de indicadores ───────────────────────────────────
        const cmvPercent = netRevenue > 0 ? (effectiveCost / netRevenue) * 100 : 0;
        const grossMargin = netRevenue > 0 ? ((netRevenue - effectiveCost) / netRevenue) * 100 : 0;
        const classification = classifyCMV(cmvPercent);

        respond(res, {
            cmv: {
                total: Math.round(effectiveCost * 100) / 100,
                percent: Math.round(cmvPercent * 100) / 100,
                method: costMethod
            },
            revenue: {
                gross: Math.round(totalRevenue * 100) / 100,
                net: Math.round(netRevenue * 100) / 100,
                tax: Math.round(totalTax * 100) / 100
            },
            margin: {
                gross: Math.round(grossMargin * 100) / 100,
                amount: Math.round((netRevenue - effectiveCost) * 100) / 100
            },
            classification,
            benchmarks: {
                excelente: "< 25%",
                dentro_da_media: "25% - 35%",
                atencao: "35% - 45%",
                critico: "> 45%"
            },
            dateRange: { start, end }
        }, period, storeId);
    } catch (error) {
        next(error);
    }
};

// ─── E) GET /api/dashboard/variance ─────────────────────────────────────────

const getVarianceAnalysis = async (req, res, next) => {
    try {
        const period = req.query.period || "7days";
        const storeId = resolveStoreId(req);
        const { start, end } = getDateRange(period);

        // ── 1. Consumo Real: StockMovements (recipe_deduction + waste + out) ──
        const realConsumption = await StockMovement.aggregate([
            {
                $match: {
                    store: storeId,
                    type: { $in: ["recipe_deduction", "waste", "out"] },
                    createdAt: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: "$ingredient",
                    ingredientName: { $first: "$ingredient" },
                    realQuantity: { $sum: "$quantity" },
                    byType: {
                        $push: {
                            type: "$type",
                            quantity: "$quantity"
                        }
                    }
                }
            }
        ]);

        // Popular nomes dos ingredientes
        const ingredientIds = realConsumption
            .filter(c => c._id)
            .map(c => c._id);

        const ingredients = await mongoose.model("GlobalIngredient")
            .find({ _id: { $in: ingredientIds } }, "name unit")
            .lean();

        const ingredientMap = {};
        ingredients.forEach(ing => {
            ingredientMap[ing._id.toString()] = { name: ing.name, unit: ing.unit };
        });

        // ── 2. Consumo Teórico: baseado nas Recipes × vendas ─────────────
        // Para cada receita ativa da loja, calcular quanto deveria ter sido consumido
        // baseado nos pedidos que contêm produtos vinculados a receitas.
        const theoreticalConsumption = {};

        // Buscar todas as receitas ativas da loja
        const recipes = await Recipe.find({ store: storeId, isActive: true })
            .populate("ingredients.ingredient", "name unit")
            .lean();

        // Buscar produtos da loja e seus mapeamentos com receitas
        const products = await Product.find({ store: storeId, isActive: true, isCurrent: true })
            .lean();

        // Para simplificar: usar os pedidos para inferir consumo teórico
        // Se um pedido tem items, e existe uma recipe vinculada ao product,
        // somar ingredients[].netQuantity × lossFactor × quantity vendida
        const orders = await Order.aggregate([
            {
                $match: {
                    store: storeId,
                    orderDate: { $gte: start, $lte: end },
                    orderStatus: { $nin: ["cancelled"] },
                    items: { $exists: true, $ne: [] }
                }
            },
            { $unwind: "$items" }
        ]);

        // Para cada item vendido, tentar encontrar a recipe correspondente
        // e calcular o consumo teórico de ingredientes
        for (const orderItem of orders) {
            const productId = orderItem.items.product;
            if (!productId) continue;

            // Encontrar receitas que usam este produto ou têm o mesmo nome
            const matchingRecipes = recipes.filter(r =>
                r.product && r.product.toString() === productId?.toString()
            );

            for (const recipe of matchingRecipes) {
                for (const ing of recipe.ingredients || []) {
                    const ingId = ing.ingredient?._id?.toString() || ing.ingredient?.toString();
                    if (!ingId) continue;

                    const netQty = ing.netQuantity || 0;
                    const lossFactor = ing.lossFactor || 0;
                    const theoreticalQty = netQty * (1 + lossFactor) * (orderItem.items.quantity || 1);

                    if (!theoreticalConsumption[ingId]) {
                        theoreticalConsumption[ingId] = 0;
                    }
                    theoreticalConsumption[ingId] += theoreticalQty;
                }
            }
        }

        // ── 3. Calcular desvios ─────────────────────────────────────────
        const varianceItems = [];

        for (const rc of realConsumption) {
            const ingId = rc._id?.toString();
            if (!ingId) continue;

            const theoretical = theoreticalConsumption[ingId] || 0;
            const real = rc.realQuantity;

            if (theoretical === 0) {
                // Sem consumo teórico registrado — não pode calcular desvio
                varianceItems.push({
                    ingredientId: ingId,
                    ingredientName: ingredientMap[ingId]?.name || "Desconhecido",
                    unit: ingredientMap[ingId]?.unit || "",
                    realConsumption: Math.round(real * 100) / 100,
                    theoreticalConsumption: 0,
                    variancePercent: null,
                    flag: "no_data",
                    color: "gray"
                });
                continue;
            }

            const variancePercent = ((real - theoretical) / theoretical) * 100;

            let flag, color;
            if (variancePercent <= 5) {
                flag = "normal";
                color = "green";
            } else if (variancePercent <= 15) {
                flag = "atencao";
                color = "yellow";
            } else {
                flag = "critico";
                color = "red";
            }

            varianceItems.push({
                ingredientId: ingId,
                ingredientName: ingredientMap[ingId]?.name || "Desconhecido",
                unit: ingredientMap[ingId]?.unit || "",
                realConsumption: Math.round(real * 100) / 100,
                theoreticalConsumption: Math.round(theoretical * 100) / 100,
                variancePercent: Math.round(variancePercent * 100) / 100,
                flag,
                color
            });
        }

        // Adicionar ingredientes com consumo teórico mas sem consumo real
        for (const [ingId, theoretical] of Object.entries(theoreticalConsumption)) {
            if (!realConsumption.find(rc => rc._id?.toString() === ingId)) {
                varianceItems.push({
                    ingredientId: ingId,
                    ingredientName: ingredientMap[ingId]?.name || "Desconhecido",
                    unit: ingredientMap[ingId]?.unit || "",
                    realConsumption: 0,
                    theoreticalConsumption: Math.round(theoretical * 100) / 100,
                    variancePercent: -100,
                    flag: "below_expected",
                    color: "blue"
                });
            }
        }

        // Ordenar por maior desvio (críticos primeiro)
        varianceItems.sort((a, b) => (b.variancePercent || 0) - (a.variancePercent || 0));

        const summary = {
            totalIngredients: varianceItems.length,
            normalCount: varianceItems.filter(v => v.flag === "normal").length,
            attentionCount: varianceItems.filter(v => v.flag === "atencao").length,
            criticalCount: varianceItems.filter(v => v.flag === "critico").length,
            noDataCount: varianceItems.filter(v => v.flag === "no_data").length
        };

        respond(res, {
            summary,
            items: varianceItems,
            dateRange: { start, end }
        }, period, storeId);
    } catch (error) {
        next(error);
    }
};

// ─── Extra: GET /api/dashboard/inventory ─────────────────────────────────────

const getInventoryAnalytics = async (req, res, next) => {
    try {
        const storeId = resolveStoreId(req);

        const stockItems = await StockBalance.find({ store: storeId })
            .populate("ingredient", "name category unit")
            .lean();

        let totalValue = 0;
        let outOfStock = 0;
        let belowMinimum = 0;
        const categoryBreakdown = {};

        stockItems.forEach(item => {
            const value = item.balance * (item.lastPurchasePrice || 0);
            totalValue += value;

            if (item.balance === 0) {
                outOfStock++;
            } else if (item.balance < item.minimumStock) {
                belowMinimum++;
            }

            const category = item.ingredient?.category || "Outros";
            if (!categoryBreakdown[category]) {
                categoryBreakdown[category] = { count: 0, value: 0 };
            }
            categoryBreakdown[category].count++;
            categoryBreakdown[category].value += value;
        });

        // Movimentos de estoque nos últimos 7 dias
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const movements = await StockMovement.aggregate([
            {
                $match: {
                    store: storeId,
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: "$type",
                    count: { $sum: 1 },
                    totalQuantity: { $sum: "$quantity" }
                }
            }
        ]);

        const movementSummary = {};
        movements.forEach(m => {
            movementSummary[m._id] = {
                count: m.count,
                totalQuantity: m.totalQuantity
            };
        });

        respond(res, {
            stockItems: stockItems.length,
            totalValue: Math.round(totalValue * 100) / 100,
            outOfStock,
            belowMinimum,
            categoryBreakdown,
            movements: {
                period: "7days",
                data: movementSummary
            }
        }, "current", storeId);
    } catch (error) {
        next(error);
    }
};

// ─── Extra: GET /api/dashboard/users ────────────────────────────────────────

const getUserStats = async (req, res, next) => {
    try {
        const storeId = resolveStoreId(req);
        const User = mongoose.model("User");
        const Device = mongoose.model("Device");

        const userStats = await User.aggregate([
            { $match: { store: storeId } },
            { $group: { _id: "$role", count: { $sum: 1 } } }
        ]);

        const deviceStats = await Device.aggregate([
            { $match: { store: storeId } },
            { $group: { _id: "$isApproved", count: { $sum: 1 } } }
        ]);

        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const activeDevices = await Device.countDocuments({
            store: storeId,
            lastActiveAt: { $gte: thirtyMinutesAgo }
        });

        const userMap = {};
        userStats.forEach(s => { userMap[s._id] = s.count; });

        const deviceMap = {};
        deviceStats.forEach(s => {
            deviceMap[s._id ? "approved" : "pending"] = s.count;
        });

        respond(res, {
            users: {
                total: Object.values(userMap).reduce((a, b) => a + b, 0),
                byRole: userMap
            },
            devices: {
                total: Object.values(deviceMap).reduce((a, b) => a + b, 0),
                approved: deviceMap.approved || 0,
                pending: deviceMap.pending || 0,
                active: activeDevices
            }
        }, "current", storeId);
    } catch (error) {
        next(error);
    }
};

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
    getDashboardKPIs,
    getSalesReport,
    getTopProducts,
    getCMVReport,
    getVarianceAnalysis,
    getInventoryAnalytics,
    getUserStats
};
