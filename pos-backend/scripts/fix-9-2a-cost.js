/**
 * Fase 9.2A — Fix Script: averageCost (T4)
 *
 * Fixes Refrigerante Lata ingredient:
 *   - averageCost: 0.01 → 3.50 (GlobalIngredient)
 *   - ingredientUnit: undefined → "un" (unit)
 *   - Checks StockBalance.lastPurchasePrice consistency
 *
 * Usage: node scripts/fix-9-2a-cost.js [--dry-run]
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const PILOT_STORE_ID = "6a1101372ff5c713c1b1a147";
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log("=".repeat(70));
  console.log(`FASE 9.2A — FIX COST (T4)${DRY_RUN ? " [DRY RUN]" : ""}`);
  console.log("=".repeat(70));

  await mongoose.connect(process.env.MONGODB_URI);
  require("../models/globalIngredientModel");
  require("../models/stockBalanceModel");
  require("../models/stockLocationModel");
  require("../models/productModel");

  const GlobalIngredient = mongoose.model("GlobalIngredient");
  const StockBalance = mongoose.model("StockBalance");
  const StockLocation = mongoose.model("StockLocation");
  const Product = mongoose.model("Product");

  // Find the Refrigerante ingredient
  const ingredient = await GlobalIngredient.findOne({ name: /refrigerante/i }).lean();
  if (!ingredient) {
    console.log("❌ Refrigerante ingredient not found");
    process.exit(1);
  }

  console.log(`\n📋 Ingredient: ${ingredient.name} (${ingredient._id})`);
  console.log(`  Current averageCost: ${ingredient.averageCost ?? "UNDEFINED"}`);
  console.log(`  Current ingredientUnit: ${ingredient.ingredientUnit ?? "UNDEFINED"}`);

  const newCost = 3.50;
  const newUnit = "un";

  if (!DRY_RUN) {
    await GlobalIngredient.updateOne(
      { _id: ingredient._id },
      { averageCost: newCost, ingredientUnit: newUnit }
    );
    console.log(`  ✅ averageCost: ${ingredient.averageCost} → ${newCost}`);
    console.log(`  ✅ ingredientUnit: ${ingredient.ingredientUnit ?? "UNDEFINED"} → ${newUnit}`);
  } else {
    console.log(`  [DRY] Would set averageCost: ${newCost}, ingredientUnit: ${newUnit}`);
  }

  // Audit: check StockBalance for pilot store
  console.log("\n📋 StockBalance audit for pilot store");
  const location = await StockLocation.findOne({ store: PILOT_STORE_ID, isActive: true });
  if (!location) {
    console.log("  ⚠️ No active StockLocation for pilot store");
  } else {
    const sb = await StockBalance.findOne({ location: location._id, ingredient: ingredient._id }).lean();
    if (sb) {
      console.log(`  StockBalance found: balance=${sb.balance} | lastPurchasePrice=${sb.lastPurchasePrice ?? "UNDEFINED"}`);
      if (sb.lastPurchasePrice == null || sb.lastPurchasePrice === 0) {
        if (!DRY_RUN) {
          await StockBalance.updateOne({ _id: sb._id }, { lastPurchasePrice: newCost });
          console.log(`  ✅ lastPurchasePrice: ${sb.lastPurchasePrice} → ${newCost}`);
        } else {
          console.log(`  [DRY] Would set lastPurchasePrice: ${newCost}`);
        }
      }
    } else {
      console.log(`  ⚠️ No StockBalance for Refrigerante in pilot store`);
      console.log(`  Creating StockBalance entry...`);
      if (!DRY_RUN) {
        await StockBalance.create({
          location: location._id,
          ingredient: ingredient._id,
          unit: newUnit,
          balance: 100,
          lastPurchasePrice: newCost,
        });
        console.log(`  ✅ StockBalance created: balance=100, lastPurchasePrice=${newCost}`);
      } else {
        console.log(`  [DRY] Would create StockBalance: balance=100, lastPurchasePrice=${newCost}`);
      }
    }
  }

  // Audit: check products referencing this ingredient
  console.log("\n📋 Products referencing Refrigerante as directStockItem");
  const refriProduct = await Product.findOne({
    store: PILOT_STORE_ID,
    name: /refrigerante/i,
    stockImpactRule: "stock_item_direct",
    isActive: { $ne: false },
  }).lean();

  if (refriProduct) {
    console.log(`  Product: ${refriProduct.name} (${refriProduct._id})`);
    console.log(`  directStockItem: ${refriProduct.directStockItem ?? "UNDEFINED"}`);
    console.log(`  price: ${refriProduct.price ?? "UNDEFINED"}`);

    // Ensure directStockItem points to the ingredient
    if (!refriProduct.directStockItem || refriProduct.directStockItem.toString() !== ingredient._id.toString()) {
      if (!DRY_RUN) {
        await Product.updateOne({ _id: refriProduct._id }, { directStockItem: ingredient._id });
        console.log(`  ✅ directStockItem set to ${ingredient._id}`);
      } else {
        console.log(`  [DRY] Would set directStockItem to ${ingredient._id}`);
      }
    } else {
      console.log(`  ✅ directStockItem correctly points to ingredient`);
    }
  } else {
    console.log("  ⚠️ No active stock_item_direct Refrigerante product found");
  }

  // Final verification
  console.log("\n📋 FINAL VERIFICATION");
  const updated = await GlobalIngredient.findById(ingredient._id).lean();
  console.log(`  GlobalIngredient.averageCost: ${updated.averageCost} ${updated.averageCost === newCost ? "✅" : "❌"}`);
  console.log(`  GlobalIngredient.ingredientUnit: ${updated.ingredientUnit} ${updated.ingredientUnit === newUnit ? "✅" : "❌"}`);

  // Audit ALL ingredients for completeness
  console.log("\n📋 AUDIT: All GlobalIngredients with missing/problematic fields");
  const allIngredients = await GlobalIngredient.find({}).lean();
  for (const ing of allIngredients) {
    const issues = [];
    if (ing.averageCost == null || ing.averageCost === undefined) issues.push("NO_AVG_COST");
    if (ing.averageCost === 0) issues.push("ZERO_AVG_COST");
    if (!ing.ingredientUnit) issues.push("NO_UNIT");
    if (issues.length) {
      console.log(`  ⚠️ ${ing.name}: ${issues.join(", ")} | cost=${ing.averageCost} unit=${ing.ingredientUnit}`);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(`🏁 T4: COMPLETE${DRY_RUN ? " [DRY RUN]" : ""}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Fix script failed:", err.message);
  process.exit(1);
});
