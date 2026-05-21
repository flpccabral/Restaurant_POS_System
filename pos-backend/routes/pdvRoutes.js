const express = require("express");
const router = express.Router();
const pdvController = require("../controllers/pdvController");
const { authenticate, hasRole } = require("../middlewares/authMiddleware");

/**
 * @route   POST /api/pdv/session/open
 * @desc    Abrir sessão de caixa
 * @access  Private (Cashier, Manager, Admin)
 */
router.post("/session/open", authenticate, hasRole(["cashier", "manager", "admin"]), pdvController.openCashSession);

/**
 * @route   GET /api/pdv/session/active
 * @desc    Obter sessão ativa do caixa
 * @access  Private (Cashier, Manager, Admin)
 */
router.get("/session/active", authenticate, hasRole(["cashier", "manager", "admin"]), pdvController.getActiveSession);

/**
 * @route   POST /api/pdv/session/close
 * @desc    Fechar sessão de caixa
 * @access  Private (Manager, Admin)
 */
router.post("/session/close", authenticate, hasRole(["manager", "admin"]), pdvController.closeCashSession);

/**
 * @route   POST /api/pdv/sangria
 * @desc    Realizar sangria (retirada de dinheiro)
 * @access  Private (Manager, Admin)
 */
router.post("/sangria", authenticate, hasRole(["manager", "admin"]), pdvController.performSangria);

/**
 * @route   POST /api/pdv/suprimento
 * @desc    Realizar suprimento (entrada de dinheiro)
 * @access  Private (Manager, Admin)
 */
router.post("/suprimento", authenticate, hasRole(["manager", "admin"]), pdvController.performSuprimento);

/**
 * @route   POST /api/pdv/payment
 * @desc    Processar pagamento
 * @access  Private (Cashier, Manager, Admin)
 */
router.post("/payment", authenticate, hasRole(["cashier", "manager", "admin"]), pdvController.processPayment);

/**
 * @route   POST /api/pdv/payment/:paymentId/refund
 * @desc    Estornar pagamento
 * @access  Private (Manager, Admin)
 */
router.post("/payment/:paymentId/refund", authenticate, hasRole(["manager", "admin"]), pdvController.refundPayment);

/**
 * @route   GET /api/pdv/sessions
 * @desc    Obter histórico de sessões
 * @access  Private (Manager, Admin)
 */
router.get("/sessions", authenticate, hasRole(["manager", "admin"]), pdvController.getSessionHistory);

/**
 * @route   GET /api/pdv/daily-payments
 * @desc    Obter extrato de pagamentos do dia
 * @access  Private (Cashier, Manager, Admin)
 */
router.get("/daily-payments", authenticate, hasRole(["cashier", "manager", "admin"]), pdvController.getDailyPaymentsReport);

/**
 * @route   GET /api/pdv/summary
 * @desc    Obter resumo do PDV
 * @access  Private (Cashier, Manager, Admin)
 */
router.get("/summary", authenticate, hasRole(["cashier", "manager", "admin"]), pdvController.getPDVSummary);

module.exports = router;
