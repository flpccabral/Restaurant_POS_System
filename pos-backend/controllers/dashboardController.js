const mongoose = require("mongoose");
const createHttpError = require("http-errors");
const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const PurchaseOrder = require("../models/purchaseOrderModel");
const StockBalance = require("../models/stockBalanceModel");
const StockAlert = require("../models/stockAlertModel");
const Supplier = require("../models/supplierModel");
const Recipe = require("../models/recipeModel");
const User = require("../models/userModel");
const Device = require("../models/deviceModel");

/**
 * Obter KPIs gerais do dashboard
 */
const getDashboardKPIs = async (req, res, next) => {
    try {
        const { period = 'today' } = req.query;

        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Definir intervalo de datas
        const dateRange = getDateRange(period);

        // Vendas totais no período
        const salesResult = await Order.aggregate([
            {
                $match: {
                    storeId: new mongoose.Types.ObjectId(storeRef),
                    orderDate: { $gte: dateRange.start, $lte: dateRange.end },
                    orderStatus: { $nin: ['cancelled', 'pending'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$bills.totalWithTax' },
                    totalOrders: { $sum: 1 },
                    totalTax: { $sum: '$bills.tax' }
                }
            }
        ]);

        const { totalRevenue = 0, totalOrders = 0, totalTax = 0 } = salesResult[0] || {};

        // CMV (Custo de Mercadoria Vendida) - baseado nas compras recebidas
        const purchasesResult = await PurchaseOrder.aggregate([
            {
                $match: {
                    store: new mongoose.Types.ObjectId(storeRef),
                    status: 'received',
                    receivedDate: { $gte: dateRange.start, $lte: dateRange.end }
                }
            },
            {
                $group: {
                    _id: null,
                    totalCost: { $sum: '$total' }
                }
            }
        ]);

        const totalCost = purchasesResult[0]?.totalCost || 0;

        // Margem bruta
        const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

        // Pedidos pendentes
        const pendingOrders = await Order.countDocuments({
            storeId: new mongoose.Types.ObjectId(storeRef),
            orderStatus: 'pending'
        });

        // Alertas de estoque ativos
        const activeAlerts = await StockAlert.countDocuments({
            store: new mongoose.Types.ObjectId(storeRef),
            status: { $in: ['pending', 'acknowledged'] }
        });

        // Produtos ativos
        const activeProducts = await Product.countDocuments({
            store: new mongoose.Types.ObjectId(storeRef),
            isActive: true,
            isCurrent: true
        });

        // Total em estoque (valor)
        const stockValueResult = await StockBalance.aggregate([
            {
                $match: {
                    store: new mongoose.Types.ObjectId(storeRef)
                }
            },
            {
                $group: {
                    _id: null,
                    totalValue: { $sum: { $multiply: ['$balance', '$lastPurchasePrice'] } }
                }
            }
        ]);

        const totalStockValue = stockValueResult[0]?.totalValue || 0;

        res.status(200).json({
            success: true,
            data: {
                period,
                dateRange,
                revenue: {
                    total: totalRevenue,
                    orders: totalOrders,
                    tax: totalTax,
                    net: totalRevenue - totalTax
                },
                costs: {
                    total: totalCost,
                    stockValue: totalStockValue
                },
                margins: {
                    gross: grossMargin.toFixed(2),
                    grossAmount: totalRevenue - totalCost
                },
                operational: {
                    pendingOrders,
                    activeAlerts,
                    activeProducts
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Relatório de vendas por período
 */
const getSalesReport = async (req, res, next) => {
    try {
        const { period = '7days', groupBy = 'day' } = req.query;

        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Definir intervalo de datas
        const dateRange = getDateRange(period);

        // Grupo para agregação
        let dateGroup;
        if (groupBy === 'hour') {
            dateGroup = {
                $dateToString: { format: '%Y-%m-%d %H', date: '$orderDate' }
            };
        } else if (groupBy === 'day') {
            dateGroup = {
                $dateToString: { format: '%Y-%m-%d', date: '$orderDate' }
            };
        } else if (groupBy === 'week') {
            dateGroup = {
                $dateToString: { format: '%Y-W%V', date: '$orderDate' }
            };
        } else if (groupBy === 'month') {
            dateGroup = {
                $dateToString: { format: '%Y-%m', date: '$orderDate' }
            };
        }

        const salesData = await Order.aggregate([
            {
                $match: {
                    storeId: new mongoose.Types.ObjectId(storeRef),
                    orderDate: { $gte: dateRange.start, $lte: dateRange.end },
                    orderStatus: { $nin: ['cancelled', 'pending'] }
                }
            },
            {
                $group: {
                    _id: dateGroup,
                    revenue: { $sum: '$bills.totalWithTax' },
                    orders: { $sum: 1 },
                    tax: { $sum: '$bills.tax' },
                    avgTicket: { $avg: '$bills.totalWithTax' }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        // Formatar dados
        const formattedData = salesData.map(item => ({
            period: item._id,
            revenue: item.revenue,
            orders: item.orders,
            tax: item.tax,
            netRevenue: item.revenue - item.tax,
            avgTicket: item.avgTicket || 0
        }));

        res.status(200).json({
            success: true,
            data: {
                period,
                groupBy,
                dateRange,
                sales: formattedData,
                summary: {
                    totalRevenue: formattedData.reduce((acc, item) => acc + item.revenue, 0),
                    totalOrders: formattedData.reduce((acc, item) => acc + item.orders, 0),
                    avgDailyRevenue: formattedData.length > 0 ?
                        formattedData.reduce((acc, item) => acc + item.revenue, 0) / formattedData.length : 0
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Ranking de produtos mais vendidos
 */
 const getTopProducts = async (req, res, next) => {
    try {
        const { limit = 10, period = '7days' } = req.query;

        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Definir intervalo de datas
        const dateRange = getDateRange(period);

        // Agregar itens vendidos
        const topProducts = await Order.aggregate([
            {
                $match: {
                    storeId: new mongoose.Types.ObjectId(storeRef),
                    orderDate: { $gte: dateRange.start, $lte: dateRange.end },
                    orderStatus: { $nin: ['cancelled', 'pending'] }
                }
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.product',
                    productName: { $first: '$items.name' },
                    totalQuantity: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
                    timesOrdered: { $sum: 1 }
                }
            },
            {
                $sort: { totalQuantity: -1 }
            },
            {
                $limit: parseInt(limit)
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                period,
                limit: parseInt(limit),
                products: topProducts.map(p => ({
                    productId: p._id,
                    productName: p.productName,
                    totalQuantity: p.totalQuantity,
                    totalRevenue: p.totalRevenue,
                    timesOrdered: p.timesOrdered,
                    avgPrice: p.totalRevenue / p.totalQuantity
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Análise de fornecedores
 */
const getSupplierAnalytics = async (req, res, next) => {
    try {
        const { period = '30days' } = req.query;

        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Definir intervalo de datas
        const dateRange = getDateRange(period);

        // Agregar compras por fornecedor
        const supplierData = await PurchaseOrder.aggregate([
            {
                $match: {
                    store: new mongoose.Types.ObjectId(storeRef),
                    status: 'received',
                    receivedDate: { $gte: dateRange.start, $lte: dateRange.end }
                }
            },
            {
                $lookup: {
                    from: 'suppliers',
                    localField: 'supplier',
                    foreignField: '_id',
                    as: 'supplierInfo'
                }
            },
            { $unwind: '$supplierInfo' },
            {
                $group: {
                    _id: '$supplier',
                    supplierName: { $first: '$supplierInfo.name' },
                    totalSpent: { $sum: '$total' },
                    orderCount: { $sum: 1 },
                    avgOrderValue: { $avg: '$total' },
                    lastPurchaseDate: { $max: '$receivedDate' }
                }
            },
            {
                $sort: { totalSpent: -1 }
            }
        ]);

        // Pedidos atrasados por fornecedor
        const lateOrders = await PurchaseOrder.aggregate([
            {
                $match: {
                    store: new mongoose.Types.ObjectId(storeRef),
                    expectedDate: { $lt: new Date() },
                    status: { $nin: ['received', 'cancelled'] }
                }
            },
            {
                $lookup: {
                    from: 'suppliers',
                    localField: 'supplier',
                    foreignField: '_id',
                    as: 'supplierInfo'
                }
            },
            { $unwind: '$supplierInfo' },
            {
                $group: {
                    _id: '$supplier',
                    supplierName: { $first: '$supplierInfo.name' },
                    lateCount: { $sum: 1 }
                }
            }
        ]);

        const lateMap = {};
        lateOrders.forEach(item => {
            lateMap[item._id.toString()] = item.lateCount;
        });

        res.status(200).json({
            success: true,
            data: {
                period,
                suppliers: supplierData.map(s => ({
                    supplierId: s._id,
                    supplierName: s.supplierName,
                    totalSpent: s.totalSpent,
                    orderCount: s.orderCount,
                    avgOrderValue: s.avgOrderValue,
                    lastPurchaseDate: s.lastPurchaseDate,
                    lateOrders: lateMap[s._id.toString()] || 0
                })),
                summary: {
                    totalSuppliers: supplierData.length,
                    totalSpent: supplierData.reduce((acc, s) => acc + s.totalSpent, 0),
                    suppliersWithLateOrders: lateOrders.length
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Análise de estoque
 */
const getInventoryAnalytics = async (req, res, next) => {
    try {
        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Total de itens em estoque
        const stockItems = await StockBalance.find({
            store: new mongoose.Types.ObjectId(storeRef)
        }).populate('ingredient', 'name category unit');

        // Calcular valores
        let totalValue = 0;
        let belowMinimum = 0;
        let outOfStock = 0;
        const categoryBreakdown = {};

        stockItems.forEach(item => {
            const value = item.balance * item.lastPurchasePrice;
            totalValue += value;

            if (item.balance === 0) {
                outOfStock++;
            } else if (item.balance < item.minimumStock) {
                belowMinimum++;
            }

            // Agrupar por categoria
            const category = item.ingredient?.category || 'Outros';
            if (!categoryBreakdown[category]) {
                categoryBreakdown[category] = { count: 0, value: 0 };
            }
            categoryBreakdown[category].count++;
            categoryBreakdown[category].value += value;
        });

        // Movimentos de estoque nos últimos 7 dias
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const StockMovement = mongoose.model('StockMovement');
        const movements = await StockMovement.aggregate([
            {
                $match: {
                    store: new mongoose.Types.ObjectId(storeRef),
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    totalQuantity: { $sum: '$quantity' }
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

        res.status(200).json({
            success: true,
            data: {
                stockItems: stockItems.length,
                totalValue,
                outOfStock,
                belowMinimum,
                categoryBreakdown,
                movements: {
                    period: '7days',
                    data: movementSummary
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Relatório de CMV (Custo de Mercadoria Vendida)
 */
const getCMVReport = async (req, res, next) => {
    try {
        const { period = '30days' } = req.query;

        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Definir intervalo de datas
        const dateRange = getDateRange(period);

        // Vendas totais
        const salesResult = await Order.aggregate([
            {
                $match: {
                    storeId: new mongoose.Types.ObjectId(storeRef),
                    orderDate: { $gte: dateRange.start, $lte: dateRange.end },
                    orderStatus: { $nin: ['cancelled', 'pending'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$bills.totalWithTax' }
                }
            }
        ]);

        const totalRevenue = salesResult[0]?.totalRevenue || 0;

        // Compras recebidas no período
        const purchasesResult = await PurchaseOrder.aggregate([
            {
                $match: {
                    store: new mongoose.Types.ObjectId(storeRef),
                    status: 'received',
                    receivedDate: { $gte: dateRange.start, $lte: dateRange.end }
                }
            },
            {
                $group: {
                    _id: null,
                    totalCost: { $sum: '$total' }
                }
            }
        ]);

        const totalCost = purchasesResult[0]?.totalCost || 0;

        // CMV percentual
        const cmvPercent = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;

        // Margem bruta
        const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

        res.status(200).json({
            success: true,
            data: {
                period,
                dateRange,
                cmv: {
                    total: totalCost,
                    percent: cmvPercent.toFixed(2)
                },
                revenue: {
                    total: totalRevenue
                },
                margin: {
                    gross: grossMargin.toFixed(2),
                    amount: totalRevenue - totalCost
                },
                interpretation: getCMVInterpretation(cmvPercent)
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Estatísticas de usuários e dispositivos
 */
const getUserStats = async (req, res, next) => {
    try {
        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Total de usuários por role
        const userStats = await User.aggregate([
            {
                $match: {
                    store: new mongoose.Types.ObjectId(storeRef)
                }
            },
            {
                $group: {
                    _id: '$role',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Dispositivos por status
        const deviceStats = await Device.aggregate([
            {
                $match: {
                    store: new mongoose.Types.ObjectId(storeRef)
                }
            },
            {
                $group: {
                    _id: '$isApproved',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Dispositivos ativos (últimos 30 min)
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const activeDevices = await Device.countDocuments({
            store: new mongoose.Types.ObjectId(storeRef),
            lastActiveAt: { $gte: thirtyMinutesAgo }
        });

        const userMap = {};
        userStats.forEach(s => {
            userMap[s._id] = s.count;
        });

        const deviceMap = {};
        deviceStats.forEach(s => {
            deviceMap[s._id ? 'approved' : 'pending'] = s.count;
        });

        res.status(200).json({
            success: true,
            data: {
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
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Exportar dados para relatório
 */
const exportReport = async (req, res, next) => {
    try {
        const { type, period = '30days', format = 'json' } = req.query;

        // Determinar loja
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Definir intervalo de datas
        const dateRange = getDateRange(period);

        let data;

        if (type === 'sales') {
            data = await Order.find({
                storeId: new mongoose.Types.ObjectId(storeRef),
                orderDate: { $gte: dateRange.start, $lte: dateRange.end }
            })
            .populate('table', 'name')
            .sort({ orderDate: -1 });
        } else if (type === 'purchases') {
            data = await PurchaseOrder.find({
                store: new mongoose.Types.ObjectId(storeRef),
                createdAt: { $gte: dateRange.start, $lte: dateRange.end }
            })
            .populate('supplier', 'name tradeName')
            .populate('items.ingredient', 'name category')
            .sort({ createdAt: -1 });
        } else if (type === 'inventory') {
            data = await StockBalance.find({
                store: new mongoose.Types.ObjectId(storeRef)
            })
            .populate('ingredient', 'name category unit')
            .sort({ balance: 1 });
        } else {
            const error = createHttpError(400, `Invalid report type: ${type}`);
            return next(error);
        }

        if (format === 'json') {
            res.status(200).json({
                success: true,
                reportType: type,
                period,
                dateRange,
                count: data.length,
                data
            });
        } else if (format === 'csv') {
            // Converter para CSV
            const csv = convertToCSV(data);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${type}-${period}.csv`);
            res.send(csv);
        }

        res.status(200).json({
            success: true,
            reportType: type,
            period,
            count: data.length,
            data
        });
    } catch (error) {
        next(error);
    }
};

// Helper Functions

function getDateRange(period) {
    const now = new Date();
    const start = new Date();

    switch (period) {
        case 'today':
            start.setHours(0, 0, 0, 0);
            break;
        case 'yesterday':
            start.setDate(start.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            now.setHours(0, 0, 0, 0);
            break;
        case '7days':
            start.setDate(start.getDate() - 7);
            break;
        case 'this_year':
            start.setMonth(0, 1);
            start.setHours(0, 0, 0, 0);
            break;
        case '30days':
            start.setDate(start.getDate() - 30);
            break;
        case 'this_week':
            const dayOfWeek = now.getDay();
            start.setDate(now.getDate() - dayOfWeek);
            start.setHours(0, 0, 0, 0);
            break;
        case 'this_month':
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            break;
        case 'last_month':
            start.setMonth(start.getMonth() - 1);
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            now.setMonth(now.getMonth() - 1);
            now.setDate(now.getDate() - 1);
            break;
        default:
            start.setDate(start.getDate() - 30);
    }

    return {
        start,
        end: now,
        startStr: start.toISOString(),
        endStr: now.toISOString()
    };
}

function getCMVInterpretation(cmvPercent) {
    if (cmvPercent === 0) {
        return 'Sem dados suficientes para cálculo';
    } else if (cmvPercent < 25) {
        return 'CMV excelente - abaixo da média do setor';
    } else if (cmvPercent < 35) {
        return 'CMV dentro da média do setor';
    } else if (cmvPercent < 45) {
        return 'CMV acima da média - atenção necessária';
    } else {
        return 'CMV crítico - ação imediata recomendada';
    }
}

function convertToCSV(data) {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]).filter(h => typeof data[0][h] !== 'object');
    const rows = data.map(item =>
        headers.map(header => {
            const value = item[header];
            return typeof value === 'string' ? `"${value}"` : value;
        }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
}

module.exports = {
    getDashboardKPIs,
    getSalesReport,
    getTopProducts,
    getSupplierAnalytics,
    getInventoryAnalytics,
    getCMVReport,
    getUserStats,
    exportReport
};
