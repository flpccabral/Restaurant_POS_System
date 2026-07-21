/**
 * Fase 9.2 — Task 7: Audit orders ↔ kds_orders consistency
 * Detects 5 types of divergences between the two collections
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const PILOT_STORE_ID = "6a1101372ff5c713c1b1a147";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  require("../models/orderModel");
  require("../models/kdsOrderModel");

  const Order = mongoose.model("Order");
  const KDSOrder = mongoose.model("KDSOrder");

  console.log("=".repeat(70));
  console.log("FASE 9.2 — TASK 7: ORDERS ↔ KDS_ORDERS CONSISTENCY AUDIT");
  console.log("=".repeat(70));

  const pilotOrders = await Order.find({ store: PILOT_STORE_ID }).lean();
  const pilotKdsOrders = await KDSOrder.find({ store: PILOT_STORE_ID }).lean();

  console.log(`Orders: ${pilotOrders.length} | KDS Orders: ${pilotKdsOrders.length}\n`);

  const divergences = [];
  let criticalCount = 0;

  // 1. Orders "In Progress" without KDSOrder
  console.log("--- Check 1: Orders In Progress without KDSOrder ---");
  const inProgressOrders = pilotOrders.filter((o) => o.orderStatus === "In Progress");
  for (const order of inProgressOrders) {
    const kdsOrder = pilotKdsOrders.find((k) => k.order?.toString() === order._id.toString());
    if (!kdsOrder) {
      divergences.push({ type: "ORDER_WITHOUT_KDS", severity: "high", orderId: order._id.toString(), orderNumber: order.orderNumber });
      console.log(`  ❌ Order ${order._id} (${order.orderNumber}) — In Progress but NO KDSOrder`);
      criticalCount++;
    } else {
      console.log(`  ✅ Order ${order._id} (${order.orderNumber}) → KDS ${kdsOrder.kdsOrderId} (${kdsOrder.status})`);
    }
  }

  // 2. KDSOrders active without Order
  console.log("\n--- Check 2: KDSOrders active without Order ---");
  const activeKdsOrders = pilotKdsOrders.filter((k) => !["served", "cancelled"].includes(k.status));
  for (const kds of activeKdsOrders) {
    const order = pilotOrders.find((o) => o._id.toString() === kds.order?.toString());
    if (!order) {
      divergences.push({ type: "KDS_WITHOUT_ORDER", severity: "critical", kdsOrderId: kds.kdsOrderId });
      console.log(`  ❌ KDS ${kds.kdsOrderId} — status=${kds.status} but Order NOT FOUND`);
      criticalCount++;
    } else {
      console.log(`  ✅ KDS ${kds.kdsOrderId} (${kds.status}) → Order ${order._id} (${order.orderStatus})`);
    }
  }

  // 3. KDSOrder "served" with Order NOT "completed"
  console.log("\n--- Check 3: KDSOrder served but Order NOT completed ---");
  const servedKdsOrders = pilotKdsOrders.filter((k) => k.status === "served");
  for (const kds of servedKdsOrders) {
    const order = pilotOrders.find((o) => o._id.toString() === kds.order?.toString());
    if (order && order.orderStatus !== "completed") {
      divergences.push({
        type: "KDS_SERVED_BUT_ORDER_NOT_COMPLETED",
        severity: "high",
        kdsOrderId: kds.kdsOrderId,
        orderId: order._id.toString(),
        kdsStatus: kds.status,
        orderStatus: order.orderStatus,
      });
      console.log(`  ❌ KDS ${kds.kdsOrderId} = served | Order ${order._id} = ${order.orderStatus}`);
      criticalCount++;
    } else if (order) {
      console.log(`  ✅ KDS ${kds.kdsOrderId} = served | Order ${order._id} = completed`);
    }
  }

  // 4. Order "completed" with KDSOrder still active
  console.log("\n--- Check 4: Order completed but KDSOrder still active ---");
  const completedOrders = pilotOrders.filter((o) => o.orderStatus === "completed");
  for (const order of completedOrders) {
    const kdsOrder = pilotKdsOrders.find((k) => k.order?.toString() === order._id.toString());
    if (kdsOrder && !["served", "cancelled"].includes(kdsOrder.status)) {
      divergences.push({
        type: "ORDER_COMPLETED_BUT_KDS_ACTIVE",
        severity: "high",
        orderId: order._id.toString(),
        kdsOrderId: kdsOrder.kdsOrderId,
        orderStatus: order.orderStatus,
        kdsStatus: kdsOrder.status,
      });
      console.log(`  ❌ Order ${order._id} = completed | KDS ${kdsOrder.kdsOrderId} = ${kdsOrder.status}`);
      criticalCount++;
    } else if (kdsOrder) {
      console.log(`  ✅ Order ${order._id} = completed | KDS ${kdsOrder.kdsOrderId} = ${kdsOrder.status}`);
    }
  }

  // 5. KDSOrders without tableNumber or productName
  console.log("\n--- Check 5: KDSOrders missing tableNumber or productName ---");
  for (const kds of pilotKdsOrders) {
    const issues = [];
    if (kds.tableNumber == null) issues.push("missing_tableNumber");
    for (const item of kds.items) {
      if (!item.productName) issues.push(`missing_productName_for_item_${item._id}`);
    }
    if (issues.length > 0) {
      divergences.push({
        type: "KDS_MISSING_FIELDS",
        severity: "low",
        kdsOrderId: kds.kdsOrderId,
        issues,
      });
      console.log(`  ⚠️ KDS ${kds.kdsOrderId}: ${issues.join(", ")}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("AUDIT SUMMARY:");
  console.log(`  Total divergences: ${divergences.length}`);
  console.log(`  Critical: ${criticalCount}`);
  console.log(`  Orders checked: ${pilotOrders.length}`);
  console.log(`  KDS orders checked: ${pilotKdsOrders.length}`);

  if (criticalCount > 0) {
    console.log(`\n❌ ${criticalCount} critical divergences found:`);
    divergences.filter((d) => d.severity === "critical" || d.severity === "high").forEach((d) => {
      console.log(`  [${d.type}] ${d.orderId || d.kdsOrderId}`);
    });
  } else {
    console.log("\n✅ 0 critical divergences — orders and KDS orders are consistent");
  }

  const exitCode = criticalCount > 0 ? 1 : 0;
  console.log(`🏁 Exit code: ${exitCode}`);

  await mongoose.disconnect();
  process.exit(exitCode);
}

main().catch((err) => {
  console.error("❌ Script failed:", err.message);
  process.exit(1);
});
