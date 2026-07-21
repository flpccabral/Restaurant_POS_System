/**
 * Fase 9.2 — Task 3: Validate recipes and direct items
 * Deep-dive into recipe_composition and stock_item_direct products
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const PILOT_STORE_ID = "6a1101372ff5c713c1b1a147";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  require("../models/productModel");
  require("../models/recipeModel");
  require("../models/globalIngredientModel");
  require("../models/stockBalanceModel");
  require("../models/stockLocationModel");

  const Product = mongoose.model("Product");
  const Recipe = mongoose.model("Recipe");
  const GlobalIngredient = mongoose.model("GlobalIngredient");
  const StockBalance = mongoose.model("StockBalance");
  const StockLocation = mongoose.model("StockLocation");

  const products = await Product.find({ store: PILOT_STORE_ID, isActive: true }).lean();
  const location = await StockLocation.findOne({ store: PILOT_STORE_ID, isActive: true });
  const balances = location
    ? await StockBalance.find({ location: location._id }).populate("ingredient", "name ingredientUnit averageCost").lean()
    : [];
  const allRecipes = await Recipe.find({ store: PILOT_STORE_ID, isActive: true })
    .populate("product", "name")
    .populate("ingredients.ingredient", "name ingredientUnit averageCost")
    .lean();

  console.log("=".repeat(70));
  console.log("FASE 9.2 — TASK 3: RECIPE & DIRECT ITEM VALIDATION");
  console.log("=".repeat(70));

  let criticalIssues = 0;

  // Validate recipe_composition products
  const recipeProducts = products.filter((p) => p.stockImpactRule === "recipe_composition");
  console.log(`\n📋 RECIPE_COMPOSITION products: ${recipeProducts.length}`);

  for (const product of recipeProducts) {
    console.log(`\n--- ${product.name} (${product._id}) ---`);
    const recipe = allRecipes.find((r) => r.product?._id?.toString() === product._id.toString());

    if (!recipe) {
      console.log("  ❌ CRITICAL: No active recipe found!");
      criticalIssues++;
      continue;
    }

    console.log(`  Recipe: ${recipe._id} | Yield: ${recipe.yieldQuantity} ${recipe.yieldUnit || "?"}`);
    console.log(`  Ingredients (${recipe.ingredients.length}):`);

    let allIngredientsOk = true;
    let totalCost = 0;

    for (const ing of recipe.ingredients) {
      const ingredient = ing.ingredient;
      const balance = balances.find(
        (b) => b.ingredient?._id?.toString() === ingredient?._id?.toString()
      );

      const stockQty = balance?.balance ?? 0;
      const cost = ingredient?.averageCost ?? balance?.averageCost ?? null;
      const neededForOne = ing.netQuantity * (recipe.yieldQuantity || 1);
      const canMakeAtLeastOne = stockQty >= (ing.netQuantity || 0);
      const costForThisIngredient = cost != null ? cost * (ing.netQuantity || 0) : null;

      if (costForThisIngredient != null) totalCost += costForThisIngredient / (recipe.yieldQuantity || 1);

      const issues = [];
      if (!ingredient) issues.push("MISSING_INGREDIENT");
      if (stockQty <= 0) issues.push("SEM_SALDO");
      if (cost == null) issues.push("SEM_CUSTO");
      if (!canMakeAtLeastOne) issues.push("STOCK_INSUFFICIENT");

      const status = issues.length === 0 ? "✅" : issues.includes("SEM_SALDO") || issues.includes("MISSING_INGREDIENT") ? "❌" : "⚠️";

      if (issues.length > 0 && (issues.includes("SEM_SALDO") || issues.includes("MISSING_INGREDIENT"))) {
        allIngredientsOk = false;
        criticalIssues++;
      }

      console.log(`  ${status} ${ingredient?.name || "UNKNOWN"} | qty: ${ing.netQuantity}${ing.unit} | stock: ${stockQty} | cost: ${cost != null ? "R$" + cost.toFixed(2) : "UNDEFINED"} ${issues.length > 0 ? "[" + issues.join(",") + "]" : ""}`);
    }

    console.log(`  Total estimated cost per unit: ${totalCost > 0 ? "R$" + totalCost.toFixed(2) : "UNDEFINED"}`);
    console.log(`  All ingredients OK: ${allIngredientsOk ? "✅ YES" : "❌ NO — needs attention"}`);
  }

  // Validate stock_item_direct products
  const directProducts = products.filter((p) => p.stockImpactRule === "stock_item_direct");
  console.log(`\n\n📦 STOCK_ITEM_DIRECT products: ${directProducts.length}`);

  for (const product of directProducts) {
    console.log(`\n--- ${product.name} (${product._id}) ---`);

    if (!product.directStockItem) {
      console.log("  ❌ CRITICAL: directStockItem not set!");
      criticalIssues++;
      continue;
    }

    const balance = balances.find(
      (b) => b.ingredient?._id?.toString() === product.directStockItem?.toString()
    );
    const stockQty = balance?.balance ?? 0;
    const needed = product.directStockQuantity || 1;
    const cost = balance?.averageCost != null ? balance.averageCost : "UNDEFINED";
    const stockOk = stockQty >= needed;

    if (!stockOk) criticalIssues++;

    console.log(`  Direct item: ${product.directStockItem} | need: ${needed} ${product.directStockUnit || "?"}`);
    console.log(`  Stock: ${stockQty} | AverageCost: ${cost} | ${stockOk ? "✅ OK" : "❌ STOCK INSUFFICIENT"}`);
  }

  // Validate no_stock_impact products
  const noStockProducts = products.filter((p) => p.stockImpactRule === "no_stock_impact");
  console.log(`\n\n🔧 NO_STOCK_IMPACT products: ${noStockProducts.length}`);
  for (const product of noStockProducts) {
    const hasRecipe = allRecipes.some((r) => r.product?._id?.toString() === product._id.toString());
    console.log(`  ✅ ${product.name} — no recipe: ${!hasRecipe ? "✅ (correct)" : "⚠️ (has recipe but shouldn't matter)"}, no stock needed`);
  }

  console.log("\n" + "=".repeat(70));
  console.log(`🏁 Critical issues found: ${criticalIssues}`);
  console.log(`Exit code: ${criticalIssues > 0 ? 1 : 0}`);

  await mongoose.disconnect();
  process.exit(criticalIssues > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("❌ Script failed:", err.message);
  process.exit(1);
});
