const mongoose = require('mongoose');
const Order = require('../models/orderModel');
const User = require('../models/userModel');

/**
 * Prompt F — Obter comissão de um garçom
 * GET /api/attendant/:id/commission
 *
 * Query params:
 * - period: today | week | month | range
 * - start: data inicial (para period=range)
 * - end: data final (para period=range)
 *
 * Retorna:
 * {
 *   attendant: { _id, name, email, commissionRate },
 *   period: { start, end, label },
 *   totalSales: number,
 *   totalOrders: number,
 *   commissionRate: number,
 *   commissionValue: number
 * }
 */
const getCommission = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { period = 'today', start, end } = req.query;
    const Role = require('../models/roleModel');

    // Validar se o usuário existe
    const attendant = await User.findById(id).select('name email role roleConfig');
    if (!attendant) {
      return res.status(404).json({
        success: false,
        message: 'Garçom não encontrado'
      });
    }

    // Validar se é garçom
    const waiterRole = await Role.findOne({ name: 'Garçom' });
    const waiterRoleId = waiterRole?._id.toString();
    const userRoleId = attendant.role?.toString();

    if (!userRoleId || userRoleId !== waiterRoleId) {
      return res.status(400).json({
        success: false,
        message: 'Usuário não é garçom'
      });
    }

    const commissionRate = attendant.roleConfig?.commissionRate || 0;
    const commissionEnabled = attendant.roleConfig?.commissionEnabled || false;

    // Definir período
    const now = new Date();
    let periodStart, periodEnd, periodLabel;

    switch (period) {
      case 'today':
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        periodLabel = 'Hoje';
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        periodStart = weekStart;
        periodEnd = new Date(weekStart);
        periodEnd.setDate(weekStart.getDate() + 7);
        periodLabel = 'Esta Semana';
        break;
      case 'month':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        periodLabel = 'Este Mês';
        break;
      case 'range':
        if (!start || !end) {
          return res.status(400).json({
            success: false,
            message: 'Período range requer start e end'
          });
        }
        periodStart = new Date(start);
        periodEnd = new Date(end);
        periodLabel = `${start} até ${end}`;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Período inválido. Use: today, week, month ou range'
        });
    }

    // Buscar pedidos do garçom no período
    const orders = await Order.find({
      attendant: id,
      orderDate: {
        $gte: periodStart,
        $lt: periodEnd
      },
      orderStatus: { $ne: 'cancelled' },
      paymentStatus: 'paid'
    }).select('bills.totalWithTax bills.orderDate');

    // Calcular totais
    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, order) => sum + (order.bills?.totalWithTax || 0), 0);
    const commissionValue = commissionEnabled ? (totalSales * commissionRate / 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        attendant: {
          _id: attendant._id,
          name: attendant.name,
          email: attendant.email,
          commissionRate,
          commissionEnabled
        },
        period: {
          start: periodStart,
          end: periodEnd,
          label: periodLabel
        },
        totalSales,
        totalOrders,
        commissionRate,
        commissionValue: Math.round(commissionValue * 100) / 100
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Prompt F — Transferir garçom de um pedido
 * POST /api/order/:id/transfer-attendant
 *
 * Body:
 * {
 *   newAttendantId: ObjectId,
 *   reason: string (opcional)
 * }
 */
const transferAttendant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newAttendantId, reason } = req.body;
    const transferredBy = req.user._id;

    // Validar pedido
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido não encontrado'
      });
    }

    // Validar novo garçom
    const newAttendant = await User.findById(newAttendantId);
    if (!newAttendant) {
      return res.status(404).json({
        success: false,
        message: 'Novo garçom não encontrado'
      });
    }

    // Registrar histórico de transferência
    const previousAttendant = order.attendant;
    const now = new Date();

    // Atualizar histórico do garçom anterior
    if (previousAttendant && order.attendantHistory && order.attendantHistory.length > 0) {
      const lastHistory = order.attendantHistory[order.attendantHistory.length - 1];
      if (!lastHistory.to) {
        lastHistory.to = now;
        lastHistory.transferredBy = transferredBy;
        lastHistory.reason = reason || 'Transferência de garçom';
      }
    }

    // Adicionar novo registro no histórico
    order.attendantHistory.push({
      attendant: newAttendantId,
      from: now,
      to: null,
      transferredBy: transferredBy,
      reason: reason || 'Transferência de garçom'
    });

    // Atualizar garçom atual
    order.attendant = newAttendantId;

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Garçom transferido com sucesso',
      data: {
        orderId: order._id,
        previousAttendant,
        newAttendant: newAttendantId,
        transferredAt: now,
        transferredBy
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Prompt F — Listar garçons da loja
 * GET /api/attendant
 *
 * Query params:
 * - includeCommission: true (inclui configuração de comissão)
 */
const getAttendants = async (req, res, next) => {
  try {
    const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;
    const { includeCommission } = req.query;
    const Role = require('../models/roleModel');

    // Buscar usuários da loja
    const attendants = await User.find({
      store: storeRef,
      isActive: true
    }).select('name email role roleConfig');

    // Buscar role "Garçom"
    const waiterRole = await Role.findOne({ name: 'Garçom' });
    const waiterRoleId = waiterRole?._id.toString();

    // Filtrar apenas garçons
    const waiters = attendants.filter(user => {
      if (!user.role) return false;
      const userRoleId = user.role.toString();
      return userRoleId === waiterRoleId;
    });

    // Formatar resposta
    const formattedAttendants = waiters.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      commissionRate: includeCommission === 'true' ? (user.roleConfig?.commissionRate || 0) : undefined,
      commissionEnabled: includeCommission === 'true' ? (user.roleConfig?.commissionEnabled || false) : undefined
    }));

    res.status(200).json({
      success: true,
      count: formattedAttendants.length,
      data: formattedAttendants
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Prompt F — Atualizar configuração de comissão
 * PUT /api/attendant/:id/commission-config
 *
 * Body:
 * {
 *   commissionRate: number (0-100),
 *   commissionEnabled: boolean
 * }
 */
const updateCommissionConfig = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { commissionRate, commissionEnabled } = req.body;

    // Validar garçom
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Garçom não encontrado'
      });
    }

    // Validar rate
    if (commissionRate !== undefined && (commissionRate < 0 || commissionRate > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Taxa de comissão deve ser entre 0 e 100'
      });
    }

    // Atualizar configuração
    if (!user.roleConfig) {
      user.roleConfig = {};
    }

    if (commissionRate !== undefined) {
      user.roleConfig.commissionRate = commissionRate;
    }

    if (commissionEnabled !== undefined) {
      user.roleConfig.commissionEnabled = commissionEnabled;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Configuração de comissão atualizada',
      data: {
        _id: user._id,
        name: user.name,
        commissionRate: user.roleConfig.commissionRate,
        commissionEnabled: user.roleConfig.commissionEnabled
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCommission,
  transferAttendant,
  getAttendants,
  updateCommissionConfig
};
