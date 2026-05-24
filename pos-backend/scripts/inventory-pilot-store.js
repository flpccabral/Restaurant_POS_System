/**
 * Inventory script for the Phase 9 pilot store.
 *
 * Generates a complete inventory report for:
 *   Loja Demo - Matriz (storeId: 6a1101372ff5c713c1b1a147)
 *
 * Usage: node scripts/inventory-pilot-store.js
 * Output: prints JSON report to stdout
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const config = require('../config/config');

const Store = require('../models/storeModel');
const User = require('../models/userModel');
const Role = require('../models/roleModel');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const Recipe = require('../models/recipeModel');
const GlobalIngredient = require('../models/globalIngredientModel');
const StockBalance = require('../models/stockBalanceModel');
const StockPolicy = require('../models/stockPolicyModel');
const StockLocation = require('../models/stockLocationModel');
const StockAlert = require('../models/stockAlertModel');
const StockMovement = require('../models/stockMovementModel');
const OperationalAlert = require('../models/operationalAlertModel');
const Device = require('../models/deviceModel');
const Order = require('../models/orderModel');

const PILOT_STORE_ID = '6a1101372ff5c713c1b1a147';

async function inventory() {
  await mongoose.connect(config.databaseURI);
  console.error('Connected to DB, gathering data...');

  const store = await Store.findOne({ _id: PILOT_STORE_ID }).lean();
  if (!store) {
    console.error(`Store ${PILOT_STORE_ID} not found!`);
    process.exit(1);
  }

  // --- Products ---
  const products = await Product.find({ store: PILOT_STORE_ID }).lean();
  const activeProducts = products.filter(p => p.isActive !== false);
  const productsWithoutRecipe = activeProducts.filter(p => !p.hasActiveRecipe);

  // --- Categories ---
  const categories = await Category.find({ store: PILOT_STORE_ID }).lean();

  // --- Recipes ---
  const recipes = await Recipe.find({ store: PILOT_STORE_ID }).lean();
  const activeRecipes = recipes.filter(r => r.isActive !== false);

  // --- Recipe details with ingredient validation ---
  const recipeDetails = activeRecipes.map(r => ({
    _id: r._id,
    name: r.name,
    product: r.product,
    variation: r.variation,
    yieldQuantity: r.yieldQuantity,
    yieldUnit: r.yieldUnit,
    ingredientCount: r.ingredients?.length || 0,
    ingredients: (r.ingredients || []).map(ing => ({
      ingredient: ing.ingredient,
      netQuantity: ing.netQuantity,
      lossFactor: ing.lossFactor,
      unit: ing.unit,
    })),
  }));

  // --- Global Ingredients ---
  const ingredients = await GlobalIngredient.find({}).lean();
  const ingredientMap = new Map(ingredients.map(i => [i._id.toString(), i]));

  // Check which recipe ingredients exist and have costs
  const recipeIngredientsStatus = activeRecipes.map(r => {
    const ingItems = (r.ingredients || []).map(ing => {
      const gIng = ingredientMap.get(ing.ingredient?.toString());
      return {
        ingredientId: ing.ingredient,
        ingredientName: gIng?.name || 'NOT FOUND',
        netQuantity: ing.netQuantity,
        unit: ing.unit,
        lossFactor: ing.lossFactor,
        hasCost: !!gIng?.averageCost,
        cost: gIng?.averageCost,
        exists: !!gIng,
      };
    });
    return { recipeId: r._id, recipeName: r.name, product: r.product, ingredients: ingItems };
  });

  // --- Stock Balances ---
  const balances = await StockBalance.find({ store: PILOT_STORE_ID })
    .populate('ingredient')
    .populate('location')
    .lean();

  // --- Stock Policies ---
  const policies = await StockPolicy.find({ store: PILOT_STORE_ID })
    .populate('ingredient')
    .populate('location')
    .lean();

  // --- Stock Locations ---
  const locations = await StockLocation.find({ store: PILOT_STORE_ID }).lean();

  // --- Stock Alerts ---
  const stockAlerts = await StockAlert.find({ store: PILOT_STORE_ID })
    .populate('ingredient')
    .lean();

  // --- Operational Alerts ---
  const opAlerts = await OperationalAlert.find({ store: PILOT_STORE_ID }).lean();

  // --- Stock Movements (recent 50) ---
  const movements = await StockMovement.find({ store: PILOT_STORE_ID })
    .sort({ createdAt: -1 }).limit(50)
    .populate('ingredient')
    .lean();

  // --- Users ---
  const users = await User.find({
    $or: [
      { store: PILOT_STORE_ID },
      { isMasterAdmin: true },
    ]
  }).populate('role').populate('store').lean();

  // --- Devices ---
  const devices = await Device.find({ store: PILOT_STORE_ID }).lean();

  // --- Orders (recent 20) ---
  const orders = await Order.find({ store: PILOT_STORE_ID })
    .sort({ createdAt: -1 }).limit(20).lean();

  // --- Products without cost (revenda/pronto) check ---
  const productsMissingCost = activeProducts.filter(p => {
    const productRecipe = activeRecipes.find(r =>
      r.product?.toString() === p._id.toString()
    );
    return !productRecipe;
  });

  // --- Health check for recipe ingredients ---
  const ingredientHealth = balances.map(b => {
    const ing = b.ingredient;
    const policy = policies.find(pl =>
      pl.ingredient?._id?.toString() === b.ingredient?._id?.toString() &&
      pl.location?._id?.toString() === b.location?._id?.toString()
    );
    return {
      ingredient: ing?.name || b.ingredient,
      location: b.location?.name || b.location,
      currentQuantity: b.quantity,
      unit: b.unit,
      minQuantity: policy?.minQuantity ?? null,
      reorderPoint: policy?.reorderPoint ?? null,
      idealQuantity: policy?.idealQuantity ?? null,
      maxQuantity: policy?.maxQuantity ?? null,
      policyActive: policy?.isActive ?? null,
      status: policy
        ? (b.quantity <= policy.minQuantity ? 'CRITICAL'
          : b.quantity <= policy.reorderPoint ? 'LOW'
          : b.quantity >= policy.maxQuantity ? 'OVERSTOCK'
          : 'HEALTHY')
        : 'NO_POLICY',
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    store: {
      _id: store._id,
      name: store.name,
      cnpj: store.cnpj,
      email: store.email,
      phone: store.phone,
      operationType: store.operationType,
      isActive: store.isActive,
    },
    summary: {
      activeProducts: activeProducts.length,
      productsWithoutRecipe: productsWithoutRecipe.length,
      activeRecipes: activeRecipes.length,
      totalIngredients: ingredients.length,
      ingredientsWithBalance: balances.length,
      stockPolicies: policies.length,
      stockLocations: locations.length,
      stockAlerts: stockAlerts.length,
      operationalAlerts: opAlerts.length,
      recentMovements: movements.length,
      users: users.length,
      devices: devices.length,
      recentOrders: orders.length,
    },
    products: {
      active: activeProducts.map(p => ({
        _id: p._id, name: p.name, price: p.price,
        category: p.category, hasActiveRecipe: p.hasActiveRecipe,
        variationCount: p.variations?.length || 0,
        isActive: p.isActive,
      })),
      withoutRecipe: productsWithoutRecipe.map(p => ({
        _id: p._id, name: p.name, price: p.price,
      })),
    },
    categories: categories.map(c => ({ _id: c._id, name: c.name })),
    recipes: recipeDetails,
    recipeIngredientValidation: recipeIngredientsStatus,
    ingredients: ingredients.map(i => ({
      _id: i._id, name: i.name, category: i.category,
      baseUnit: i.baseUnit, averageCost: i.averageCost,
      itemType: i.itemType,
    })),
    stockBalances: ingredientHealth,
    stockPolicies: policies.map(p => ({
      _id: p._id,
      ingredient: p.ingredient?.name || p.ingredient,
      location: p.location?.name || p.location,
      minQuantity: p.minQuantity,
      reorderPoint: p.reorderPoint,
      idealQuantity: p.idealQuantity,
      maxQuantity: p.maxQuantity,
      unit: p.unit,
      priority: p.priority,
      isActive: p.isActive,
    })),
    stockLocations: locations.map(l => ({
      _id: l._id, name: l.name, type: l.type,
    })),
    stockAlerts: stockAlerts.map(a => ({
      _id: a._id, type: a.type, severity: a.severity,
      ingredient: a.ingredient?.name || a.ingredient,
      message: a.message, isResolved: a.isResolved,
    })),
    operationalAlerts: opAlerts.map(a => ({
      _id: a._id, type: a.type, severity: a.severity,
      title: a.title, message: a.message,
      isAcknowledged: a.isAcknowledged,
    })),
    users: users.map(u => ({
      _id: u._id, name: u.name, email: u.email,
      role: u.role?.name || u.role,
      store: u.store?.name || u.store,
      isMasterAdmin: u.isMasterAdmin,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
    })),
    devices: devices.map(d => ({
      _id: d._id, deviceName: d.deviceName,
      status: d.status, lastLoginAt: d.lastLoginAt,
    })),
    recentOrders: orders.map(o => ({
      _id: o._id, orderNumber: o.orderNumber,
      status: o.status, total: o.total,
      itemCount: o.items?.length || 0,
      createdAt: o.createdAt,
    })),
  };

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  process.exit(0);
}

inventory().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
