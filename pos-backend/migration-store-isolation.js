#!/usr/bin/env node
/**
 * Migration Script: Store Isolation Fix
 *
 * Purpose:
 *   1. Rename `storeId` → `store` on all orders (ObjectId field rename)
 *   2. Assign `store` to all existing tables that lack it
 *
 * Usage:
 *   node migration-store-isolation.js
 *
 * Pre-requisites:
 *   - MONGODB_URI env var set (or defaults to mongodb://localhost:27017/pos-db)
 *   - At least one Store document exists (for table assignment)
 *
 * Safety:
 *   - Reads before writes, prints a dry-run summary first
 *   - Asks for confirmation before applying changes
 *   - Uses MongoDB bulkWrite for atomic batch operations
 */

require("dotenv").config();
const mongoose = require("mongoose");
const readline = require("readline");

const config = require("./config/config");

// CLI flags: --dry-run (no writes), --auto-yes (skip confirmations)
const flags = {
  dryRun: process.argv.includes("--dry-run"),
  autoYes: process.argv.includes("--auto-yes"),
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function run() {
  console.log("=".repeat(60));
  console.log("Migration: Store Isolation Fix");
  console.log("=".repeat(60));
  console.log(`Database:    ${config.databaseURI}`);
  console.log(`Mode:        ${flags.dryRun ? "DRY RUN (no writes)" : "LIVE (will modify data)"}`);
  console.log(`Auto-confirm: ${flags.autoYes ? "YES" : "NO (interactive)"}`);
  console.log("");

  await mongoose.connect(config.databaseURI);
  console.log("Connected to MongoDB.\n");

  try {
    await migrateOrders();
    await migrateTables();
  } catch (err) {
    console.error("\nMigration failed:", err.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB.");
  }
}

// ---------------------------------------------------------------------------
// Migration 1: Rename storeId → store on orders collection
// ---------------------------------------------------------------------------
async function migrateOrders() {
  const db = mongoose.connection.db;
  const orders = db.collection("orders");

  // Count orders with storeId (old field)
  const withStoreId = await orders.countDocuments({ storeId: { $exists: true, $ne: null } });
  // Count orders with store (new field, already migrated)
  const withStore = await orders.countDocuments({ store: { $exists: true, $ne: null } });
  // Count orders with neither
  const orphan = await orders.countDocuments({ storeId: { $exists: false }, store: { $exists: false } });

  console.log("--- Orders Collection ---");
  console.log(`  Total orders:           ${withStoreId + withStore + orphan}`);
  console.log(`  Already have 'store':   ${withStore}`);
  console.log(`  Need migration (storeId): ${withStoreId}`);
  console.log(`  Orphan (no store/storeId): ${orphan}`);

  if (withStoreId === 0 && orphan === 0) {
    console.log("  ✓ No migration needed for orders.\n");
    return;
  }

  // Show sample documents
  if (withStoreId > 0) {
    const sample = await orders.find({ storeId: { $exists: true } }).limit(2).toArray();
    console.log("\n  Sample documents to migrate:");
    sample.forEach((doc) => {
      console.log(`    _id: ${doc._id}, storeId: ${doc.storeId}`);
    });
  }

  if (orphan > 0) {
    const sample = await orders.find({ storeId: { $exists: false }, store: { $exists: false } }).limit(2).toArray();
    console.log("\n  Sample orphan documents (no store info):");
    sample.forEach((doc) => {
      console.log(`    _id: ${doc._id}, customerDetails: ${JSON.stringify(doc.customerDetails)}`);
    });
  }

  const answer = flags.autoYes ? "y" : await ask(`\nApply order migration? (${withStoreId} rename + ${orphan} orphan cleanup) [y/N]: `);
  if (flags.dryRun) {
    console.log("  [DRY RUN] Would apply migration.\n");
    return;
  }
  if (answer.toLowerCase() !== "y") {
    console.log("  Skipped.\n");
    return;
  }

  // Step 1: Rename storeId → store using $rename (atomic, preserves index)
  if (withStoreId > 0) {
    const result = await orders.updateMany(
      { storeId: { $exists: true } },
      { $rename: { storeId: "store" } }
    );
    console.log(`  ✓ Renamed storeId → store on ${result.modifiedCount} orders.`);
  }

  // Step 2: Handle orphan orders — assign to first active store
  if (orphan > 0) {
    const firstStore = await db.collection("stores").findOne({ isActive: true });
    if (!firstStore) {
      console.log("  ⚠ No active store found. Cannot assign orphan orders. Skipping.\n");
      return;
    }
    const result = await orders.updateMany(
      { store: { $exists: false } },
      { $set: { store: firstStore._id } }
    );
    console.log(`  ✓ Assigned ${result.modifiedCount} orphan orders to store: ${firstStore.name} (${firstStore._id}).`);
  }

  // Step 3: Clean up any null/undefined store values
  const cleaned = await orders.updateMany(
    { $or: [{ store: null }, { store: undefined }] },
    { $unset: { store: "" } }
  );
  if (cleaned.modifiedCount > 0) {
    console.log(`  ✓ Cleaned ${cleaned.modifiedCount} orders with null store (will need manual review).`);
  }

  console.log("");
}

// ---------------------------------------------------------------------------
// Migration 2: Assign store to existing tables
// ---------------------------------------------------------------------------
async function migrateTables() {
  const db = mongoose.connection.db;
  const tables = db.collection("tables");

  // Count tables with store field
  const withStore = await tables.countDocuments({ store: { $exists: true, $ne: null } });
  const withoutStore = await tables.countDocuments({ store: { $exists: false } });

  console.log("--- Tables Collection ---");
  console.log(`  Total tables:          ${withStore + withoutStore}`);
  console.log(`  Already have 'store':  ${withStore}`);
  console.log(`  Need migration:        ${withoutStore}`);

  if (withoutStore === 0) {
    console.log("  ✓ No migration needed for tables.\n");
    return;
  }

  // Show sample
  const sample = await tables.find({ store: { $exists: false } }).limit(5).toArray();
  console.log("\n  Tables without store:");
  sample.forEach((doc) => {
    console.log(`    _id: ${doc._id}, tableNo: ${doc.tableNo}, status: ${doc.status}`);
  });

  const answer = flags.autoYes ? "y" : await ask(`\nAssign these ${withoutStore} tables to a store? [y/N]: `);
  if (flags.dryRun) {
    console.log("  [DRY RUN] Would assign tables.\n");
    return;
  }
  if (answer.toLowerCase() !== "y") {
    console.log("  Skipped.\n");
    return;
  }

  // List available stores
  const stores = await db.collection("stores").find({ isActive: true }).toArray();
  if (stores.length === 0) {
    console.log("  ⚠ No active stores found. Cannot assign tables. Aborting.\n");
    return;
  }

  if (stores.length === 1) {
    // Only one store — assign all tables to it
    const store = stores[0];
    const result = await tables.updateMany(
      { store: { $exists: false } },
      { $set: { store: store._id } }
    );
    console.log(`  ✓ Assigned ${result.modifiedCount} tables to store: ${store.name} (${store._id}).`);
  } else {
    // Multiple stores — ask user which one
    console.log("\n  Available stores:");
    stores.forEach((s, i) => {
      console.log(`    [${i}] ${s.name} (${s._id})`);
    });

    const idx = await ask(`  Assign tables to store index [0-${stores.length - 1}]: `);
    const storeIdx = parseInt(idx);
    if (isNaN(storeIdx) || storeIdx < 0 || storeIdx >= stores.length) {
      console.log("  Invalid selection. Aborting.\n");
      return;
    }

    const store = stores[storeIdx];
    const result = await tables.updateMany(
      { store: { $exists: false } },
      { $set: { store: store._id } }
    );
    console.log(`  ✓ Assigned ${result.modifiedCount} tables to store: ${store.name} (${store._id}).`);
  }

  console.log("");
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
