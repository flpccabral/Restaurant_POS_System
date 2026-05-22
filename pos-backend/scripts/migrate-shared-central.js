/**
 * Migration: Estoque Central Compartilhado
 *
 * Ajusta indices e dados para suportar CENTRAL_WAREHOUSE sem store.
 *
 * O que faz:
 * 1. Drop do indice antigo { store: 1, name: 1 } em StockLocation
 * 2. Drop do indice antigo { store: 1 } em StockBalance (se exists)
 * 3. Drop do indice antigo { store: 1 } em StockMovement (se exists)
 * 4. Cria estoque central compartilhado (store = null) se nao existir
 * 5. Migrar CENTRAL_WAREHOUSE dedicados existentes para o compartilhado (opcional)
 * 6. Preserva historico de movimentacoes
 *
 * Uso: node scripts/migrate-shared-central.js [--dry-run] [--auto-yes] [--merge-centrals]
 */

const mongoose = require('mongoose');
const readline = require('readline');
const config = require('../config/config');

const StockLocation = require('../models/stockLocationModel');
const StockBalance = require('../models/stockBalanceModel');
const StockMovement = require('../models/stockMovementModel');
const Store = require('../models/storeModel');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise((resolve) => rl.question(question, resolve));
}

async function runMigration() {
    console.log('Migration: Estoque Central Compartilhado\n');

    await mongoose.connect(config.databaseURI);
    console.log('Connected to MongoDB\n');

    const dryRun = process.argv.includes('--dry-run');
    const autoYes = process.argv.includes('--auto-yes');
    const mergeCentrals = process.argv.includes('--merge-centrals');

    if (dryRun) {
        console.log('DRY RUN MODE - no changes will be made\n');
    }

    // 1. Drop indices antigos que exigem store
    console.log('--- Step 1: Drop old indices ---');

    // StockLocation: drop { store: 1, name: 1 } unique
    const locIndexes = await StockLocation.collection.indexes();
    const oldLocIndex = locIndexes.find(idx => idx.name === 'store_1_name_1' && idx.unique);
    if (oldLocIndex) {
        console.log(`  Dropping StockLocation index: store_1_name_1`);
        if (!dryRun) {
            await StockLocation.collection.dropIndex('store_1_name_1');
            console.log('  Dropped');
        }
    } else {
        console.log('  Old StockLocation index already dropped');
    }

    // 2. Criar central compartilhado
    console.log('\n--- Step 2: Create shared central warehouse ---');

    let sharedCentral = await StockLocation.findOne({
        type: 'CENTRAL_WAREHOUSE',
        store: null
    });

    if (sharedCentral) {
        console.log(`  Shared central already exists: ${sharedCentral.name} (${sharedCentral._id})`);
    } else {
        console.log('  Would create: "Estoque Central Compartilhado" (store = null)');
        if (!dryRun) {
            const confirm = autoYes ? 'y' : await ask('  Proceed? (y/n): ');
            if (confirm.toLowerCase() === 'y') {
                sharedCentral = await StockLocation.create({
                    name: 'Estoque Central Compartilhado',
                    type: 'CENTRAL_WAREHOUSE',
                    store: null,
                    description: 'Almoxarifado central do grupo - compartilhado entre todas as lojas'
                });
                console.log(`  Created: ${sharedCentral.name} (${sharedCentral._id})`);
            } else {
                console.log('  Skipped');
            }
        }
    }

    // 3. Migrar CENTRAL_WAREHOUSE dedicados para o compartilhado
    if (mergeCentrals && sharedCentral) {
        console.log('\n--- Step 3: Merge dedicated centrals into shared central ---');

        const dedicatedCentrals = await StockLocation.find({
            type: 'CENTRAL_WAREHOUSE',
            store: { $ne: null },
            _id: { $ne: sharedCentral._id }
        });

        console.log(`  Found ${dedicatedCentrals.length} dedicated central warehouses`);

        for (const dc of dedicatedCentrals) {
            console.log(`\n  Migrating: ${dc.name} (store: ${dc.store})`);

            if (!dryRun) {
                const confirm = autoYes ? 'y' : await ask('    Migrate balances? (y/n): ');
                if (confirm.toLowerCase() === 'y') {
                    // Migrar StockBalances
                    const balances = await StockBalance.find({
                        location: dc._id
                    });

                    for (const bal of balances) {
                        // Verificar se ja existe saldo no central compartilhado para este ingrediente
                        let sharedBal = await StockBalance.findOne({
                            location: sharedCentral._id,
                            ingredient: bal.ingredient
                        });

                        if (sharedBal) {
                            // Somar saldos
                            sharedBal.balance += bal.balance;
                            sharedBal.reserved += bal.reserved;
                            await sharedBal.save();
                            await bal.deleteOne();
                            console.log(`    Merged balance for ingredient ${bal.ingredient}: ${bal.balance} -> shared (total: ${sharedBal.balance})`);
                        } else {
                            // Mover para central compartilhado
                            bal.location = sharedCentral._id;
                            bal.store = null;
                            await bal.save();
                            console.log(`    Moved balance for ingredient ${bal.ingredient}: ${bal.balance}`);
                        }
                    }

                    // Desativar localizacao antiga
                    dc.isActive = false;
                    dc.name = `[DESATIVADO] ${dc.name}`;
                    await dc.save();
                    console.log(`    Deactivated: ${dc.name}`);
                } else {
                    console.log('    Skipped');
                }
            }
        }
    }

    // 4. Atualizar StockBalances de central sem store
    console.log('\n--- Step 4: Fix StockBalances for shared central ---');

    if (sharedCentral) {
        const balancesWithoutStore = await StockBalance.updateMany(
            { location: sharedCentral._id, store: { $ne: null } },
            { $set: { store: null } }
        );
        console.log(`  Updated ${balancesWithoutStore.modifiedCount} StockBalances to store = null`);
    }

    // 5. Resumo
    console.log('\n--- Summary ---');

    const allLocations = await StockLocation.find({ isActive: true }).sort({ type: 1, store: 1 });
    console.log(`  Active locations: ${allLocations.length}`);

    const sharedCount = await StockLocation.countDocuments({ type: 'CENTRAL_WAREHOUSE', store: null });
    console.log(`  Shared central warehouses: ${sharedCount}`);

    const dedicatedCount = await StockLocation.countDocuments({ type: 'CENTRAL_WAREHOUSE', store: { $ne: null }, isActive: true });
    console.log(`  Dedicated central warehouses: ${dedicatedCount}`);

    const storeCount = await StockLocation.countDocuments({ type: 'STORE' });
    console.log(`  Store locations: ${storeCount}`);

    console.log('\n Migration complete');
    rl.close();
    process.exit(0);
}

runMigration().catch(async (err) => {
    console.error(' Migration failed:', err);
    await mongoose.disconnect();
    rl.close();
    process.exit(1);
});
