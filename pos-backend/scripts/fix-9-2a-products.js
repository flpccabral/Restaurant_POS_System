/**
 * Fase 9.2A — Fix Script: Products (T1 prices, T2 Hamburgue, T5 Taxa merge)
 *
 * Actions:
 *   T1: Set prices for all active pilot products
 *   T2: Deactivate "Hamburgue" (no recipe, Bacon zero stock)
 *   T5: Consolidate Taxa duplicates — keep "Taxa de Serviço", deactivate "Taxa de Servico"
 *
 * Also deactivates "Refrigerante Teste" (duplicate of "Refrigerante")
 *
 * Usage: node scripts/fix-9-2a-products.js [--dry-run]
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const PILOT_STORE_ID = "6a1101372ff5c713c1b1a147";

const DRY_RUN = process.argv.includes("--dry-run");

// T1: Price map for products that should remain active
const PRICE_MAP = {
  "6a123a2b0824a97594d48d7a": { name: "Hambúrguer Artesanal", price: 29.90 },
  "6a123a2b0824a97594d48d7d": { name: "Pizza Margherita", price: 39.90 },
  "6a123a2b0824a97594d48d80": { name: "Refrigerante", price: 8.00 },
  "6a1343008c9807db6028fe65": { name: "Taxa de Serviço", price: 3.00 },
};

// T2 + T5: Products to deactivate
const DEACTIVATE_IDS = [
  { id: "6a11b68f515e85eb24eaf426", name: "Hamburgue", reason: "T2: sem receita ativa, ingrediente Bacon sem saldo — Opção A" },
  { id: "6a132b0d21b39baba982ac7b", name: "Taxa de Servico", reason: "T5: duplicata sem acento — consolidado em Taxa de Serviço" },
  { id: "6a11e625f646322a50b7467d", name: "Refrigerante Teste", reason: "Duplicata de teste — substituído por Refrigerante" },
];

async function main() {
  console.log("=".repeat(70));
  console.log(`FASE 9.2A — FIX PRODUCTS (T1 + T2 + T5)${DRY_RUN ? " [DRY RUN]" : ""}`);
  console.log("=".repeat(70));

  await mongoose.connect(process.env.MONGODB_URI);
  require("../models/productModel");
  const Product = mongoose.model("Product");

  let allOk = true;

  // ====== T1: Set prices ======
  console.log("\n📋 T1: CONFIGURING PRODUCT PRICES");
  for (const [productId, config] of Object.entries(PRICE_MAP)) {
    const product = await Product.findById(productId).lean();
    if (!product) {
      console.log(`  ❌ Product ${config.name} (${productId}) not found`);
      allOk = false;
      continue;
    }

    const oldPrice = product.price != null ? `R$${Number(product.price).toFixed(2)}` : "UNDEFINED";
    const newPrice = `R$${config.price.toFixed(2)}`;

    if (!DRY_RUN) {
      await Product.updateOne({ _id: productId }, { price: config.price });
    }

    console.log(`  ✅ ${config.name}: ${oldPrice} → ${newPrice}${DRY_RUN ? " [DRY]" : ""}`);
  }

  // ====== T2 + T5: Deactivate products ======
  console.log("\n📋 T2 + T5: DEACTIVATING PROBLEMATIC PRODUCTS");
  for (const item of DEACTIVATE_IDS) {
    const product = await Product.findById(item.id).lean();
    if (!product) {
      console.log(`  ⚠️ ${item.name} (${item.id}) — already removed`);
      continue;
    }
    if (product.isActive === false) {
      console.log(`  ℹ️ ${item.name} — already inactive`);
      continue;
    }

    if (!DRY_RUN) {
      await Product.updateOne({ _id: item.id }, { isActive: false });
    }
    console.log(`  ✅ ${item.name}: isActive=true → false | ${item.reason}${DRY_RUN ? " [DRY]" : ""}`);
  }

  // ====== Verify final state ======
  console.log("\n📋 VERIFICATION: FINAL PRODUCT STATE");
  const allProducts = await Product.find({ store: PILOT_STORE_ID }).lean();
  const active = allProducts.filter(p => p.isActive !== false);
  const inactive = allProducts.filter(p => p.isActive === false);

  console.log(`  Active products: ${active.length}`);
  for (const p of active) {
    const priceOk = p.price != null && p.price > 0;
    console.log(`  ${priceOk ? "✅" : "⚠️"} ${p.name} | price=R$${p.price ?? "UNDEFINED"} | rule=${p.stockImpactRule}`);
    if (!priceOk) allOk = false;
  }

  console.log(`\n  Inactive/removed: ${inactive.length}`);
  for (const p of inactive) {
    console.log(`  🚫 ${p.name} | price=${p.price} | rule=${p.stockImpactRule}`);
  }

  // Check: no duplicates in active
  const activeNames = active.map(p => p.name.toLowerCase());
  const dupes = activeNames.filter((n, i) => activeNames.indexOf(n) !== i);
  if (dupes.length) {
    console.log(`\n  ⚠️ DUPLICATE NAMES IN ACTIVE: ${[...new Set(dupes)].join(", ")}`);
    allOk = false;
  } else {
    console.log(`\n  ✅ No duplicate names in active products`);
  }

  // Check: exactly one Taxa
  const activeTaxa = active.filter(p => p.name && p.name.toLowerCase().includes("taxa"));
  if (activeTaxa.length === 1) {
    console.log(`  ✅ Single Taxa de Serviço: ${activeTaxa[0].name} (${activeTaxa[0]._id})`);
  } else {
    console.log(`  ⚠️ ${activeTaxa.length} Taxa products active (expected 1)`);
    allOk = false;
  }

  console.log("\n" + "=".repeat(70));
  console.log(`🏁 T1+T2+T5: ${allOk ? "ALL OK" : "ISSUES FOUND"}${DRY_RUN ? " [DRY RUN — no changes applied]" : ""}`);

  await mongoose.disconnect();
  process.exit(allOk ? 0 : 1);
}

main().catch(err => {
  console.error("❌ Fix script failed:", err.message);
  process.exit(1);
});
