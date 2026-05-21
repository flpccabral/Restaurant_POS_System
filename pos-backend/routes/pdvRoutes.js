const express = require("express");
const router = express.Router();
const pdvController = require("../controllers/pdvController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const { checkRole } = require("../middlewares/checkPermission");

/**
 * @route   POST /api/pdv/session/open
 * @desc    Abrir sessão de caixa
 * @access  Private (Cashier, Manager, Admin)
 */
router.post("/session/open", isVerifiedUser, checkRole(["cashier", "manager", "admin"]), pdvController.openCashSession);

/**
 * @route   GET /api/pdv/session/active
 * @desc    Obter sessão ativa do caixa
 * @access  Private (Cashier, Manager, Admin)
 */
router.get("/session/active", isVerifiedUser, checkRole(["cashier", "manager", "admin"]), pdvController.getActiveSession);

/**
 * @route   POST /api/pdv/session/close
 * @desc    Fechar sessão de caixa
 * @access  Private (Manager, Admin)
 */
router.post("/session/close", isVerifiedUser, checkRole(["manager", "admin"]), pdvController.closeCashSession);

/**
 * @route   POST /api/pdv/sangria
 * @desc    Realizar sangria (retirada de dinheiro)
 * @access  Private (Manager, Admin)
 */
router.post("/sangria", isVerifiedUser, checkRole(["manager", "admin"]), pdvController.performSangria);

/**
 * @route   POST /api/pdv/suprimento
 * @desc    Realizar suprimento (entrada de dinheiro)
 * @access  Private (Manager, Admin)
 */
router.post("/suprimento", isVerifiedUser, checkRole(["manager", "admin"]), pdvController.performSuprimento);

/**
 * @route   POST /api/pdv/payment
 * @desc    Processar pagamento
 * @access  Private (Cashier, Manager, Admin)
 */
router.post("/payment", isVerifiedUser, checkRole(["cashier", "manager", "admin"]), pdvController.processPayment);

/**
 * @route   POST /api/pdv/payment/:paymentId/refund
 * @desc    Estornar pagamento
 * @access  Private (Manager, Admin)
 */
router.post("/payment/:paymentId/refund", isVerifiedUser, checkRole(["manager", "admin"]), pdvController.refundPayment);

/**
 * @route   GET /api/pdv/sessions
 * @desc    Obter histórico de sessões
 * @access  Private (Manager, Admin)
 */
router.get("/sessions", isVerifiedUser, checkRole(["manager", "admin"]), pdvController.getSessionHistory);

/**
 * @route   GET /api/pdv/daily-payments
 * @desc    Obter extrato de pagamentos do dia
 * @access  Private (Cashier, Manager, Admin)
 */
router.get("/daily-payments", isVerifiedUser, checkRole(["cashier", "manager", "admin"]), pdvController.getDailyPaymentsReport);

/**
 * @route   GET /api/pdv/summary
 * @desc    Obter resumo do PDV
 * @access  Private (Cashier, Manager, Admin)
 */
router.get("/summary", isVerifiedUser, checkRole(["cashier", "manager", "admin"]), pdvController.getPDVSummary);

module.exports = router;
