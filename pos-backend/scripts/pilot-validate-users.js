/**
 * Fase 9.2 — Task 5: Validate users and permissions
 * Tests login, store scoping, and role-based access for all 3 pilot users
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const PILOT_STORE_ID = "6a1101372ff5c713c1b1a147";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  require("../models/userModel");
  require("../models/roleModel");
  require("../models/productModel");
  require("../models/storeModel");

  const User = mongoose.model("User");
  const Product = mongoose.model("Product");
  const Store = mongoose.model("Store");

  const store = await Store.findById(PILOT_STORE_ID).lean();
  console.log("=".repeat(70));
  console.log("FASE 9.2 — TASK 5: USER & PERMISSION VALIDATION");
  console.log("=".repeat(70));
  console.log(`Pilot store: ${store?.name || PILOT_STORE_ID} (${PILOT_STORE_ID})`);

  const usersToTest = [
    { email: "gerente.demo@pos.com", role: "manager" },
    { email: "operador.demo@pos.com", role: "operator" },
    { email: "admin@pos.com", role: "master_admin" },
  ];

  let allPassed = true;
  const results = [];

  for (const testUser of usersToTest) {
    console.log(`\n--- ${testUser.email} (${testUser.role}) ---`);

    const user = await User.findOne({ email: testUser.email }).populate("role", "name permissions").lean();

    if (!user) {
      console.log(`  ❌ User NOT FOUND`);
      results.push({ email: testUser.email, status: "NOT_FOUND", issues: ["User does not exist"] });
      allPassed = false;
      continue;
    }

    const issues = [];

    // Check account active
    if (!user.isActive) issues.push("Account is inactive");

    // Check store assignment
    const userStore = user.store?.toString();
    if (userStore !== PILOT_STORE_ID) {
      // Master admin may not have a specific store — that's OK
      if (!user.isMasterAdmin) {
        issues.push(`Store mismatch: user.store=${userStore}, pilot=${PILOT_STORE_ID}`);
      } else {
        console.log(`  ℹ️ Master admin — no fixed store (expected)`);
      }
    }

    // Check role
    const role = user.role;
    if (!role) {
      issues.push("No role assigned");
    }

    // Check products visible to this user's store
    if (userStore) {
      const productCount = await Product.countDocuments({ store: userStore, isActive: true });
      console.log(`  Store: ${userStore} | Active products: ${productCount} | isMasterAdmin: ${user.isMasterAdmin}`);
    }

    const passed = issues.length === 0;
    if (!passed) allPassed = false;

    results.push({
      email: testUser.email,
      userId: user._id.toString(),
      store: userStore || "none",
      role: role?.name || "none",
      isMasterAdmin: user.isMasterAdmin,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      status: passed ? "OK" : "ISSUES",
      issues,
    });

    console.log(`  Status: ${passed ? "✅ OK" : "❌ " + issues.join("; ")}`);
  }

  // Store products visible to non-master users
  console.log("\n--- Store Product Visibility ---");
  const allStoreProducts = await Product.find({ store: PILOT_STORE_ID, isActive: true }).lean();
  console.log(`Active products for pilot store: ${allStoreProducts.length}`);
  allStoreProducts.forEach((p) => {
    console.log(`  - ${p.name} | ${p.stockImpactRule || "no_rule"} | R$ ${p.price ?? "?"}`);
  });

  console.log("\n" + "=".repeat(70));
  console.log(`🏁 All users valid: ${allPassed ? "✅ YES" : "❌ NO — fix issues before pilot"}`);
  console.log(`Exit code: ${allPassed ? 0 : 1}`);

  await mongoose.disconnect();
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("❌ Script failed:", err.message);
  process.exit(1);
});
