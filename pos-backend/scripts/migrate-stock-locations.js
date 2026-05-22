/**
 * Migration: Adicionar StockLocation a stores e balances existentes
 *
 * Cria localização padrão STORE para cada loja existente,
 * e atualiza StockBalances/StockMovements para referenciar a location.
 */

const mongoose = require('mongoose');
const readline = require('readline');
const config = require('../config/config');

const Store = require('../models/storeModel');
const StockLocation = require('../models/stockLocationModel');
const StockBalance = require('../models/stockBalanceModel');
const StockMovement = require('../models/stockMovementModel');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise((resolve) => rl.question(question, resolve));
}

async function runMigration() {
    console.log('🔧 Migration: StockLocation Setup\n');

    await mongoose.connect(config.databaseURI);
    console.log('✅ Connected to MongoDB\n');

    const dryRun = process.argv.includes('--dry-run');
    const autoYes = process.argv.includes('--auto-yes');

    if (dryRun) {
        console.log('⚠️  DRY RUN MODE — no changes will be made\n');
    }

    // 1. Obter todas as stores
    const stores = await Store.find({ isActive: true });
    console.log(`📦 Found ${stores.length} active stores\n`);

    for (const store of stores) {
        console.log(`\n--- Store: ${store.name} (${store._id}) ---`);

        // Verificar se já existe location STORE para esta store
        const existingLocation = await StockLocation.findOne({
            store: store._id,
            type: 'STORE'
        });

        if (existingLocation) {
            console.log(`  ✅ STORE location already exists: ${existingLocation.name}`);
        } else {
            const locationName = `Estoque - ${store.name}`;
            console.log(`  📝 Would create location: "${locationName}"`);

            if (!dryRun) {
                const confirm = autoYes ? 'y' : await ask('    Proceed? (y/n): ');
                if (confirm.toLowerCase() === 'y') {
                    const location = await StockLocation.create({
                        name: locationName,
                        type: 'STORE',
                        store: store._id,
                        description: 'Localização padrão da loja'
                    });
                    console.log(`  ✅ Created location: ${location.name} (${location._id})`);

                    // 2. Atualizar StockBalances desta store
                    const balanceUpdateResult = await StockBalance.updateMany(
                        { store: store._id, location: { $exists: false } },
                        { $set: { location: location._id } }
                    );
                    console.log(`  📊 Updated ${balanceUpdateResult.modifiedCount} StockBalances`);

                    // 3. Atualizar StockMovements desta store
                    const movementUpdateResult = await StockMovement.updateMany(
                        { store: store._id, location: { $exists: false } },
                        { $set: { location: location._id } }
                    );
                    console.log(`  📊 Updated ${movementUpdateResult.modifiedCount} StockMovements`);
                } else {
                    console.log('  ⏭️  Skipped');
                }
            }
        }

        // 4. Verificar balances sem location
        const balancesWithoutLocation = await StockBalance.countDocuments({
            store: store._id,
            location: { $exists: false }
        });
        if (balancesWithoutLocation > 0) {
            console.log(`  ⚠️  ${balancesWithoutLocation} StockBalances still without location`);
        }

        // 5. Verificar movements sem location
        const movementsWithoutLocation = await StockMovement.countDocuments({
            store: store._id,
            location: { $exists: false }
        });
        if (movementsWithoutLocation > 0) {
            console.log(`  ⚠️  ${movementsWithoutLocation} StockMovements still without location`);
        }
    }

    // 6. Drop old unique index on {store, ingredient} if it exists
    // The new unique index is on {location, ingredient}
    const stockBalanceIndexes = await StockBalance.collection.indexes();
    const oldIndex = stockBalanceIndexes.find(idx =>
        idx.name === 'store_1_ingredient_1' && idx.unique
    );
    if (oldIndex) {
        console.log('\n🗑️  Dropping old unique index: store_1_ingredient_1');
        await StockBalance.collection.dropIndex('store_1_ingredient_1');
        console.log('  ✅ Old index dropped');
    } else {
        console.log('\n✅ Old unique index already removed');
    }

    // 6. Verificar balances de stores inativas ou órfãs
    const orphanBalances = await StockBalance.countDocuments({ location: { $exists: false } });
    const orphanMovements = await StockMovement.countDocuments({ location: { $exists: false } });
    console.log(`\n📊 Summary:`);
    console.log(`   StockBalances without location: ${orphanBalances}`);
    console.log(`   StockMovements without location: ${orphanMovements}`);

    if (orphanBalances > 0 || orphanMovements > 0) {
        console.log('   ⚠️  Some records are orphaned (no matching store). Review manually.');
    }

    console.log('\n✅ Migration complete');
    rl.close();
    process.exit(0);
}

runMigration().catch(async (err) => {
    console.error('❌ Migration failed:', err);
    await mongoose.disconnect();
    rl.close();
    process.exit(1);
});
