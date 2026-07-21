/**
 * Fase 9.2A — Fix Script: Alerts (T3)
 *
 * Resolves or archives 10 historical alerts for the pilot store.
 * Rules:
 *   - sale_without_stock_deduction: dismiss as "historical test artifact"
 *   - stockout: check if ingredient now has stock > 0 → resolve, else keep
 *   - low_stock: check if stock above threshold → resolve, else keep
 *   - product_without_recipe: check if product now has recipe → resolve, else keep
 *
 * Usage: node scripts/fix-9-2a-alerts.js [--dry-run]
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const PILOT_STORE_ID = "6a1101372ff5c713c1b1a147";
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log("=".repeat(70));
  console.log(`FASE 9.2A — FIX ALERTS (T3)${DRY_RUN ? " [DRY RUN]" : ""}`);
  console.log("=".repeat(70));

  await mongoose.connect(process.env.MONGODB_URI);
  require("../models/operationalAlertModel");
  require("../models/stockBalanceModel");
  require("../models/stockLocationModel");
  require("../models/globalIngredientModel");
  require("../models/productModel");
  require("../models/recipeModel");

  const OperationalAlert = mongoose.model("OperationalAlert");
  const StockBalance = mongoose.model("StockBalance");
  const StockLocation = mongoose.model("StockLocation");
  const Product = mongoose.model("Product");
  const Recipe = mongoose.model("Recipe");

  const location = await StockLocation.findOne({ store: PILOT_STORE_ID, isActive: true });

  const alerts = await OperationalAlert.find({ store: PILOT_STORE_ID }).sort({ createdAt: -1 }).lean();
  console.log(`\n  Total alerts: ${alerts.length}\n`);

  const results = [];
  const actions = { resolved: 0, dismissed: 0, kept: 0 };

  for (const alert of alerts) {
    const alertDoc = await OperationalAlert.findById(alert._id);
    const age = Math.floor((Date.now() - new Date(alert.createdAt).getTime()) / 86400000);
    let action = "keep";
    let reason = "";

    switch (alert.type) {
      case "sale_without_stock_deduction":
        // Dismiss all as historical test artifacts
        action = "dismiss";
        reason = "Artefato de teste — pedido histórico sem estoque";
        break;

      case "stockout":
        // Check if ingredient now has stock
        if (alert.metadata?.ingredientId && location) {
          const sb = await StockBalance.findOne({ location: location._id, ingredient: alert.metadata.ingredientId }).lean();
          if (sb && sb.balance > 0) {
            action = "resolve";
            reason = `Ingrediente reabastecido — saldo atual: ${sb.balance}`;
          } else {
            action = "keep";
            reason = "Ingrediente ainda sem saldo — alerta válido";
          }
        } else {
          action = "dismiss";
          reason = "Sem referência de ingrediente — artefato antigo";
        }
        break;

      case "low_stock":
        // Check stock level
        if (alert.metadata?.ingredientId && location) {
          const sb = await StockBalance.findOne({ location: location._id, ingredient: alert.metadata.ingredientId }).lean();
          if (sb && sb.balance > 5) {
            action = "resolve";
            reason = `Estoque recuperado — saldo atual: ${sb.balance}`;
          } else {
            action = "keep";
            reason = `Estoque ainda baixo (${sb?.balance ?? "?"}) — alerta válido`;
          }
        } else {
          action = "dismiss";
          reason = "Sem referência — artefato antigo";
        }
        break;

      case "product_without_recipe":
        // Check if product now has a recipe
        if (alert.metadata?.productId) {
          const product = await Product.findById(alert.metadata.productId).lean();
          if (product && product.recipe) {
            const recipe = await Recipe.findById(product.recipe).lean();
            if (recipe && recipe.isActive !== false) {
              action = "resolve";
              reason = `Produto agora tem receita ativa: ${recipe.name}`;
            } else {
              action = "keep";
              reason = "Receita inativa ou removida";
            }
          } else if (product && product.isActive === false) {
            action = "dismiss";
            reason = "Produto desativado — alerta não se aplica mais";
          } else {
            action = "keep";
            reason = "Produto ainda sem receita";
          }
        } else {
          action = "dismiss";
          reason = "Sem referência de produto";
        }
        break;

      default:
        action = "keep";
        reason = "Tipo desconhecido — mantido para revisão manual";
    }

    if (!DRY_RUN) {
      if (action === "resolve") {
        await alertDoc.resolve(null);
        actions.resolved++;
      } else if (action === "dismiss") {
        await alertDoc.dismiss(null);
        actions.dismissed++;
      } else {
        actions.kept++;
      }
    } else {
      if (action === "resolve") actions.resolved++;
      else if (action === "dismiss") actions.dismissed++;
      else actions.kept++;
    }

    const statusLabel = alert.status === "new" ? "new" : alert.status;
    console.log(`  [${statusLabel}→${action}] ${alert.type} [${alert.severity}] — ${alert.message?.substring(0, 80)}`);
    console.log(`           ${reason}${DRY_RUN ? " [DRY]" : ""}`);

    results.push({
      alertId: alert._id,
      type: alert.type,
      severity: alert.severity,
      createdAt: alert.createdAt,
      previousStatus: alert.status,
      action,
      reason,
    });
  }

  // Summary
  console.log("\n" + "-".repeat(70));
  console.log("SUMMARY:");
  console.log(`  Resolved: ${actions.resolved}`);
  console.log(`  Dismissed: ${actions.dismissed}`);
  console.log(`  Kept active: ${actions.kept}`);
  console.log(`  Total: ${alerts.length}`);

  // Verify: no "new" alerts should remain unless intentionally kept
  if (!DRY_RUN) {
    const remainingNew = await OperationalAlert.countDocuments({ store: PILOT_STORE_ID, status: "new" });
    console.log(`\n  Alerts still 'new' after fix: ${remainingNew}`);
    if (remainingNew > 0) {
      const remaining = await OperationalAlert.find({ store: PILOT_STORE_ID, status: "new" }).lean();
      remaining.forEach(a => console.log(`    - ${a.type}: ${a.message?.substring(0, 80)}`));
    }
  }

  // Print results array for report
  console.log("\n" + JSON.stringify(results, null, 2));

  console.log("\n" + "=".repeat(70));
  console.log(`🏁 T3: ${DRY_RUN ? "DRY RUN COMPLETE" : "ALERTS PROCESSED"}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Fix script failed:", err.message);
  process.exit(1);
});
