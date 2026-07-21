/**
 * Fase 9.2 — Task 4: Validate initial pilot stock
 * Pre-pilot snapshot with classification: OK, BAIXO, SEM_POLITICA, SEM_SALDO
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const PILOT_STORE_ID = "6a1101372ff5c713c1b1a147";

const CLASSIFICATIONS = {
  OK: "OK",
  BAIXO: "BAIXO",
  SEM_POLITICA: "SEM_POLITICA",
  SEM_SALDO: "SEM_SALDO",
};

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  require("../models/productModel");
  require("../models/recipeModel");
  require("../models/globalIngredientModel");
  require("../models/stockBalanceModel");
  require("../models/stockLocationModel");
  require("../models/stockPolicyModel");
  require("../models/orderModel");
  require("../models/kdsOrderModel");

  const Product = mongoose.model("Product");
  const Recipe = mongoose.model("Recipe");
  const StockBalance = mongoose.model("StockBalance");
  const StockLocation = mongoose.model("StockLocation");
  const StockPolicy = mongoose.model("StockPolicy");
  const Order = mongoose.model("Order");
  const KDSOrder = mongoose.model("KDSOrder");

  const location = await StockLocation.findOne({ store: PILOT_STORE_ID, isActive: true });
  if (!location) {
    console.error("❌ No active stock location found for pilot store");
    process.exit(1);
  }

  const balances = await StockBalance.find({ location: location._id })
    .populate("ingredient", "name ingredientUnit averageCost")
    .lean();
  const policies = await StockPolicy.find({ store: PILOT_STORE_ID, isActive: true }).lean();
  const products = await Product.find({ store: PILOT_STORE_ID, isActive: true }).lean();
  const recipes = await Recipe.find({ store: PILOT_STORE_ID, isActive: true }).lean();

  // Build a set of ingredients used by active products
  const activeIngredientIds = new Set();
  for (const product of products) {
    if (product.stockImpactRule === "recipe_composition") {
      const recipe = recipes.find((r) => r.product?.toString() === product._id.toString());
      if (recipe) {
        recipe.ingredients.forEach((ing) => activeIngredientIds.add(ing.ingredient?.toString()));
      }
    }
    if (product.stockImpactRule === "stock_item_direct" && product.directStockItem) {
      activeIngredientIds.add(product.directStockItem.toString());
    }
  }

  // Today's date for consumption calculation
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log("=".repeat(70));
  console.log("FASE 9.2 — TASK 4: STOCK VALIDATION SNAPSHOT");
  console.log("=".repeat(70));
  console.log(`Location: ${location.name} (${location._id})`);
  console.log(`Total balances: ${balances.length}`);
  console.log(`Active products: ${products.length}`);
  console.log(`Active ingredient IDs in use: ${activeIngredientIds.size}`);
  console.log(`Active policies: ${policies.length}`);
  console.log("=".repeat(70));

  let semSaldoCount = 0;
  let baixoCount = 0;
  let semPoliticaCount = 0;
  let okCount = 0;

  const snapshot = [];

  for (const balance of balances) {
    const ingredient = balance.ingredient;
    const ingredientId = ingredient?._id?.toString();
    const policy = policies.find((p) => p.ingredient?.toString() === ingredientId);

    // Classification
    let classification;
    if (balance.balance <= 0) {
      classification = CLASSIFICATIONS.SEM_SALDO;
      semSaldoCount++;
    } else if (!policy) {
      classification = CLASSIFICATIONS.SEM_POLITICA;
      semPoliticaCount++;
    } else if (balance.balance <= (policy.reorderPoint || 0)) {
      classification = CLASSIFICATIONS.BAIXO;
      baixoCount++;
    } else {
      classification = CLASSIFICATIONS.OK;
      okCount++;
    }

    const usedByActiveProduct = activeIngredientIds.has(ingredientId);

    snapshot.push({
      ingredientId: ingredientId || "?",
      ingredientName: ingredient?.name || "UNKNOWN",
      unit: ingredient?.ingredientUnit || "?",
      balance: balance.balance,
      reserved: balance.reserved,
      available: balance.available ?? balance.balance - (balance.reserved || 0),
      averageCost: ingredient?.averageCost ?? "UNDEFINED",
      classification,
      usedByActiveProduct,
      policy: policy
        ? {
            id: policy._id,
            min: policy.minimum,
            reorder: policy.reorderPoint,
            ideal: policy.ideal,
            max: policy.maximum,
          }
        : null,
    });
  }

  // Print results
  snapshot.forEach((s) => {
    const icon =
      s.classification === CLASSIFICATIONS.OK
        ? "✅"
        : s.classification === CLASSIFICATIONS.BAIXO
        ? "⚠️"
        : s.classification === CLASSIFICATIONS.SEM_POLITICA
        ? "📋"
        : "❌";
    const usedTag = s.usedByActiveProduct ? "[ATIVO]" : "[inativo]";
    console.log(`${icon} ${s.ingredientName} ${usedTag} | bal: ${s.balance} ${s.unit} | cost: ${s.averageCost} | ${s.classification}`);
  });

  // Determine if pilot is BLOCKED
  const blockingItems = snapshot.filter(
    (s) => s.classification === CLASSIFICATIONS.SEM_SALDO && s.usedByActiveProduct
  );

  console.log("\n" + "=".repeat(70));
  console.log("SUMMARY:");
  console.log(`  ✅ OK: ${okCount}`);
  console.log(`  ⚠️ BAIXO: ${baixoCount}`);
  console.log(`  📋 SEM_POLITICA: ${semPoliticaCount}`);
  console.log(`  ❌ SEM_SALDO: ${semSaldoCount}`);
  console.log(`  🚫 BLOCKING (SEM_SALDO + active product): ${blockingItems.length}`);

  if (blockingItems.length > 0) {
    console.log("\n❌ PILOT BLOCKED — Items without stock for active products:");
    blockingItems.forEach((s) => console.log(`  - ${s.ingredientName}: balance=${s.balance} ${s.unit}`));
  } else {
    console.log("\n✅ No blocking items — stock is sufficient for pilot");
  }

  const exitCode = blockingItems.length > 0 ? 1 : 0;
  console.log(`🏁 Exit code: ${exitCode}`);

  await mongoose.disconnect();
  process.exit(exitCode);
}

main().catch((err) => {
  console.error("❌ Script failed:", err.message);
  process.exit(1);
});
