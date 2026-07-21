/**
 * Fase 9.2 — Task 2: Validate pilot product data
 * Classifies each product as APROVADO_PILOTO, BLOQUEAR_PILOTO, or FORA_DO_ESCOPO
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const PILOT_STORE_ID = "6a1101372ff5c713c1b1a147";

const CLASSIFICATIONS = {
  APROVADO_PILOTO: "APROVADO_PILOTO",
  BLOQUEAR_PILOTO: "BLOQUEAR_PILOTO",
  FORA_DO_ESCOPO: "FORA_DO_ESCOPO",
};

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  require("../models/productModel");
  require("../models/recipeModel");
  require("../models/globalIngredientModel");
  require("../models/stockBalanceModel");
  require("../models/stockLocationModel");

  const Product = mongoose.model("Product");
  const Recipe = mongoose.model("Recipe");
  const StockBalance = mongoose.model("StockBalance");
  const StockLocation = mongoose.model("StockLocation");

  const products = await Product.find({ store: PILOT_STORE_ID }).lean();
  const recipes = await Recipe.find({ store: PILOT_STORE_ID, isActive: true }).lean();
  const location = await StockLocation.findOne({ store: PILOT_STORE_ID, isActive: true });
  const balances = location
    ? await StockBalance.find({ location: location._id }).populate("ingredient", "name ingredientUnit").lean()
    : [];

  const results = [];
  let blockedCount = 0;
  let approvedCount = 0;
  let outOfScopeCount = 0;

  for (const product of products) {
    const rule = product.stockImpactRule;
    const sellable = product.sellableType;
    const price = product.price;

    let classification;
    let reason = "";

    // 1. Inactive products → FORA_DO_ESCOPO
    if (!product.isActive) {
      classification = CLASSIFICATIONS.FORA_DO_ESCOPO;
      reason = "Produto inativo";
      outOfScopeCount++;
    }
    // 2. combo_components → FORA_DO_ESCOPO (out of pilot scope)
    else if (rule === "combo_components") {
      classification = CLASSIFICATIONS.FORA_DO_ESCOPO;
      reason = "combo_components fora do escopo do piloto";
      outOfScopeCount++;
    }
    // 3. Missing stockImpactRule → BLOQUEAR
    else if (!rule) {
      classification = CLASSIFICATIONS.BLOQUEAR_PILOTO;
      reason = "stockImpactRule ausente";
      blockedCount++;
    }
    // 4. recipe_composition: check recipe exists
    else if (rule === "recipe_composition") {
      const recipe = recipes.find((r) => r.product?.toString() === product._id.toString());
      if (!recipe) {
        classification = CLASSIFICATIONS.BLOQUEAR_PILOTO;
        reason = "ready_missing_recipe — recipe_composition sem Recipe ativa";
        blockedCount++;
      } else if (!sellable || !price) {
        classification = CLASSIFICATIONS.APROVADO_PILOTO;
        reason = "recipe_composition com receita ativa (preço/sellableType incompleto — verificar)";
        approvedCount++;
      } else {
        classification = CLASSIFICATIONS.APROVADO_PILOTO;
        reason = "ready_for_sale — recipe_composition com receita ativa";
        approvedCount++;
      }
    }
    // 5. stock_item_direct: check directStockItem fields
    else if (rule === "stock_item_direct") {
      if (!product.directStockItem) {
        classification = CLASSIFICATIONS.BLOQUEAR_PILOTO;
        reason = "ready_missing_direct — stock_item_direct sem directStockItem";
        blockedCount++;
      } else {
        classification = CLASSIFICATIONS.APROVADO_PILOTO;
        reason = "ready_direct_ok — stock_item_direct configurado";
        approvedCount++;
      }
    }
    // 6. no_stock_impact: always approved for pilot (service fees, etc.)
    else if (rule === "no_stock_impact") {
      classification = CLASSIFICATIONS.APROVADO_PILOTO;
      reason = "ready_no_stock_impact";
      approvedCount++;
    }
    // 7. Unknown rule → BLOQUEAR
    else {
      classification = CLASSIFICATIONS.BLOQUEAR_PILOTO;
      reason = `incomplete_config — regra desconhecida: ${rule}`;
      blockedCount++;
    }

    // Check recipe details for approved recipe_composition
    let recipeDetails = null;
    if (classification === CLASSIFICATIONS.APROVADO_PILOTO && rule === "recipe_composition") {
      const recipe = recipes.find((r) => r.product?.toString() === product._id.toString());
      if (recipe) {
        const ingredientBreakdown = recipe.ingredients.map((ing) => {
          const balance = balances.find(
            (b) => b.ingredient?._id?.toString() === ing.ingredient?.toString()
          );
          const stockOk = balance ? balance.balance >= (ing.netQuantity || 1) : false;
          return {
            ingredientId: ing.ingredient?.toString() || "?",
            qty: ing.netQuantity,
            unit: ing.unit,
            stockBalance: balance?.balance ?? "SEM_SALDO",
            stockOk,
          };
        });

        recipeDetails = {
          recipeId: recipe._id,
          yieldQty: recipe.yieldQuantity,
          yieldUnit: recipe.yieldUnit || "undefined",
          ingredientCount: recipe.ingredients.length,
          allIngredientsInStock: ingredientBreakdown.every((i) => i.stockOk),
          ingredients: ingredientBreakdown,
        };
      }
    }

    // Check direct stock details
    let directStockDetails = null;
    if (classification === CLASSIFICATIONS.APROVADO_PILOTO && rule === "stock_item_direct") {
      if (product.directStockItem) {
        const balance = balances.find(
          (b) => b.ingredient?._id?.toString() === product.directStockItem?.toString()
        );
        directStockDetails = {
          ingredientId: product.directStockItem?.toString() || "?",
          requiredQty: product.directStockQuantity || 1,
          unit: product.directStockUnit || "?",
          stockBalance: balance?.balance ?? "SEM_SALDO",
          stockOk: balance ? balance.balance >= (product.directStockQuantity || 1) : false,
        };
      }
    }

    results.push({
      productId: product._id.toString(),
      name: product.name,
      sellableType: sellable || "undefined",
      stockImpactRule: rule || "undefined",
      price: price || "undefined",
      isActive: product.isActive,
      classification,
      reason,
      recipeDetails,
      directStockDetails,
    });
  }

  // Print summary
  console.log("=".repeat(70));
  console.log("FASE 9.2 — TASK 2: PRODUCT VALIDATION REPORT");
  console.log("=".repeat(70));
  console.log(`Store: ${PILOT_STORE_ID}`);
  console.log(`Total products: ${results.length}`);
  console.log(`  ✅ APROVADO_PILOTO: ${approvedCount}`);
  console.log(`  ❌ BLOQUEAR_PILOTO: ${blockedCount}`);
  console.log(`  ⬜ FORA_DO_ESCOPO: ${outOfScopeCount}`);
  console.log("=".repeat(70));

  // Detail each product
  results.forEach((r) => {
    const icon =
      r.classification === CLASSIFICATIONS.APROVADO_PILOTO
        ? "✅"
        : r.classification === CLASSIFICATIONS.BLOQUEAR_PILOTO
        ? "❌"
        : "⬜";
    console.log(`\n${icon} ${r.name} [${r.classification}]`);
    console.log(`   Rule: ${r.stockImpactRule} | Sellable: ${r.sellableType} | Price: ${r.price} | Active: ${r.isActive}`);
    console.log(`   Reason: ${r.reason}`);

    if (r.recipeDetails) {
      console.log(`   Recipe: ${r.recipeDetails.recipeId} | Yield: ${r.recipeDetails.yieldQty}${r.recipeDetails.yieldUnit}`);
      console.log(`   All ingredients in stock: ${r.recipeDetails.allIngredientsInStock ? "✅ YES" : "❌ NO"}`);
      r.recipeDetails.ingredients.forEach((ing) => {
        console.log(`     - ${ing.ingredientId}: ${ing.qty}${ing.unit} | stock: ${ing.stockBalance} | ${ing.stockOk ? "✅" : "❌"}`);
      });
    }
    if (r.directStockDetails) {
      const d = r.directStockDetails;
      console.log(`   Direct stock: ${d.ingredientId} | need: ${d.requiredQty}${d.unit} | stock: ${d.stockBalance} | ${d.stockOk ? "✅ OK" : "❌ LOW"}`);
    }
  });

  // Exit code
  const exitCode = blockedCount > 0 ? 1 : 0;
  console.log(`\n🏁 Exit code: ${exitCode} ${exitCode === 0 ? "(all products approved)" : "(products blocked — must fix before pilot)"}`);

  await mongoose.disconnect();
  process.exit(exitCode);
}

main().catch((err) => {
  console.error("❌ Script failed:", err.message);
  process.exit(1);
});
