const express = require('express');
const router = express.Router();
const {
  getCommission,
  transferAttendant,
  getAttendants,
  updateCommissionConfig
} = require('../controllers/attendantController');
const { isVerifiedUser } = require('../middlewares/tokenVerification');
const { checkRole } = require('../middlewares/checkPermission');

// Prompt F — Rotas de Garçom/Mesa + Comissão

/**
 * @route   GET /api/attendant
 * @desc    Listar garçons da loja
 * @access  Private
 */
router.get('/', isVerifiedUser, getAttendants);

/**
 * @route   GET /api/attendant/:id/commission
 * @desc    Obter comissão de um garçom
 * @access  Private
 */
router.get('/:id/commission', isVerifiedUser, getCommission);

/**
 * @route   POST /api/order/:id/transfer-attendant
 * @desc    Transferir garçom de um pedido
 * @access  Private (Admin, Manager)
 */
router.post('/order/:id/transfer-attendant', isVerifiedUser, checkRole(['admin', 'manager']), transferAttendant);

/**
 * @route   PUT /api/attendant/:id/commission-config
 * @desc    Atualizar configuração de comissão
 * @access  Private (apenas Admin)
 */
router.put('/:id/commission-config', isVerifiedUser, checkRole(['admin']), updateCommissionConfig);

module.exports = router;
