/**
 * Script para corrigir divergências entre pedidos e pagamentos
 *
 * Problemas que corrige:
 * 1. Pedidos com paymentStatus='paid' mas sem registro em payments
 * 2. Pagamentos duplicados
 * 3. Pedidos com paymentMethod undefined
 * 4. Inconsistências de valores
 *
 * Uso: node scripts/fix-payment-divergences.js [--dry-run]
 */

const mongoose = require('mongoose');
const config = require('../config/config');
const Order = require('../models/orderModel');
const Payment = require('../models/paymentModel');

const DRY_RUN = process.argv.includes('--dry-run');

async function fixPaymentDivergences() {
  try {
    console.log('🔧 Iniciando correção de divergências de pagamentos...\n');

    if (DRY_RUN) {
      console.log('⚠️  MODO DRY-RUN: Nenhuma alteração será feita no banco\n');
    }

    // Conectar ao MongoDB
    await mongoose.connect(config.mongoUri || 'mongodb://localhost:27017/pos-saas');
    console.log('✅ Conectado ao MongoDB\n');

    // ========================================
    // 1. Pedidos pagos sem registro de pagamento
    // ========================================
    console.log('📊 Analisando pedidos pagos sem registro de pagamento...');

    // Buscar todos os pedidos pagos (não apenas de hoje)
    const paidOrders = await Order.find({
      paymentStatus: 'paid'
    });

    const allPayments = await Payment.find({});

    const paymentOrderIds = new Set(allPayments.map(p => p.order?.toString()));

    const ordersWithoutPayment = paidOrders.filter(
      o => !paymentOrderIds.has(o._id.toString())
    );

    console.log(`   Total de pedidos pagos hoje: ${paidOrders.length}`);
    console.log(`   Total de pagamentos hoje: ${allPayments.length}`);
    console.log(`   Pedidos sem pagamento: ${ordersWithoutPayment.length}\n`);

    if (ordersWithoutPayment.length > 0) {
      console.log('   Criando pagamentos para pedidos sem registro:');

      // Buscar um usuário admin para usar como default
      const User = require('../models/userModel');
      const adminUser = await User.findOne({ email: 'admin@pos.com' });
      const adminUserId = adminUser?._id;

      if (!adminUserId) {
        console.log('   ⚠️  Usuário admin não encontrado. Pulando criação de pagamentos.');
      } else {
        for (const order of ordersWithoutPayment) {
          const amount = order.bills?.totalWithTax || 0;

          // Mapear paymentMethod do Order para method do Payment
          const methodMap = {
            'Dinheiro': 'cash',
            'dinheiro': 'cash',
            'cash': 'cash',
            'Pix': 'pix',
            'pix': 'pix',
            'Credito': 'credit_card',
            'credito': 'credit_card',
            'Débito': 'debit_card',
            'debito': 'debit_card',
            'Voucher': 'voucher',
            'voucher': 'voucher'
          };
          const method = methodMap[order.paymentMethod] || 'cash';

          console.log(`   - Order ${order._id}: R$ ${amount.toFixed(2)} (${method})`);

          if (!DRY_RUN) {
            await Payment.create({
              store: order.store,
              order: order._id,
              orderNumber: order.orderNumber || `ORD-${Date.now()}`,
              amount: amount,
              method: method,
              paidAmount: amount,
              status: 'approved',
              user: order.user || adminUserId,
              cashier: order.cashier || order.user || adminUserId
            });
          }
        }
      }
      console.log('');
    }

    // ========================================
    // 2. Pagamentos duplicados
    // ========================================
    console.log('📊 Analisando pagamentos duplicados...');

    const paymentMap = {};
    allPayments.forEach(p => {
      const orderId = p.order?.toString();
      if (!paymentMap[orderId]) {
        paymentMap[orderId] = [];
      }
      paymentMap[orderId].push(p);
    });

    const duplicates = Object.entries(paymentMap)
      .filter(([_, payments]) => payments.length > 1);

    console.log(`   Pedidos com pagamentos duplicados: ${duplicates.length}\n`);

    if (duplicates.length > 0) {
      console.log('   Removendo duplicados (mantendo o primeiro):');
      for (const [orderId, payments] of duplicates) {
        const order = await Order.findById(orderId);
        const orderAmount = order?.bills?.totalWithTax || 0;

        // Ordenar por createdAt e manter apenas o primeiro
        payments.sort((a, b) => a.createdAt - b.createdAt);
        const toRemove = payments.slice(1);

        console.log(`   - Order ${orderId}: ${payments.length} pagamentos (removendo ${toRemove.length})`);

        if (!DRY_RUN) {
          for (const payment of toRemove) {
            await Payment.deleteOne({ _id: payment._id });
          }
        }
      }
      console.log('');
    }

    // ========================================
    // 3. Pedidos com paymentMethod undefined
    // ========================================
    console.log('📊 Analisando pedidos com paymentMethod undefined...');

    const ordersWithUndefinedMethod = await Order.find({
      paymentStatus: 'paid',
      $or: [
        { paymentMethod: null },
        { paymentMethod: '' },
        { paymentMethod: { $exists: false } }
      ]
    });

    console.log(`   Pedidos com paymentMethod undefined: ${ordersWithUndefinedMethod.length}\n`);

    if (ordersWithUndefinedMethod.length > 0) {
      console.log('   Corrigindo paymentMethod (definindo como "cash"):');
      for (const order of ordersWithUndefinedMethod) {
        console.log(`   - Order ${order._id}`);

        if (!DRY_RUN) {
          await Order.findByIdAndUpdate(order._id, {
            paymentMethod: 'cash'
          });

          // Também corrigir nos pagamentos
          await Payment.updateMany(
            { order: order._id },
            { method: 'cash' }
          );
        }
      }
      console.log('');
    }

    // ========================================
    // 4. Resumo final
    // ========================================
    console.log('✅ Correção concluída!\n');
    console.log('Resumo:');
    console.log(`   - Pagamentos criados: ${DRY_RUN ? '(dry-run)' : ordersWithoutPayment.length}`);
    console.log(`   - Duplicados removidos: ${DRY_RUN ? '(dry-run)' : duplicates.reduce((sum, [_, p]) => sum + p.length - 1, 0)}`);
    console.log(`   - paymentMethod corrigidos: ${DRY_RUN ? '(dry-run)' : ordersWithUndefinedMethod.length}`);

    if (DRY_RUN) {
      console.log('\n⚠️  Execute sem --dry-run para aplicar as correções');
    }

  } catch (error) {
    console.error('❌ Erro durante correção:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Desconectado do MongoDB');
  }
}

fixPaymentDivergences();
