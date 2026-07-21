/**
 * One-time fix: Unstick tables that are permanently "Booked" with no active orders.
 *
 * Root cause: The backend never releases tables when orders complete or cancel.
 * This script resets tables that have no active (non-completed, non-cancelled) orders.
 *
 * Usage: node scripts/fix-stuck-tables.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const PILOT_STORE_ID = "6a1101372ff5c713c1b1a147";

async function main() {
  console.log("=".repeat(70));
  console.log("FIX STUCK TABLES — Release Booked tables with no active orders");
  console.log("=".repeat(70));

  await mongoose.connect(process.env.MONGODB_URI);
  require("../models/tableModel");
  require("../models/orderModel");

  const Table = mongoose.model("Table");
  const Order = mongoose.model("Order");

  const bookedTables = await Table.find({ store: PILOT_STORE_ID, status: "Booked" }).lean();

  if (bookedTables.length === 0) {
    console.log("\n✅ No stuck tables found — all tables are Available.");
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`\nFound ${bookedTables.length} Booked tables:\n`);

  let released = 0;
  let kept = 0;

  for (const table of bookedTables) {
    // Check for active orders on this table
    const activeOrders = await Order.find({
      table: table._id,
      orderStatus: { $nin: ["completed", "cancelled"] },
    }).lean();

    console.log(`Table ${table.tableNo} (${table._id}):`);
    console.log(`  currentOrder: ${table.currentOrder || "none"}`);
    console.log(`  activeOrders: ${activeOrders.length}`);

    if (activeOrders.length === 0) {
      // Safe to release — no active orders
      await Table.updateOne(
        { _id: table._id },
        { status: "Available", $unset: { currentOrder: "" } }
      );
      console.log(`  ✅ Released → Available (currentOrder cleared)`);
      released++;
    } else {
      // Has active orders — keep Booked
      console.log(`  ⚠️ Kept Booked — has ${activeOrders.length} active order(s):`);
      for (const o of activeOrders) {
        console.log(`    - ${o._id}: status=${o.orderStatus}`);
      }
      kept++;
    }

    // Verify the currentOrder reference is valid
    if (table.currentOrder) {
      const refOrder = await Order.findById(table.currentOrder).lean();
      if (!refOrder) {
        console.log(`  ⚠️ currentOrder points to non-existent order (${table.currentOrder}) — orphaned reference`);
      } else {
        console.log(`  ℹ️ currentOrder points to order ${table.currentOrder}: status=${refOrder.orderStatus}`);
      }
    }

    console.log("");
  }

  // Verify final state
  const remainingBooked = await Table.countDocuments({ store: PILOT_STORE_ID, status: "Booked" });
  const allTables = await Table.find({ store: PILOT_STORE_ID }).lean();

  console.log("-".repeat(70));
  console.log("FINAL STATE:");
  for (const t of allTables) {
    console.log(`  Table ${t.tableNo}: status=${t.status} | currentOrder=${t.currentOrder || "none"} | seats=${t.seats}`);
  }
  console.log(`\nReleased: ${released} | Kept Booked: ${kept} | Still Booked: ${remainingBooked}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Fix script failed:", err.message);
  process.exit(1);
});
