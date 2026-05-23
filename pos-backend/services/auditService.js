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

module.exports = { logAction, queryLogs };
