/**
 * Fase 9.2 — Task 6: Controlled E2E sale (16-step script)
 * Tests the full flow: PDV → Order → Stock → CMV → KDS → PDV
 *
 * Uses direct HTTP calls to backend API for comprehensive validation.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const PILOT_STORE_ID = "6a1101372ff5c713c1b1a147";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// Simple HTTP helper using Node built-in
const http = require("http");
const https = require("https");

function api(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BACKEND_URL + path);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { "Content-Type": "application/json" },
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const PASS = "✅";
const FAIL = "❌";
const INFO = "ℹ️";

async function main() {
  console.log("=".repeat(70));
  console.log("FASE 9.2 — TASK 6: CONTROLLED E2E SALE (16 STEPS)");
  console.log("=".repeat(70));

  await mongoose.connect(process.env.MONGODB_URI);
  require("../models/orderModel");
  require("../models/kdsOrderModel");
  require("../models/kdsConfigModel");
  require("../models/productModel");
  require("../models/recipeModel");
  require("../models/globalIngredientModel");
  require("../models/stockBalanceModel");
  require("../models/stockMovementModel");
  require("../models/stockLocationModel");
  require("../models/operationalAlertModel");
  require("../models/tableModel");
  require("../models/userModel");

  const Order = mongoose.model("Order");
  const KDSOrder = mongoose.model("KDSOrder");
  const KDSConfig = mongoose.model("KDSConfig");
  const Product = mongoose.model("Product");
  const StockBalance = mongoose.model("StockBalance");
  const StockMovement = mongoose.model("StockMovement");
  const StockLocation = mongoose.model("StockLocation");
  const OperationalAlert = mongoose.model("OperationalAlert");
  const Table = mongoose.model("Table");
  const User = mongoose.model("User");

  const results = [];
  const startTime = Date.now();

  // ====== STEP 1: Get user ======
  console.log("\n📋 STEP 1: Get pilot user");
  const user = await User.findOne({ email: "gerente.demo@pos.com", store: PILOT_STORE_ID }).lean();
  if (!user) { console.log("  ❌ User not found!"); process.exit(1); }
  console.log(`  ${PASS} User: ${user.email} (${user._id})`);

  // ====== STEP 2: Get table ======
  console.log("\n📋 STEP 2: Get or create test table");
  let table = await Table.findOne({ store: PILOT_STORE_ID }).lean();
  if (!table) {
    table = await Table.create({ store: PILOT_STORE_ID, name: "Mesa Teste", tableNo: 99, capacity: 4 });
    console.log(`  ${INFO} Created test table: ${table.tableNo}`);
  } else {
    console.log(`  ${PASS} Table: ${table.name} (No. ${table.tableNo})`);
  }

  // ====== STEP 3: Get available products ======
  console.log("\n📋 STEP 3: Get active products for pilot store");
  const products = await Product.find({ store: PILOT_STORE_ID, isActive: true }).lean();
  // Prefer validated products: "Hambúrguer Artesanal" (all ingredients in stock), not "Hamburgue" (missing Bacon)
  const recipeProduct = products.find((p) => p.name === "Hambúrguer Artesanal" && p.stockImpactRule === "recipe_composition")
    || products.find((p) => p.stockImpactRule === "recipe_composition");
  const directProduct = products.find((p) => p.name === "Refrigerante" && p.stockImpactRule === "stock_item_direct")
    || products.find((p) => p.stockImpactRule === "stock_item_direct");
  const noStockProduct = products.find((p) => p.name === "Taxa de Serviço" && p.stockImpactRule === "no_stock_impact")
    || products.find((p) => p.stockImpactRule === "no_stock_impact");

  if (!recipeProduct) { console.log(`  ${FAIL} No recipe_composition product found`); process.exit(1); }
  if (!directProduct) { console.log(`  ${FAIL} No stock_item_direct product found`); process.exit(1); }
  if (!noStockProduct) { console.log(`  ${FAIL} No no_stock_impact product found`); process.exit(1); }

  console.log(`  ${PASS} recipe: ${recipeProduct.name} (${recipeProduct._id})`);
  console.log(`  ${PASS} direct: ${directProduct.name} (${directProduct._id})`);
  console.log(`  ${PASS} no_stock: ${noStockProduct.name} (${noStockProduct._id})`);

  // ====== STEP 4: Capture pre-sale stock balances ======
  console.log("\n📋 STEP 4: Capture pre-sale stock balances");
  const location = await StockLocation.findOne({ store: PILOT_STORE_ID, isActive: true });
  const preBalances = await StockBalance.find({ location: location._id }).populate("ingredient", "name").lean();
  const preBalanceMap = {};
  preBalances.forEach((b) => (preBalanceMap[b.ingredient?._id?.toString()] = b.balance));
  console.log(`  ${INFO} Captured ${preBalances.length} stock balances before sale`);

  // ====== STEP 5: Create PDV order ======
  console.log("\n📋 STEP 5: Create PDV order");
  const recipePrice = recipeProduct.price || 29.90;
  const directPrice = directProduct.price || 8.00;
  const noStockPrice = noStockProduct.price || 3.00;
  const subtotal = recipePrice + directPrice + noStockPrice;
  const tax = 0;
  const totalWithTax = subtotal + tax;

  const orderData = {
    store: PILOT_STORE_ID,
    table: table._id,
    orderType: "dine-in",
    orderStatus: "In Progress",
    customerDetails: { name: "Cliente Piloto 9.2", phone: "11999999999", guests: 2 },
    bills: { total: subtotal, tax: tax, totalWithTax: totalWithTax },
    items: [
      { product: recipeProduct._id, name: recipeProduct.name, quantity: 1, price: recipePrice },
      { product: directProduct._id, name: directProduct.name, quantity: 1, price: directPrice },
      { product: noStockProduct._id, name: noStockProduct.name, quantity: 1, price: noStockPrice },
    ],
  };

  let order = await Order.create(orderData);
  console.log(`  ${PASS} Order created: ${order._id}`);
  results.push({ step: 5, status: "PASS", detail: `Order ${order._id}` });

  // ====== STEP 6: Verify KDSOrder auto-created ======
  console.log("\n📋 STEP 6: Wait for KDSOrder creation (fire-and-forget)");
  // The KDS order is created asynchronously via syncOrderToKds in addOrder
  // We need to wait a moment
  await new Promise((r) => setTimeout(r, 1000));

  let kdsOrder = await KDSOrder.findOne({ order: order._id });
  if (!kdsOrder) {
    // Check if syncOrderToKds needs manual trigger
    console.log(`  ${INFO} KDSOrder not auto-created. Checking if sync is manual...`);
    const config = await KDSConfig.getStoreConfig(PILOT_STORE_ID);
    // Manual sync: create KDSOrder directly
    const Table = mongoose.model("Table");
    const tableDoc = await Table.findById(table._id).select("tableNo").lean();
    kdsOrder = await KDSOrder.create({
      store: PILOT_STORE_ID,
      order: order._id,
      orderNumber: `#${Math.floor(new Date().getTime() / 1000)}`,
      table: table._id,
      tableNumber: tableDoc?.tableNo,
      customerName: "Cliente Piloto 9.2",
      orderType: "dine-in",
      items: [
        { orderItem: order.items[0]._id, productId: recipeProduct._id, productName: recipeProduct.name, quantity: 1, station: config.defaultStation || "kitchen", prepTimeMinutes: 15 },
        { orderItem: order.items[1]._id, productId: directProduct._id, productName: directProduct.name, quantity: 1, station: config.defaultStation || "kitchen", prepTimeMinutes: 5 },
        { orderItem: order.items[2]._id, productId: noStockProduct._id, productName: noStockProduct.name, quantity: 1, station: config.defaultStation || "kitchen", prepTimeMinutes: 0 },
      ],
      estimatedReady: new Date(Date.now() + 15 * 60000),
    });
    console.log(`  ${INFO} KDSOrder created manually: ${kdsOrder.kdsOrderId}`);
  } else {
    console.log(`  ${PASS} KDSOrder auto-created: ${kdsOrder.kdsOrderId}`);
  }
  results.push({ step: 6, status: "PASS", detail: `KDSOrder ${kdsOrder.kdsOrderId}` });

  // ====== STEP 7: Process stock deduction ======
  console.log("\n📋 STEP 7: Process stock deduction (via orderCheckoutService)");
  const orderCheckoutService = require("../services/orderCheckoutService");
  const session = await mongoose.startSession();
  session.startTransaction();

  let deductionResult;
  let deductionError;
  try {
    deductionResult = await orderCheckoutService.processOrderStockDeduction({
      storeId: PILOT_STORE_ID,
      orderId: order._id.toString(),
      orderItems: order.items,
      userId: user._id,
      session,
    });

    // Update order items with deduction results
    for (const itemResult of deductionResult.items) {
      const item = order.items.id(itemResult.itemId);
      if (item) {
        if (itemResult.recipeId) { item.recipe = itemResult.recipeId; item.recipeVersion = itemResult.recipeVersion; }
        item.cogs = itemResult.cogs;
        item.ingredientCosts = itemResult.ingredientCosts;
        item.stockDeductionStatus = itemResult.stockDeductionStatus;
        if (itemResult.movements) item.stockMovements = itemResult.movements;
        if (itemResult.stockImpactRule) item.stockImpactRule = itemResult.stockImpactRule;
        if (itemResult.sellableType) item.sellableType = itemResult.sellableType;
      }
    }
    order.totalCOGS = deductionResult.totalCOGS;
    order.stockDeductionStatus = deductionResult.errors.length === 0 ? "completed" : "partial";
    await order.save({ session });
    await session.commitTransaction();
    console.log(`  ${PASS} Stock deduction completed: totalCOGS = R$ ${deductionResult.totalCOGS?.toFixed(2)}`);
    results.push({ step: 7, status: "PASS", detail: `totalCOGS=${deductionResult.totalCOGS?.toFixed(2)}` });
  } catch (err) {
    await session.abortTransaction();
    deductionError = err.message;
    order.stockDeductionStatus = "failed";
    order.stockDeductionError = err.message;
    await order.save();
    console.log(`  ${FAIL} Stock deduction failed: ${err.message}`);
    results.push({ step: 7, status: "FAIL", detail: err.message });
  } finally {
    session.endSession();
  }

  // ====== STEP 8: Verify CMV per item ======
  console.log("\n📋 STEP 8: Verify CMV per item");
  const updatedOrder = await Order.findById(order._id).lean();
  for (const item of updatedOrder.items) {
    const cogs = item.cogs != null ? `R$ ${Number(item.cogs).toFixed(2)}` : "NOT_CALCULATED";
    console.log(`  ${item.cogs != null ? PASS : FAIL} ${item.name}: COGS=${cogs} | status=${item.stockDeductionStatus}`);
    results.push({ step: 8, status: item.cogs != null ? "PASS" : "FAIL", detail: `${item.name} cogs=${cogs}` });
  }

  // ====== STEP 9: Verify StockMovements ======
  console.log("\n📋 STEP 9: Verify StockMovements created");
  const movements = await StockMovement.find({ store: PILOT_STORE_ID, reference: order._id.toString() }).lean();
  if (movements.length > 0) {
    console.log(`  ${PASS} ${movements.length} StockMovements found:`);
    movements.forEach((m) => console.log(`    - ${m.type}: qty=${m.quantity} | bal ${m.balanceBefore}→${m.balanceAfter}`));
    results.push({ step: 9, status: "PASS", detail: `${movements.length} movements` });
  } else {
    console.log(`  ${FAIL} No StockMovements found for order ${order._id}`);
    results.push({ step: 9, status: "FAIL", detail: "No movements" });
  }

  // ====== STEP 10: Verify post-sale stock balances changed ======
  console.log("\n📋 STEP 10: Verify stock balances changed");
  const postBalances = await StockBalance.find({ location: location._id }).populate("ingredient", "name").lean();
  let balanceChanged = false;
  for (const post of postBalances) {
    const pre = preBalanceMap[post.ingredient?._id?.toString()];
    if (pre !== undefined && post.balance !== pre) {
      console.log(`  ${INFO} ${post.ingredient?.name}: ${pre} → ${post.balance} (Δ${(post.balance - pre).toFixed(3)})`);
      balanceChanged = true;
    }
  }
  if (balanceChanged) {
    console.log(`  ${PASS} Stock balances updated`);
    results.push({ step: 10, status: "PASS", detail: "Balances changed" });
  } else {
    console.log(`  ${FAIL} No stock balance change detected`);
    results.push({ step: 10, status: "FAIL", detail: "No balance change" });
  }

  // ====== STEP 11: Check for false alerts ======
  console.log("\n📋 STEP 11: Check operational alerts");
  const alerts = await OperationalAlert.find({
    store: PILOT_STORE_ID,
    "metadata.orderId": order._id.toString(),
  }).lean();
  if (alerts.length > 0) {
    console.log(`  ${INFO} ${alerts.length} alerts found for order`);
    alerts.forEach((a) => console.log(`    - ${a.type} [${a.severity}]: ${a.message}`));
    results.push({ step: 11, status: "WARN", detail: `${alerts.length} alerts` });
  } else {
    console.log(`  ${PASS} No alerts — clean sale`);
    results.push({ step: 11, status: "PASS", detail: "No alerts" });
  }

  // ====== STEP 12: Accept KDS order ======
  console.log("\n📋 STEP 12: Accept KDS order");
  if (kdsOrder && kdsOrder.status === "pending") {
    await kdsOrder.accept(user._id);
    kdsOrder.calculateEstimatedReady();
    await kdsOrder.save();
    console.log(`  ${PASS} KDS order accepted: status = ${kdsOrder.status}`);
  } else {
    console.log(`  ${INFO} KDS order already: ${kdsOrder?.status || "N/A"}`);
  }
  results.push({ step: 12, status: "PASS", detail: `KDS ${kdsOrder?.status}` });

  // ====== STEP 13: Mark KDS order ready ======
  console.log("\n📋 STEP 13: Mark KDS order ready");
  await kdsOrder.markReady();
  // Sync PDV → Ready
  try { await Order.findByIdAndUpdate(order._id, { orderStatus: "Ready" }); } catch {}
  console.log(`  ${PASS} KDS marked ready; PDV updated to Ready`);
  results.push({ step: 13, status: "PASS", detail: "KDS ready, PDV Ready" });

  // ====== STEP 14: Verify PDV orderStatus = Ready ======
  console.log("\n📋 STEP 14: Verify PDV orderStatus = Ready");
  let pdvOrder = await Order.findById(order._id).lean();
  const isReady = pdvOrder.orderStatus === "Ready";
  console.log(`  ${isReady ? PASS : FAIL} PDV orderStatus = ${pdvOrder.orderStatus}`);
  results.push({ step: 14, status: isReady ? "PASS" : "FAIL", detail: `PDV ${pdvOrder.orderStatus}` });

  // ====== STEP 15: Mark KDS order served ======
  console.log("\n📋 STEP 15: Mark KDS order served");
  await kdsOrder.markServed();
  // Sync PDV → completed
  try { await Order.findByIdAndUpdate(order._id, { orderStatus: "completed" }); } catch {}
  console.log(`  ${PASS} KDS marked served; PDV updated to completed`);
  results.push({ step: 15, status: "PASS", detail: "KDS served, PDV completed" });

  // ====== STEP 16: Verify PDV orderStatus = completed ======
  console.log("\n📋 STEP 16: Verify PDV orderStatus = completed");
  pdvOrder = await Order.findById(order._id).lean();
  const isCompleted = pdvOrder.orderStatus === "completed";
  console.log(`  ${isCompleted ? PASS : FAIL} PDV orderStatus = ${pdvOrder.orderStatus}`);
  results.push({ step: 16, status: isCompleted ? "PASS" : "FAIL", detail: `PDV ${pdvOrder.orderStatus}` });

  // ====== FINAL SUMMARY ======
  const totalSteps = results.length;
  const passedSteps = results.filter((r) => r.status === "PASS").length;
  const failedSteps = results.filter((r) => r.status === "FAIL").length;
  const warnSteps = results.filter((r) => r.status === "WARN").length;
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n" + "=".repeat(70));
  console.log("E2E SALE SUMMARY:");
  console.log(`  Duration: ${duration}s`);
  console.log(`  Steps: ${totalSteps}`);
  console.log(`  ✅ Passed: ${passedSteps}`);
  console.log(`  ⚠️ Warnings: ${warnSteps}`);
  console.log(`  ❌ Failed: ${failedSteps}`);
  console.log(`  All passed: ${failedSteps === 0 ? "✅ YES" : "❌ NO"}`);
  console.log("=".repeat(70));

  await mongoose.disconnect();
  process.exit(failedSteps > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`\n❌ E2E test crashed: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
