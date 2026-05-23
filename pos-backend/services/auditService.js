const OperationalAuditLog = require("../models/operationalAuditLogModel");

/**
 * Audit Service — Registro centralizado de auditoria operacional
 *
 * Funcoes:
 *   logAction(data) — registra uma acao no log de auditoria
 *   queryLogs(filters) — consulta logs com filtros e paginacao
 */

/**
 * Registra uma acao no log de auditoria.
 * Nunca lanca excecao — falha de auditoria nao deve quebrar operacoes.
 *
 * @param {Object} data
 * @param {string} data.actionType - Tipo da acao (enum do model)
 * @param {ObjectId} data.user - ID do usuario que executou
 * @param {ObjectId} [data.store] - ID da loja
 * @param {ObjectId} [data.location] - ID da localizacao
 * @param {ObjectId} [data.ingredient] - ID do ingrediente
 * @param {string} [data.entityType] - Tipo da entidade afetada
 * @param {ObjectId} [data.entityId] - ID da entidade afetada
 * @param {string} [data.status='success'] - success ou failure
 * @param {string} [data.error] - Mensagem de erro (se houver)
 * @param {string} [data.summary] - Resumo legivel da acao
 * @param {Object} [data.before] - Estado anterior (se aplicavel)
 * @param {Object} [data.after] - Estado posterior (se aplicavel)
 * @param {Object} [data.metadata] - Dados adicionais
 * @returns {Promise<Object|null>} O registro criado ou null em caso de erro
 */
const logAction = async (data) => {
  try {
    return await OperationalAuditLog.create(data);
  } catch (err) {
    console.error("[AuditService] Failed to log action:", err.message);
    // Never throw — audit failure should not break operations
    return null;
  }
};

/**
 * Consulta logs de auditoria com filtros opcionais.
 *
 * @param {Object} filters
 * @param {string} [filters.actionType] - Filtrar por tipo de acao
 * @param {ObjectId} [filters.user] - Filtrar por usuario
 * @param {ObjectId} [filters.store] - Filtrar por loja
 * @param {string} [filters.status] - Filtrar por status (success/failure)
 * @param {string} [filters.startDate] - Data inicial ISO
 * @param {string} [filters.endDate] - Data final ISO
 * @param {number} [filters.limit=100] - Limite de resultados
 * @returns {Promise<Array>}
 */
const queryLogs = async (filters = {}) => {
  const query = {};

  if (filters.actionType) query.actionType = filters.actionType;
  if (filters.user) query.user = filters.user;
  if (filters.store) query.store = filters.store;
  if (filters.status) query.status = filters.status;

  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }

  return OperationalAuditLog.find(query)
    .populate("user", "name email")
    .populate("store", "name")
    .populate("ingredient", "name")
    .sort({ createdAt: -1 })
    .limit(filters.limit || 100);
};

/**
 * Gera relatorio diario de auditoria — resumo de todas as acoes do dia.
 *
 * Agrupa por actionType, por loja, e retorna totalizadores uteis
 * para a revisao diaria do piloto.
 *
 * @param {string} [date] - Data ISO (YYYY-MM-DD). Padrao: hoje.
 * @param {ObjectId} [storeId] - Filtrar por loja (opcional).
 * @returns {Promise<Object>} Relatorio diario
 */
const dailyReport = async (date, storeId) => {
  try {
    const startDate = date ? new Date(date) : new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    const match = {
      createdAt: { $gte: startDate, $lt: endDate }
    };
    if (storeId) match.store = storeId;

    // Total de acoes
    const totalActions = await OperationalAuditLog.countDocuments(match);

    // Agrupamento por tipo de acao
    const byType = await OperationalAuditLog.aggregate([
      { $match: match },
      { $group: { _id: "$actionType", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const byTypeMap = {};
    byType.forEach(item => { byTypeMap[item._id] = item.count; });

    // Acoes com falha
    const failures = await OperationalAuditLog.countDocuments({
      ...match,
      status: "failure"
    });

    // Agrupamento por loja (se nao filtrado por loja)
    let byStore = [];
    if (!storeId) {
      byStore = await OperationalAuditLog.aggregate([
        { $match: match },
        {
          $lookup: {
            from: "stores",
            localField: "store",
            foreignField: "_id",
            as: "storeInfo"
          }
        },
        { $unwind: { path: "$storeInfo", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$store",
            storeName: { $first: "$storeInfo.name" },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);
    }

    // Acoes recentes (ultimas 10)
    const recentQuery = OperationalAuditLog.find(match)
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("user", "name email")
      .populate("store", "name")
      .populate("ingredient", "name");

    if (storeId) recentQuery.where("store", storeId);
    const recent = await recentQuery;

    // Acoes por usuario
    const byUser = await OperationalAuditLog.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userInfo"
        }
      },
      { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$user",
          userName: { $first: "$userInfo.name" },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    return {
      date: startDate.toISOString().split("T")[0],
      totalActions,
      byType: byTypeMap,
      failures,
      byStore: byStore.map(s => ({
        storeId: s._id,
        storeName: s.storeName || "Desconhecida",
        count: s.count
      })),
      byUser: byUser.map(u => ({
        userId: u._id,
        userName: u.userName || "Desconhecido",
        count: u.count
      })),
      recentActions: recent.map(r => ({
        id: r._id,
        actionType: r.actionType,
        user: r.user ? { name: r.user.name, email: r.user.email } : null,
        store: r.store ? r.store.name : null,
        ingredient: r.ingredient ? r.ingredient.name : null,
        status: r.status,
        summary: r.summary,
        createdAt: r.createdAt
      }))
    };
  } catch (err) {
    console.error("[AuditService] dailyReport failed:", err.message);
    return {
      date: date || "unknown",
      error: err.message,
      totalActions: 0,
      byType: {},
      failures: 0,
      byStore: [],
      byUser: [],
      recentActions: []
    };
  }
};

module.exports = { logAction, queryLogs, dailyReport };
