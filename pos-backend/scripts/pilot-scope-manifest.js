/**
 * Fase 9.2 — Task 1: Freeze pilot scope manifest
 * Define what enters and what stays out of the controlled pilot.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const PILOT_STORE_ID = "6a1101372ff5c713c1b1a147";
const PILOT_STORE_NAME = "Loja Demo - Matriz";

const SCOPE = {
  pilotName: "Piloto Controlado — Fase 9.2",
  version: "1.0.0",
  frozenAt: new Date().toISOString(),
  store: { id: PILOT_STORE_ID, name: PILOT_STORE_NAME },

  inScope: {
    channels: ["dine-in", "takeout", "counter"],
    stations: ["kitchen"],
    users: {
      manager: "gerente.demo@pos.com",
      operator: "operador.demo@pos.com",
      admin: "admin@pos.com",
    },
    productRules: ["recipe_composition", "stock_item_direct", "no_stock_impact"],
    kds: {
      stations: ["kitchen"],
      defaultStation: "kitchen",
      syncBidirectional: true,
    },
    stock: {
      location: "Estoque - Loja Demo - Matriz",
      minimumBalancePolicy: "warn_only",
    },
  },

  outOfScope: {
    productRules: ["combo_components"],
    features: [
      "full_internal_production",
      "multi_station_kds_advanced",
      "auto_purchase",
      "real_gateway_integration",
      "partial_stock_reversals",
      "combo_components_breakdown",
      "production_interna_completa",
    ],
    channels: ["delivery", "self_service_kiosk", "qr_table_ordering"],
  },

  acceptanceCriteria: {
    allActiveProductsApproved: true,
    zeroStockBalanceForActiveProduct: "BLOCK_PILOT",
    e2eSale16StepsPassed: true,
    zeroCriticalDivergences: true,
    noFalseAlerts: true,
    allBuildsPass: true,
  },
};

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  require("../models/productModel");
  require("../models/recipeModel");
  require("../models/globalIngredientModel");
  require("../models/stockBalanceModel");
  require("../models/stockLocationModel");

  const Product = mongoose.model("Product");
  const StockLocation = mongoose.model("StockLocation");

  const products = await Product.find({ store: SCOPE.store.id, isActive: true }).lean();
  const location = await StockLocation.findOne({ store: SCOPE.store.id, isActive: true }).lean();

  SCOPE.productsInPilot = products.map((p) => ({
    id: p._id.toString(),
    name: p.name,
    sellableType: p.sellableType || "undefined",
    stockImpactRule: p.stockImpactRule || "undefined",
    price: p.price || 0,
  }));

  SCOPE.stockLocation = location
    ? { id: location._id.toString(), name: location.name }
    : null;

  // Out of scope products (inactive)
  const inactiveProducts = await Product.find({ store: SCOPE.store.id, isActive: false }).lean();
  SCOPE.outOfScopeProducts = inactiveProducts.map((p) => ({
    id: p._id.toString(),
    name: p.name,
    reason: "inactive",
  }));

  console.log(JSON.stringify(SCOPE, null, 2));
  console.log("\n✅ Pilot scope manifest generated");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Failed:", err.message);
  process.exit(1);
});
