/**
 * Phase 9.3D — Normalize all existing orderStatus values to the new enum.
 *
 * Usage: node scripts/normalize-order-statuses.js [--dry-run]
 *
 * Maps legacy statuses to the standardized enum:
 *   'In Progress', 'Preparing', 'Ready', 'completed', 'cancelled'
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const config = require('../config/config');

const STATUS_MAP = {
  // Standard values (keep)
  'In Progress': 'In Progress',
  'Preparing': 'Preparing',
  'Ready': 'Ready',
  'completed': 'completed',
  'cancelled': 'cancelled',
  // Legacy → standard
  'Completed': 'completed',
  'Cancelled': 'cancelled',
  'pending': 'In Progress',
  'preparing': 'In Progress',
  'accepted': 'In Progress',
  'paid': 'completed',
  'done': 'Ready',
};

const DRY_RUN = process.argv.includes('--dry-run');

async function normalize() {
  await mongoose.connect(config.databaseURI);
  console.log(`Connected${DRY_RUN ? ' (DRY RUN)' : ''}`);

  const Order = require('../models/orderModel');
  const allOrders = await Order.find({}).lean();
  console.log(`Found ${allOrders.length} total orders`);

  const migrations = [];

  for (const order of allOrders) {
    const current = order.orderStatus;
    const normalized = STATUS_MAP[current];

    if (!normalized) {
      console.log(`  UNKNOWN STATUS: #${order._id} orderStatus="${current}" — skipping`);
      continue;
    }

    if (current === normalized) {
      continue; // already correct
    }

    migrations.push({ id: order._id, from: current, to: normalized });
  }

  console.log(`Found ${migrations.length} orders to migrate:`);
  for (const m of migrations) {
    console.log(`  #${m.id}: "${m.from}" → "${m.to}"`);
  }

  if (!DRY_RUN && migrations.length > 0) {
    const bulkOps = migrations.map(m => ({
      updateOne: {
        filter: { _id: m.id },
        update: { orderStatus: m.to }
      }
    }));
    await Order.bulkWrite(bulkOps);
    console.log(`\nMigration complete: ${migrations.length} orders updated.`);
  } else if (migrations.length === 0) {
    console.log('All orders already have valid statuses.');
  } else {
    console.log('\n(DRY RUN — no changes made)');
  }

  await mongoose.disconnect();
}

normalize().catch(err => { console.error('Fatal:', err); process.exit(1); });
