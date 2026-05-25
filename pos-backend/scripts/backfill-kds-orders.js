/**
 * Script: backfill-kds-orders.js
 *
 * Sincroniza pedidos existentes que nao possuem KDSOrder correspondente.
 * Executa a mesma logica de syncOrderToKds do orderController para cada
 * pedido orfao, respeitando o KDSConfig da loja.
 *
 * Uso: node scripts/backfill-kds-orders.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

// Carregar modelos
require("../models/orderModel");
require("../models/kdsOrderModel");
require("../models/kdsConfigModel");
require("../models/tableModel");

const Order = mongoose.model("Order");
const KDSOrder = mongoose.model("KDSOrder");
const KDSConfig = mongoose.model("KDSConfig");
const Table = mongoose.model("Table");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Conectado ao MongoDB\n");

  // Buscar pedidos que NAO estao cancelados/fechados e nao tem KDSOrder
  const allOrders = await Order.find({
    orderStatus: { $nin: ["cancelled", "completed", "Ready"] },
  }).lean();

  console.log(`Pedidos ativos encontrados: ${allOrders.length}`);

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of allOrders) {
    const existingKds = await KDSOrder.findOne({ order: order._id }).lean();
    if (existingKds) {
      skipped++;
      continue;
    }

    try {
      const storeRef = order.store;
      const config = await KDSConfig.getStoreConfig(storeRef);

      let tableNumber = null;
      if (order.table) {
        const tableDoc = await Table.findById(order.table)
          .select("tableNo")
          .lean();
        tableNumber = tableDoc?.tableNo;
      }

      const items = (order.items || [])
        .filter((item) => item.name || item.productName)
        .map((item) => ({
          orderItem: item._id,
          productId: item.product || undefined,
          productName: item.name || item.productName,
          quantity: item.quantity || 1,
          station: config.defaultStation || "kitchen",
          prepTimeMinutes: config.slaSettings?.defaultPrepTime || 15,
          notes: item.notes || "",
          modifiers: item.modifiers || [],
        }));

      if (items.length === 0) {
        console.log(
          `  PULADO: Order ${order._id} — sem itens validos para KDS`
        );
        skipped++;
        continue;
      }

      const orderType = order.orderType || "dine_in";
      const kdsOrderType =
        orderType === "dine_in"
          ? "dine-in"
          : orderType === "counter"
            ? "counter"
            : orderType === "pickup"
              ? "pickup"
              : orderType === "delivery"
                ? "delivery"
                : "dine-in";

      await KDSOrder.create({
        store: storeRef,
        order: order._id,
        orderNumber:
          order.orderNumber ||
          `#${Math.floor(new Date(order.orderDate || Date.now()).getTime())}`,
        table: order.table?._id || order.table,
        tableNumber,
        customerName: order.customerDetails?.name,
        orderType: kdsOrderType,
        items,
        estimatedReady: new Date(
          Date.now() + (config.slaSettings?.defaultPrepTime || 15) * 60000
        ),
        metadata: {
          channel: "pos",
          notes: order.observations || "",
        },
      });

      console.log(`  OK: Order ${order._id} → KDS criado (${items.length} itens)`);
      synced++;
    } catch (err) {
      console.error(
        `  ERRO: Order ${order._id} → ${err.message}`
      );
      failed++;
    }
  }

  console.log(
    `\nResultado: ${synced} sincronizados, ${skipped} pulados (ja tem KDS), ${failed} falhas`
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Falha no script:", err);
  process.exit(1);
});
