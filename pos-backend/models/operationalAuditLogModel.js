const mongoose = require("mongoose");

/**
 * OperationalAuditLog Model — Rastro de auditoria para acoes operacionais
 *
 * Registra quem fez o que, quando, em qual loja, com qual resultado.
 * Usado para: auditoria, debug, compliance e historico de uso do console.
 */
const operationalAuditLogSchema = new mongoose.Schema(
  {
    actionType: {
      type: String,
      required: true,
      enum: [
        "alert_resolved",
        "alert_dismissed",
        "alert_generated",
        "central_transfer_executed",
        "inter_store_transfer_executed",
        "purchase_registered",
        "stock_policy_created",
        "stock_policy_updated",
        "stock_policy_deleted",
      ],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockLocation",
    },
    ingredient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GlobalIngredient",
    },
    entityType: {
      type: String,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    status: {
      type: String,
      enum: ["success", "failure"],
      default: "success",
    },
    error: {
      type: String,
    },
    summary: {
      type: String,
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

// Indexes for common query patterns
operationalAuditLogSchema.index({ actionType: 1, createdAt: -1 });
operationalAuditLogSchema.index({ user: 1, createdAt: -1 });
operationalAuditLogSchema.index({ store: 1, createdAt: -1 });
operationalAuditLogSchema.index({ entityType: 1, entityId: 1 });

module.exports = mongoose.model(
  "OperationalAuditLog",
  operationalAuditLogSchema
);
