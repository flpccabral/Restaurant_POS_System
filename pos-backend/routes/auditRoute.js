const express = require("express");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const { checkPermission } = require("../middlewares/checkPermission");
const auditService = require("../services/auditService");

const router = express.Router();

// All audit routes require authentication + inventory read (admin view)
router.use(isVerifiedUser);

/**
 * GET /api/audit
 * Lista logs de auditoria com filtros opcionais.
 * Query params: actionType, user, store, status, startDate, endDate, limit
 */
router.get(
  "/",
  checkPermission("inventory", "read"),
  async (req, res, next) => {
    try {
      const logs = await auditService.queryLogs(req.query);
      res.json({ success: true, count: logs.length, data: logs });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/audit/daily-report
 * Relatorio diario de auditoria — sumariza acoes do dia.
 * Query params: date (YYYY-MM-DD, padrao: hoje), store (ObjectId, opcional)
 */
router.get(
  "/daily-report",
  checkPermission("inventory", "read"),
  async (req, res, next) => {
    try {
      const report = await auditService.dailyReport(req.query.date, req.query.store);
      res.json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
