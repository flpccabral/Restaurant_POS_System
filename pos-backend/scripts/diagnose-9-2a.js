/**
 * Fase 9.2A — Diagnostic script: inspect current state of all 5 ressalvas
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const PILOT_STORE_ID = "6a1101372ff5c713c1b1a147";

async function main() {
  console.log("=".repeat(70));
  console.log("FASE 9.2A — DIAGNOSTIC: Current Data State");
  console.log("=".repeat(70));

  await mongoose.connect(process.env.MONGODB_URI);
  require("../models/productModel");
  require("../models/globalIngredientModel");
  require("../models/stockBalanceModel");
  require("../models/stockLocationModel");
  require("../models/operationalAlertModel");
  require("../models/orderModel");
  require("../models/recipeModel");

  const Product = mongoose.model("Product");
  const GlobalIngredient = mongoose.model("GlobalIngredient");
  const StockBalance = mongoose.model("StockBalance");
  const StockLocation = mongoose.model("StockLocation");
  const OperationalAlert = mongoose.model("OperationalAlert");
  const Order = mongoose.model("Order");
  const Recipe = mongoose.model("Recipe");

  // ========== T1: Active products with prices ==========
  console.log("\n📋 T1: ACTIVE PRODUCTS FOR PILOT STORE");
  const allProducts = await Product.find({ store: PILOT_STORE_ID }).lean();
  const activeProducts = allProducts.filter(p => p.isActive !== false);
  console.log(`  Total products in store: ${allProducts.length}`);
  console.log(`  Active products: ${activeProducts.length}`);
  console.log(`  Inactive: ${allProducts.filter(p => p.isActive === false).length}`);

  for (const p of activeProducts) {
    const hasPrice = p.price != null && p.price !== undefined;
    const priceStr = hasPrice ? `R$${Number(p.price).toFixed(2)}` : "MISSING/UNDEFINED";
    const issues = [];
    if (!hasPrice) issues.push("NO_PRICE");
    if (p.price === 0) issues.push("ZERO_PRICE");
    console.log(`  ${issues.length > 0 ? "⚠️" : "✅"} ${p.name} | price=${priceStr} | rule=${p.stockImpactRule} | isActive=${p.isActive} | _id=${p._id}`);
    if (issues.length) console.log(`       Issues: ${issues.join(", ")}`);
  }

  // ========== T2: Hamburgue specifics ==========
  console.log("\n📋 T2: HAMBURGUE PRODUCT");
  const hamburgue = allProducts.find(p => p.name && p.name.toLowerCase().includes("hamburgue") && !p.name.toLowerCase().includes("artesanal"));
  if (hamburgue) {
    console.log(`  Product: ${hamburgue.name} | _id=${hamburgue._id} | isActive=${hamburgue.isActive}`);
    console.log(`  stockImpactRule: ${hamburgue.stockImpactRule}`);

    if (hamburgue.recipe) {
      const recipe = await Recipe.findById(hamburgue.recipe).lean();
      if (recipe) {
        console.log(`  Recipe: ${recipe.name} | ingredients: ${recipe.ingredients?.length || 0}`);
        if (recipe.ingredients) {
          for (const ing of recipe.ingredients) {
            const gi = await GlobalIngredient.findById(ing.ingredient).lean();
            console.log(`    - ${gi?.name || ing.ingredient}: qty=${ing.quantity} ${ing.unit || "?"}`);
            // Check stock
            const loc = await StockLocation.findOne({ store: PILOT_STORE_ID, isActive: true });
            if (loc && gi) {
              const sb = await StockBalance.findOne({ location: loc._id, ingredient: gi._id }).lean();
              console.log(`      StockBalance: ${sb ? sb.balance : "NO_BALANCE_RECORD"}`);
            }
          }
        }
      }
    }
  } else {
    console.log("  Hamburgue not found as separate product (only Hambúrguer Artesanal exists)");
  }

  // ========== T4: Refrigerante Lata cost ==========
  console.log("\n📋 T4: REFRIGERANTE LATA — COST AUDIT");
  const refriIngredient = await GlobalIngredient.findOne({ name: /refrigerante/i }).lean();
  if (refriIngredient) {
    console.log(`  GlobalIngredient: ${refriIngredient.name} | _id=${refriIngredient._id}`);
    console.log(`  averageCost: ${refriIngredient.averageCost ?? "UNDEFINED"}`);
    console.log(`  ingredientUnit: ${refriIngredient.ingredientUnit}`);
  } else {
    console.log("  No ingredient matching 'refrigerante' found in GlobalIngredient");
    const allIngredients = await GlobalIngredient.find({}).lean();
    console.log(`  All ingredients (${allIngredients.length}):`);
    allIngredients.forEach(i => console.log(`    - ${i.name} | avgCost=${i.averageCost}`));
  }

  // Also check StockBalance for Refrigerante
  const loc = await StockLocation.findOne({ store: PILOT_STORE_ID, isActive: true });
  if (loc && refriIngredient) {
    const sb = await StockBalance.findOne({ location: loc._id, ingredient: refriIngredient._id }).lean();
    if (sb) {
      console.log(`  StockBalance: balance=${sb.balance} | lastPurchasePrice=${sb.lastPurchasePrice ?? "UNDEFINED"}`);
    } else {
      console.log(`  No StockBalance for Refrigerante in pilot store`);
    }
  }

  // ========== T5: Taxa duplicates ==========
  console.log("\n📋 T5: TAXA DE SERVIÇO — DUPLICATE CHECK");
  const taxaProducts = allProducts.filter(p => p.name && p.name.toLowerCase().includes("taxa"));
  for (const t of taxaProducts) {
    console.log(`  ${t.name} | _id=${t._id} | isActive=${t.isActive} | price=${t.price} | rule=${t.stockImpactRule} | sellableType=${t.sellableType || "UNDEFINED"}`);
    const orderCount = await Order.countDocuments({ "items.product": t._id });
    console.log(`    Orders referencing this product: ${orderCount}`);
  }

  // ========== T3: Alerts ==========
  console.log("\n📋 T3: ALL OPERATIONAL ALERTS FOR PILOT STORE");
  const alerts = await OperationalAlert.find({ store: PILOT_STORE_ID }).sort({ createdAt: -1 }).lean();
  console.log(`  Total alerts: ${alerts.length}`);
  const byType = {};
  const byStatus = {};
  for (const a of alerts) {
    byType[a.type] = (byType[a.type] || 0) + 1;
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
  }
  console.log(`  By type: ${JSON.stringify(byType)}`);
  console.log(`  By status: ${JSON.stringify(byStatus)}`);

  for (const a of alerts) {
    const age = Math.floor((Date.now() - new Date(a.createdAt).getTime()) / 86400000);
    console.log(`  [${a.status}] ${a.type} [${a.severity}] — ${a.message?.substring(0, 100)} — ${age}d ago | _id=${a._id}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("DIAGNOSTIC COMPLETE");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error("Diagnostic failed:", err.message);
  process.exit(1);
});
