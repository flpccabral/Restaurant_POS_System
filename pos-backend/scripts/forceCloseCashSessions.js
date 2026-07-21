/**
 * Script para fechamento forçado de caixas abertos (FLUXO_CAIXA.md)
 *
 * Este script deve ser executado diariamente à meia-noite via cron job.
 * Fecha automaticamente todos os caixas que ainda estão abertos,
 * marcando como forced=true e registrando no log.
 *
 * Uso: node scripts/forceCloseCashSessions.js
 *
 * Cron job (executar à meia-noite):
 * 0 0 * * * cd /path/to/pos-backend && node scripts/forceCloseCashSessions.js >> /var/log/pos/force-close.log 2>&1
 */

const mongoose = require('mongoose');
const config = require('../config/config');
const CashSession = require('../models/cashSessionModel');
const SessionLog = require('../models/sessionLogModel');
const OperationalAlert = require('../models/operationalAlertModel');
const User = require('../models/userModel');

async function forceCloseCashSessions() {
  try {
    console.log('🔒 Iniciando fechamento forçado de caixas...\n');

    // Conectar ao MongoDB
    await mongoose.connect(config.mongoUri || 'mongodb://localhost:27017/pos-saas');
    console.log('✅ Conectado ao MongoDB\n');

    // Buscar todas as sessões abertas
    const openSessions = await CashSession.find({ status: 'open' });

    if (openSessions.length === 0) {
      console.log('ℹ️  Nenhum caixa aberto encontrado. Nada a fazer.\n');
      await mongoose.disconnect();
      return;
    }

    console.log(`📦 Encontrados ${openSessions.length} caixa(s) aberto(s)\n`);

    let closedCount = 0;
    let alertCount = 0;

    for (const session of openSessions) {
      try {
        // Buscar informações do operador
        const operator = await User.findById(session.cashier).select('name email');
        const operatorName = operator?.name || operator?.email || 'Desconhecido';

        // Fechar sessão forçadamente
        await session.close({
          finalBalance: session.expectedBalance, // Usar saldo esperado (sem conferência)
          observations: 'Fechamento automático pelo sistema (00:00)',
          userId: session.cashier,
          confirmedBy: null,
          differenceReason: 'Fechamento forçado sem conferência - operador não fechou manualmente'
        });

        // Marcar como forçado
        session.forced = true;
        await session.save();

        console.log(`✅ Caixa ${session.sessionNumber} fechado forçadamente`);
        console.log(`   Operador: ${operatorName}`);
        console.log(`   Saldo esperado: R$ ${session.expectedBalance.toFixed(2)}`);
        console.log('');

        closedCount++;

        // Registrar no log
        await SessionLog.create({
          user: session.cashier,
          store: session.store,
          action: 'cash_session_force_closed',
          metadata: {
            sessionId: session._id,
            sessionNumber: session.sessionNumber,
            expectedBalance: session.expectedBalance,
            reason: 'Fechamento automático (00:00)',
            operatorName
          }
        });

        // Criar alerta operacional para conferência pendente
        await OperationalAlert.create({
          store: session.store,
          type: 'cash_session_force_closed',
          severity: 'medium',
          message: `O caixa do operador ${operatorName} foi fechado automaticamente pelo sistema às 00:00. Conferência manual pendente. Saldo esperado: R$ ${session.expectedBalance.toFixed(2)}`,
          metadata: {
            sessionId: session._id,
            sessionNumber: session.sessionNumber,
            operatorId: session.cashier,
            operatorName,
            expectedBalance: session.expectedBalance,
            closedAt: session.closedAt
          }
        });

        alertCount++;

      } catch (error) {
        console.error(`❌ Erro ao fechar caixa ${session.sessionNumber}: ${error.message}`);
      }
    }

    console.log('='.repeat(50));
    console.log(`✅ ${closedCount} caixa(s) fechado(s) forçadamente`);
    console.log(`📢 ${alertCount} alerta(s) criado(s) para conferência pendente`);
    console.log('='.repeat(50));
    console.log('\n🔔 Admin deve conferir os caixas fechados automaticamente no console operacional.\n');

  } catch (error) {
    console.error('❌ Erro durante fechamento forçado:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Desconectado do MongoDB');
  }
}

forceCloseCashSessions();
