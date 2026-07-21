/**
 * Fase 9.2 — Task 10: Operational rollback procedure
 * Documents and automates rollback of a problematic order.
 *
 * Usage:
 *   node scripts/pilot-rollback.js <orderId>
 *   node scripts/pilot-rollback.js --list-failed   (list failed orders)
 *   node scripts/pilot-rollback.js --procedure      (print procedure only)
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const PILOT_STORE_ID = "6a1101372ff5c713c1b1a147";

const ROLLBACK_PROCEDURE = `
# PROCEDIMENTO DE ROLLBACK OPERACIONAL — PILOTO CONTROLADO

## 1. Como pausar o piloto
- Desativar temporariamente a loja: db.stores.updateOne({_id: <storeId>}, {$set: {isActive: false}})
- Ou: desativar produtos do piloto: db.products.updateMany({store: <storeId>}, {$set: {isActive: false}})
- Ou: parar o backend do PDV (pos-frontend)

## 2. Como identificar um pedido com falha
- GET /api/order?store=<storeId> — filtrar por stockDeductionStatus=failed
- Ou script: node scripts/pilot-rollback.js --list-failed

## 3. Como consultar um Order
- GET /api/order/:id — retorna status, itens, COGS, stockMovements
- MongoDB: db.orders.findOne({_id: ObjectId("<id>")})

## 4. Como consultar StockMovements de um pedido
- db.stockmovements.find({reference: "<orderId>"})
- Campo 'type' indica: recipe_deduction, direct_sale_deduction, recipe_deduction_reversal, etc.

## 5. Como estornar baixa de estoque
- Usar o serviço existente: stockReversalService.reverseOrderStockDeduction(orderId, userId)
- Ou rodar script: node scripts/pilot-rollback.js <orderId>
- Verificar StockBalances após reversão.

## 6. Como marcar alerta como resolvido
- db.operationalalerts.updateOne({_id: <alertId>}, {$set: {status: "resolved", resolvedAt: new Date()}})

## 7. Como impedir nova venda temporariamente
- Opção 1: Desativar loja (ver item 1)
- Opção 2: Configurar flag no PDV (se existir 'maintenance mode')
- Opção 3: Bloquear porta 8000 temporariamente

## 8. Como restaurar saldos se necessário
- Snapshot pré-piloto contém os saldos iniciais.
- Restaurar via: node scripts/pilot-rollback.js --restore <snapshotDir>
- Ou manualmente: db.stockbalances.updateOne({_id: <id>}, {$set: {balance: <originalValue>}})

## 9. Como retomar após rollback
- Reativar loja/produtos
- Verificar saldos com: node scripts/pilot-validate-stock.js
- Executar venda teste com: node scripts/pilot-test-e2e.js
`;

async function listFailedOrders() {
  require("../models/orderModel");
  const Order = mongoose.model("Order");
  const failed = await Order.find({
    store: PILOT_STORE_ID,
    stockDeductionStatus: { $in: ["failed", "partial"] },
  }).lean();
  console.log(`Failed/partial orders: ${failed.length}`);
  failed.forEach((o) => {
    console.log(`  ${o._id} | ${o.orderNumber || "?"} | status: ${o.orderStatus} | deduction: ${o.stockDeductionStatus} | error: ${o.stockDeductionError || "none"}`);
  });
}

async function rollbackOrder(orderId, userId) {
  require("../models/orderModel");
  require("../models/stockBalanceModel");
  require("../models/stockMovementModel");
  require("../models/operationalAlertModel");

  const Order = mongoose.model("Order");
  const StockMovement = mongoose.model("StockMovement");
  const OperationalAlert = mongoose.model("OperationalAlert");
  const stockReversalService = require("../services/stockReversalService");

  console.log(`\nRolling back order: ${orderId}`);

  const order = await Order.findById(orderId).lean();
  if (!order) { console.log("Order not found!"); return; }

  console.log(`  Order: ${order._id} | Status: ${order.orderStatus} | Deduction: ${order.stockDeductionStatus}`);

  const movements = await StockMovement.find({ reference: orderId.toString() }).lean();
  console.log(`  StockMovements: ${movements.length}`);

  // Check if already reversed
  if (order.stockReversalStatus === "completed") {
    console.log("  ⚠️ Order already reversed — skipping");
    return;
  }

  try {
    const result = await stockReversalService.reverseOrderStockDeduction(orderId, userId);
    console.log(`  ✅ Rollback complete:`);
    console.log(`    Items reversed: ${result.itemsReversed || result.items?.length || "?"}`);
    console.log(`    Movements created: ${result.reversalMovements?.length || "?"}`);

    // Resolve related alerts
    const resolved = await OperationalAlert.updateMany(
      { "metadata.orderId": orderId.toString(), status: "new" },
      { $set: { status: "resolved", resolvedAt: new Date() } }
    );
    if (resolved.modifiedCount > 0) {
      console.log(`  ✅ ${resolved.modifiedCount} alerts resolved`);
    }
  } catch (err) {
    console.log(`  ❌ Rollback failed: ${err.message}`);
    console.log("  Manual intervention may be needed. See procedure below.");
    console.log(ROLLBACK_PROCEDURE);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--procedure")) {
    console.log(ROLLBACK_PROCEDURE);
    process.exit(0);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  if (args.includes("--list-failed")) {
    await listFailedOrders();
  } else if (args.length > 0 && !args[0].startsWith("--")) {
    const orderId = args[0];
    const userId = args[1] || "system"; // Optional userId param
    await rollbackOrder(orderId, userId);
  } else {
    console.log("Usage:");
    console.log("  node scripts/pilot-rollback.js <orderId> [userId]");
    console.log("  node scripts/pilot-rollback.js --list-failed");
    console.log("  node scripts/pilot-rollback.js --procedure");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Script failed:", err.message);
  process.exit(1);
});
