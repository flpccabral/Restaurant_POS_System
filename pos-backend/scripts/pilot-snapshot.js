/**
 * Fase 9.2 — Task 11: Pre-pilot snapshot
 * Exports all critical collections to JSON for backup/reference
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const PILOT_STORE_ID = "6a1101372ff5c713c1b1a147";
const SNAPSHOT_DIR = path.join(__dirname, "..", "snapshots", `pilot-${Date.now()}`);

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  // Register all models
  require("../models/orderModel");
  require("../models/kdsOrderModel");
  require("../models/stockBalanceModel");
  require("../models/stockMovementModel");
  require("../models/stockLocationModel");
  require("../models/operationalAlertModel");
  require("../models/productModel");
  require("../models/recipeModel");
  require("../models/globalIngredientModel");
  require("../models/userModel");

  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

  const collections = {
    orders: { model: "Order", filter: { store: PILOT_STORE_ID }, sort: { createdAt: -1 }, limit: 100 },
    kds_orders: { model: "KDSOrder", filter: { store: PILOT_STORE_ID }, sort: { createdAt: -1 }, limit: 100 },
    stockbalances: { model: "StockBalance", filter: {}, sort: {}, limit: 0, populate: ["location", "ingredient"] },
    stockmovements: { model: "StockMovement", filter: { store: PILOT_STORE_ID }, sort: { createdAt: -1 }, limit: 200 },
    operationalalerts: { model: "OperationalAlert", filter: { store: PILOT_STORE_ID }, sort: { createdAt: -1 }, limit: 100 },
    products: { model: "Product", filter: { store: PILOT_STORE_ID }, sort: {}, limit: 0 },
    recipes: { model: "Recipe", filter: { store: PILOT_STORE_ID }, sort: {}, limit: 0 },
    ingredients: { model: "GlobalIngredient", filter: {}, sort: {}, limit: 0 },
    users: { model: "User", filter: { store: PILOT_STORE_ID }, sort: {}, limit: 0, populate: ["role"] },
  };

  const snapshotMeta = {
    timestamp: new Date().toISOString(),
    storeId: PILOT_STORE_ID,
    collections: {},
  };

  for (const [name, config] of Object.entries(collections)) {
    let query = mongoose.model(config.model).find(config.filter).sort(config.sort).lean();
    if (config.limit > 0) query = query.limit(config.limit);
    for (const pop of config.populate || []) {
      query = query.populate(pop, "name ingredientUnit balance");
    }
    const data = await query;

    const filePath = path.join(SNAPSHOT_DIR, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    snapshotMeta.collections[name] = { count: data.length, file: `${name}.json` };
    console.log(`  ✅ ${name}: ${data.length} records → ${name}.json`);
  }

  // Write metadata
  fs.writeFileSync(path.join(SNAPSHOT_DIR, "_meta.json"), JSON.stringify(snapshotMeta, null, 2));

  console.log(`\n✅ Snapshot saved to: ${SNAPSHOT_DIR}`);
  console.log(`   ${Object.keys(snapshotMeta.collections).length} collections exported`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Snapshot failed:", err.message);
  process.exit(1);
});
