/**
 * Script para corrigir pedidos de balcão que estão marcados como 'completed'
 * mas não foram pagos ainda (paymentStatus !== 'paid')
 *
 * Problema: Pedidos de balcão eram marcados como completed imediatamente,
 * mesmo sem pagamento. Isso impedia o pagamento posterior.
 *
 * Solução: Reverter status para 'Ready' para permitir pagamento.
 */

const mongoose = require('mongoose');
const config = require('../config/config');
const Order = require('../models/orderModel');

async function fixUnpaidCompletedOrders() {
  try {
    console.log('🔧 Iniciando correção de pedidos...\n');

    // Conectar ao MongoDB
    await mongoose.connect(config.mongoUri || 'mongodb://localhost:27017/pos-saas');
    console.log('✅ Conectado ao MongoDB\n');

    // Buscar pedidos problemáticos:
    // - orderType === 'counter'
    // - orderStatus === 'completed'
    // - paymentStatus !== 'paid'
    const problematicOrders = await Order.find({
      orderType: 'counter',
      orderStatus: 'completed',
      paymentStatus: { $ne: 'paid' }
    });

    console.log(`📊 Encontrados ${problematicOrders.length} pedido(s) problemático(s)\n`);

    if (problematicOrders.length === 0) {
      console.log('✅ Nenhum pedido precisa de correção!\n');
      await mongoose.disconnect();
      return;
    }

    // Listar pedidos
    problematicOrders.forEach((order, idx) => {
      console.log(`${idx + 1}. Order ID: ${order._id}`);
      console.log(`   Customer: ${order.customerDetails?.name || 'N/A'}`);
      console.log(`   Total: R$ ${(order.bills?.totalWithTax || 0).toFixed(2)}`);
      console.log(`   Current Status: ${order.orderStatus}`);
      console.log(`   Payment Status: ${order.paymentStatus}`);
      console.log('');
    });

    // Confirmar antes de aplicar
    console.log('⚠️  ATENÇÃO: Este script irá reverter o status de orderStatus para "Ready"');
    console.log('   para permitir o pagamento posterior.\n');

    // Aplicar correção
    let fixedCount = 0;
    for (const order of problematicOrders) {
      try {
        order.orderStatus = 'Ready';
        order.closeStatus = 'open';
        await order.save();
        console.log(`✅ Corrigido: ${order._id} → orderStatus: Ready`);
        fixedCount++;
      } catch (error) {
        console.error(`❌ Erro ao corrigir ${order._id}: ${error.message}`);
      }
    }

    console.log(`\n📊 Resultado: ${fixedCount}/${problematicOrders.length} pedido(s) corrigido(s)`);
    console.log('✅ Migração concluída!\n');

  } catch (error) {
    console.error('❌ Erro durante migração:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Desconectado do MongoDB');
  }
}

fixUnpaidCompletedOrders();
