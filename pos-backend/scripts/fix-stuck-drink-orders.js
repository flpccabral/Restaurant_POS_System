/**
 * Fix stuck drink-only orders that were created before the auto-Ready fix.
 *
 * Usage: node scripts/fix-stuck-drink-orders.js [--dry-run]
 *
 * Finds orders where ALL items are drinks (industrialized_resale) and
 * orderStatus is still "In Progress", then advances them:
 *   - paid/closed → "completed"
 *   - unpaid/open  → "Ready"
 */
const mongoose = require('mongoose');
const path = require('path');

// Load env and config
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const config = require('../config/config');

const Product = require('../models/productModel');
const Order = require('../models/orderModel');

const DRY_RUN = process.argv.includes('--dry-run');

async function fixStuckOrders() {
  await mongoose.connect(config.databaseURI);
  console.log(`Connected to database${DRY_RUN ? ' (DRY RUN)' : ''}`);

  // Find all "In Progress" orders
  const stuckOrders = await Order.find({ orderStatus: 'In Progress' }).lean();
  console.log(`Found ${stuckOrders.length} orders with status "In Progress"`);

  if (stuckOrders.length === 0) {
    console.log('Nothing to fix.');
    await mongoose.disconnect();
    return;
  }

  // Collect all product IDs across all orders
  const allProductIds = new Set();
  for (const order of stuckOrders) {
    for (const item of order.items || []) {
      if (item.product) allProductIds.add(item.product.toString());
    }
  }

  // Fetch all products in one query
  const products = await Product.find({
    _id: { $in: [...allProductIds] }
  }).select('sellableType stockImpactRule').lean();

  const productMap = {};
  for (const p of products) {
    productMap[p._id.toString()] = p;
  }

  let fixedCount = 0;
  let skippedCount = 0;

  for (const order of stuckOrders) {
    const itemsWithProduct = (order.items || []).filter(item => item.product);

    // If no items have product refs, skip (can't determine type)
    if (itemsWithProduct.length === 0) {
      console.log(`  SKIP #${order.orderNumber || order._id}: no items with product reference`);
      skippedCount++;
      continue;
    }

    // Check if ALL items are drinks/resale (no kitchen prep needed)
    const allDrinks = itemsWithProduct.every(item => {
      const p = productMap[item.product?.toString()];
      if (!p) return false; // unknown product → assume needs prep, skip
      return p.sellableType === 'industrialized_resale'
        || p.stockImpactRule === 'stock_item_direct';
    });

    if (!allDrinks) {
      console.log(`  SKIP #${order.orderNumber || order._id}: contains food items`);
      skippedCount++;
      continue;
    }

    const isPaid = order.paymentStatus === 'paid' || order.closeStatus === 'closed';
    const newStatus = isPaid ? 'completed' : 'Ready';

    console.log(`  FIX  #${order.orderNumber || order._id}: "In Progress" → "${newStatus}" (${isPaid ? 'paid' : 'unpaid'}, ${itemsWithProduct.length} drink items)`);

    if (!DRY_RUN) {
      await Order.updateOne(
        { _id: order._id },
        { orderStatus: newStatus }
      );
    }
    fixedCount++;
  }

  console.log(`\nDone. Fixed: ${fixedCount}, Skipped: ${skippedCount}${DRY_RUN ? ' (DRY RUN — no changes made)' : ''}`);
  await mongoose.disconnect();
}

fixStuckOrders().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
