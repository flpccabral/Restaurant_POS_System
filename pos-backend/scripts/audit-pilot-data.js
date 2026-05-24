/**
 * Audit script for artificial data — Phase 9.
 *
 * Classifies data containing known test/seed patterns without deleting anything.
 *
 * Usage: node scripts/audit-pilot-data.js --dry-run
 * Output: JSON report of flagged data grouped by category
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const config = require('../config/config');

// Models to audit
const Store = require('../models/storeModel');
const Product = require('../models/productModel');
const Recipe = require('../models/recipeModel');
const GlobalIngredient = require('../models/globalIngredientModel');
const User = require('../models/userModel');
const StockPolicy = require('../models/stockPolicyModel');
const StockBalance = require('../models/stockBalanceModel');
const OperationalAlert = require('../models/operationalAlertModel');
const Order = require('../models/orderModel');

const PATTERNS = [
  'PHASE7B', 'PHASE6', 'PHASE5', 'PHASE8',
  'Teste', 'Test', 'test', 'TEST',
  'Demo',
  'Seed',
  'PILOT_',
  'Regression',
  'PHASE7',
];

function matchesPattern(name) {
  if (!name || typeof name !== 'string') return false;
  return PATTERNS.some(p => name.includes(p));
}

async function audit() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.error('🔍 DRY-RUN MODE — listing only, no changes');

  await mongoose.connect(config.databaseURI);
  console.error('Connected to DB, auditing...\n');

  const results = {
    scannedAt: new Date().toISOString(),
    mode: dryRun ? 'dry-run' : 'live',
    patterns: PATTERNS,
    flagged: {},
    summary: {},
  };

  // --- Stores ---
  const stores = await Store.find({}).lean();
  const flaggedStores = stores.filter(s => matchesPattern(s.name));
  results.flagged.stores = flaggedStores.map(s => ({
    _id: s._id, name: s.name,
    classification: s.name.startsWith('PILOT_') ? 'Manter para piloto'
      : s.name.includes('PHASE7B') ? 'Isolar como massa de teste'
      : 'Revisar manualmente',
  }));

  // --- Products ---
  const products = await Product.find({}).populate('store').lean();
  const flaggedProducts = products.filter(p =>
    matchesPattern(p.name) ||
    (p.store && matchesPattern(p.store.name))
  );
  results.flagged.products = flaggedProducts.map(p => ({
    _id: p._id, name: p.name, store: p.store?.name || p.store,
    classification: p.name.includes('PHASE7B') || p.name.includes('Teste')
      || p.name.includes('Regress') ? 'Remover depois'
      : p.store?.name?.startsWith('PILOT_') ? 'Manter para piloto'
      : 'Revisar manualmente',
  }));

  // --- Recipes ---
  const recipes = await Recipe.find({}).populate('store').lean();
  const flaggedRecipes = recipes.filter(r =>
    matchesPattern(r.name) ||
    (r.store && matchesPattern(r.store.name))
  );
  results.flagged.recipes = flaggedRecipes.map(r => ({
    _id: r._id, name: r.name, store: r.store?.name || r.store,
    classification: r.name.includes('PHASE7B') || r.name.includes('Teste') ? 'Remover depois'
      : r.store?.name?.startsWith('PILOT_') ? 'Manter para piloto'
      : 'Revisar manualmente',
  }));

  // --- Ingredients ---
  const ingredients = await GlobalIngredient.find({}).lean();
  const flaggedIngredients = ingredients.filter(i => matchesPattern(i.name));
  results.flagged.ingredients = flaggedIngredients.map(i => ({
    _id: i._id, name: i.name,
    classification: i.name.includes('PHASE7B') ? 'Isolar como massa de teste'
      : i.name.includes('Teste') ? 'Remover depois'
      : 'Revisar manualmente',
  }));

  // --- Users ---
  const users = await User.find({}).populate('store').lean();
  const flaggedUsers = users.filter(u =>
    matchesPattern(u.name) ||
    matchesPattern(u.email) ||
    (u.store && matchesPattern(u.store.name))
  );
  results.flagged.users = flaggedUsers.map(u => ({
    _id: u._id, name: u.name, email: u.email,
    store: u.store?.name || u.store,
    classification: u.email?.includes('test') || u.email?.includes('phase')
      ? 'Isolar como massa de teste'
      : u.store?.name?.startsWith('PILOT_') ? 'Manter para piloto'
      : 'Revisar manualmente',
  }));

  // --- Stock Policies (flag PILOT_/Test/Demo referenced store/ingredient) ---
  const policies = await StockPolicy.find({})
    .populate('store')
    .populate('ingredient')
    .lean();
  const flaggedPolicies = policies.filter(p => {
    const storeName = p.store?.name || '';
    const ingName = p.ingredient?.name || '';
    return matchesPattern(storeName) || matchesPattern(ingName);
  });
  results.flagged.stockPolicies = flaggedPolicies.map(p => ({
    _id: p._id, store: p.store?.name, ingredient: p.ingredient?.name,
    classification: 'Isolar como massa de teste',
  }));

  // --- Operational Alerts (flag test/demo content) ---
  const alerts = await OperationalAlert.find({}).populate('store').lean();
  const flaggedAlerts = alerts.filter(a =>
    matchesPattern(a.title) ||
    matchesPattern(a.message) ||
    (a.store && matchesPattern(a.store.name))
  );
  results.flagged.operationalAlerts = flaggedAlerts.map(a => ({
    _id: a._id, title: a.title, message: a.message?.substring(0, 100),
    store: a.store?.name,
    classification: 'Revisar manualmente',
  }));

  // --- Orders (recent test orders) ---
  const orders = await Order.find({
    $or: [
      { store: { $exists: true } },
      { 'items.productName': { $regex: /PHASE|Teste|Test|Demo/i } },
    ]
  }).sort({ createdAt: -1 }).limit(50).populate('store').lean();

  const flaggedOrders = orders.filter(o =>
    matchesPattern(o.orderNumber) ||
    (o.store && matchesPattern(o.store.name))
  );
  results.flagged.orders = flaggedOrders.map(o => ({
    _id: o._id, orderNumber: o.orderNumber,
    store: o.store?.name, status: o.status,
    classification: 'Revisar manualmente',
  }));

  // --- Summary ---
  for (const [key, arr] of Object.entries(results.flagged)) {
    results.summary[key] = {
      flagged: arr.length,
      byClassification: {},
    };
    for (const item of arr) {
      const cls = item.classification;
      results.summary[key].byClassification[cls] =
        (results.summary[key].byClassification[cls] || 0) + 1;
    }
  }

  // Summary counts for total items scanned
  results.summary.totals = {
    stores: stores.length,
    products: products.length,
    recipes: recipes.length,
    ingredients: ingredients.length,
    users: users.length,
    stockPolicies: policies.length,
    operationalAlerts: alerts.length,
    ordersScanned: orders.length,
  };

  console.log(JSON.stringify(results, null, 2));
  await mongoose.disconnect();
  process.exit(0);
}

audit().catch(err => { console.error('Error:', err); process.exit(1); });
