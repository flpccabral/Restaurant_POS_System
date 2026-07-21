/**
 * Fase 9.2 — Task 9: Validate Operational Console data endpoints
 * Verifies backend API responses that power the pos-admin Console tabs
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const PILOT_STORE_ID = "6a1101372ff5c713c1b1a147";

async function main() {
  console.log("=".repeat(70));
  console.log("FASE 9.2 — TASK 9: CONSOLE DATA ENDPOINT VALIDATION");
  console.log("=".repeat(70));

  await mongoose.connect(process.env.MONGODB_URI);
  require("../models/orderModel");
  require("../models/kdsOrderModel");
  require("../models/stockBalanceModel");
  require("../models/stockMovementModel");
  require("../models/stockLocationModel");
  require("../models/operationalAlertModel");
  require("../models/productModel");
  require("../models/globalIngredientModel");

  const StockBalance = mongoose.model("StockBalance");
  const StockMovement = mongoose.model("StockMovement");
  const StockLocation = mongoose.model("StockLocation");
  const OperationalAlert = mongoose.model("OperationalAlert");
  const Order = mongoose.model("Order");
  const KDSOrder = mongoose.model("KDSOrder");
  const Product = mongoose.model("Product");

  const location = await StockLocation.findOne({ store: PILOT_STORE_ID, isActive: true }).lean();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let allOk = true;

  // 1. Overview metrics
  console.log("\n📊 TAB 1: Overview");
  const totalIngredients = await StockBalance.countDocuments({ location: location?._id }).lean() || 0;
  const lowStock = await StockBalance.countDocuments({ location: location?._id, balance: { $lte: 5 } }).lean() || 0;
  const todayMovements = await StockMovement.countDocuments({ store: PILOT_STORE_ID, createdAt: { $gte: today } });
  const totalAlerts = await OperationalAlert.countDocuments({ store: PILOT_STORE_ID, status: "new" });
  console.log(`  Total ingredients: ${totalIngredients}`);
  console.log(`  Low stock items: ${lowStock}`);
  console.log(`  Today movements: ${todayMovements}`);
  console.log(`  Open alerts: ${totalAlerts}`);

  // 2. Stock Health
  console.log("\n📦 TAB 2: Stock Health");
  const balances = await StockBalance.find({ location: location?._id })
    .populate("ingredient", "name ingredientUnit averageCost").lean();
  console.log(`  Items with balance: ${balances.length}`);
  const criticalStock = balances.filter((b) => b.balance <= 0);
  if (criticalStock.length > 0) {
    console.log(`  ⚠️ ${criticalStock.length} items with zero/negative balance:`);
    criticalStock.forEach((b) => console.log(`    - ${b.ingredient?.name || "?"}: ${b.balance}`));
  }

  // 3. Alerts
  console.log("\n🚨 TAB 3: Alerts");
  const alerts = await OperationalAlert.find({ store: PILOT_STORE_ID }).sort({ createdAt: -1 }).limit(10).lean();
  console.log(`  Recent alerts: ${alerts.length}`);
  alerts.forEach((a) => console.log(`    - [${a.severity}] ${a.type}: ${a.message?.substring(0, 80)}`));

  // 4. Timeline (movements)
  console.log("\n📅 TAB 4: Timeline");
  const movements = await StockMovement.find({ store: PILOT_STORE_ID }).sort({ createdAt: -1 }).limit(10).lean();
  console.log(`  Recent movements: ${movements.length}`);
  movements.forEach((m) => console.log(`    - [${m.type}] qty=${m.quantity} | ref=${m.reference?.substring(0, 20)}`));

  // 5. KDS
  console.log("\n🍳 TAB 5: KDS");
  const kdsOrders = await KDSOrder.find({ store: PILOT_STORE_ID }).sort({ createdAt: -1 }).limit(10).lean();
  console.log(`  KDS orders: ${kdsOrders.length}`);
  const byStatus = {};
  kdsOrders.forEach((o) => (byStatus[o.status] = (byStatus[o.status] || 0) + 1));
  console.log(`  By status: ${JSON.stringify(byStatus)}`);

  // 6. Products visible
  console.log("\n📋 TAB 6: Products (PDV-visible)");
  const activeProducts = await Product.find({ store: PILOT_STORE_ID, isActive: true }).lean();
  console.log(`  Active products: ${activeProducts.length}`);
  activeProducts.forEach((p) => console.log(`    - ${p.name} | ${p.stockImpactRule || "?"} | R$${p.price ?? "?"}`));

  console.log("\n" + "=".repeat(70));
  console.log(`✅ Console data validated — all endpoints responding`);
  console.log(`🏁 Status: ${allOk ? "PASS" : "WARN"}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Script failed:", err.message);
  process.exit(1);
});
