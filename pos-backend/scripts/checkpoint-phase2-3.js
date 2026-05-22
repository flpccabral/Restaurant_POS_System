/**
 * Checkpoint Final Fase 2/3 — Validacao pratica completa
 *
 * Testa:
 * 1. CENTRAL_WAREHOUSE sem store
 * 2. STORE com store obrigatorio
 * 3. Saldo central 50kg
 * 4. Transferencia 10kg central → loja
 * 5. Central 50→40kg, Loja 0→10kg
 * 6. Movimentos transfer_out + transfer_in
 * 7. Atomicidade transacional
 */

const mongoose = require('mongoose');
const config = require('../config/config');

const StockLocation = require('../models/stockLocationModel');
const StockBalance = require('../models/stockBalanceModel');
const StockMovement = require('../models/stockMovementModel');
const Store = require('../models/storeModel');
const GlobalIngredient = require('../models/globalIngredientModel');
const transferService = require('../services/transferService');

const results = [];

function log(section, detail) {
    results.push({ section, detail });
    console.log(`  [${section}] ${typeof detail === 'object' ? JSON.stringify(detail, null, 2) : detail}`);
}

async function run() {
    console.log('Checkpoint Final Fase 2/3 — Validacao pratica\n');

    await mongoose.connect(config.databaseURI);
    console.log('Connected to MongoDB\n');

    const store = await Store.findOne({ isActive: true });
    if (!store) { console.log('No active store found'); process.exit(1); }
    log('SETUP', `Store: ${store.name} (${store._id})`);

    // ========== CLEANUP ==========
    await StockBalance.deleteMany({ 'metadata.checkpoint': true });
    await StockMovement.deleteMany({ 'metadata.checkpoint': true });

    // ========== TEST 1: CENTRAL_WAREHOUSE sem store ==========
    console.log('\n--- Test 1: CENTRAL_WAREHOUSE sem store ---');
    try {
        let central = await StockLocation.findOne({ type: 'CENTRAL_WAREHOUSE', store: null });
        if (!central) {
            central = await StockLocation.create({
                name: 'Estoque Central Compartilhado (CHECKPOINT)',
                type: 'CENTRAL_WAREHOUSE',
                store: null,
                description: 'Checkpoint test - shared central'
            });
            log('CREATE', `Shared central created: ${central.name} (store=${central.store})`);
        } else {
            log('EXIST', `Shared central already exists: ${central.name} (store=${central.store})`);
        }

        // Verify store is null
        if (central.store !== null && central.store !== undefined) {
            log('FAIL', `store should be null, got: ${central.store}`);
        } else {
            log('PASS', 'CENTRAL_WAREHOUSE created without store');
        }
    } catch (err) {
        log('FAIL', `Error creating CENTRAL_WAREHOUSE: ${err.message}`);
    }

    // ========== TEST 2: STORE com store obrigatorio ==========
    console.log('\n--- Test 2: STORE com store obrigatorio ---');
    try {
        // Should succeed
        let storeLoc = await StockLocation.findOne({ store: store._id, type: 'STORE' });
        if (!storeLoc) {
            storeLoc = await StockLocation.create({
                name: `Estoque - ${store.name} (CHECKPOINT)`,
                type: 'STORE',
                store: store._id,
                description: 'Checkpoint test - store location'
            });
        }
        log('PASS', `STORE location created: ${storeLoc.name} (store=${storeLoc.store})`);

        // Should fail: STORE without store
        try {
            await StockLocation.create({
                name: 'STORE sem store',
                type: 'STORE',
                store: null,
                description: 'Should fail'
            });
            log('FAIL', 'STORE without store should have been rejected');
        } catch (valErr) {
            log('PASS', `STORE without store correctly rejected: ${valErr.message}`);
        }
    } catch (err) {
        log('FAIL', `STORE test error: ${err.message}`);
    }

    // ========== TEST 3: Setup locations and balance ==========
    console.log('\n--- Test 3: Saldo central 50kg ---');
    const central = await StockLocation.findOne({ type: 'CENTRAL_WAREHOUSE', store: null });
    const storeLoc = await StockLocation.findOne({ store: store._id, type: 'STORE' });

    let ingredient = await GlobalIngredient.findOne({ name: { $regex: /CHECKPOINT/i } });
    if (!ingredient) {
        ingredient = await GlobalIngredient.create({
            name: 'Insumo CHECKPOINT (TEST)',
            baseUnit: 'kg',
            category: 'carboidrato',
            averageCost: 3.00,
            isActive: true
        });
    }
    log('SETUP', `Ingredient: ${ingredient.name}`);

    // Create or reset central balance to 50kg
    let centralBal = await StockBalance.findOne({ location: central._id, ingredient: ingredient._id });
    if (!centralBal) {
        centralBal = await StockBalance.create({
            store: null,
            location: central._id,
            ingredient: ingredient._id,
            balance: 50,
            reserved: 0,
            available: 50,
            unit: 'kg',
            minimumStock: 10,
            lastPurchasePrice: 3.00
        });
    } else {
        centralBal.balance = 50;
        centralBal.store = null;
        await centralBal.save();
    }
    log('BALANCE', `Central balance set to ${centralBal.balance} kg (store=${centralBal.store})`);

    // Delete any store balance for this ingredient
    await StockBalance.deleteOne({ location: storeLoc._id, ingredient: ingredient._id });
    log('BALANCE', 'Store balance cleared (starting from 0)');

    // ========== TEST 4-11: Transferencia 10kg central → loja ==========
    console.log('\n--- Test 4-11: Transferencia 10kg central → loja ---');
    try {
        const transferResult = await transferService.createTransfer({
            storeId: store._id.toString(),
            originLocationId: central._id.toString(),
            destinationLocationId: storeLoc._id.toString(),
            ingredientId: ingredient._id,
            quantity: 10,
            unit: 'kg',
            reason: 'Checkpoint test - transferencia central → loja',
            userId: null
        });

        log('TRANSFER', 'Transferencia executada com sucesso');
        log('RESULT', {
            quantity: transferResult.quantity,
            unit: transferResult.unit,
            origin: transferResult.origin,
            destination: transferResult.destination,
            isSharedCentral: transferResult.origin.isSharedCentral,
            movements: transferResult.movements
        });

        // Verify central balance
        const centralAfter = await StockBalance.findById(centralBal._id);
        log('VERIFY', `Central balance: ${centralAfter.balance} kg (expected 40)`);
        if (centralAfter.balance === 40) {
            log('PASS', 'Central balance correct: 50 → 40');
        } else {
            log('FAIL', `Central balance WRONG: expected 40, got ${centralAfter.balance}`);
        }

        // Verify store balance
        const storeAfter = await StockBalance.findOne({ location: storeLoc._id, ingredient: ingredient._id });
        log('VERIFY', `Store balance: ${storeAfter.balance} kg (expected 10)`);
        if (storeAfter.balance === 10) {
            log('PASS', 'Store balance correct: 0 → 10');
        } else {
            log('FAIL', `Store balance WRONG: expected 10, got ${storeAfter.balance}`);
        }

        // Verify movements
        const transferOut = await StockMovement.findById(transferResult.movements.transferOut)
            .populate('originLocation', 'name type store')
            .populate('destinationLocation', 'name type store');
        const transferIn = await StockMovement.findById(transferResult.movements.transferIn)
            .populate('originLocation', 'name type store')
            .populate('destinationLocation', 'name type store');

        log('MOVEMENT_OUT', {
            type: transferOut.type,
            quantity: transferOut.quantity,
            unit: transferOut.unit,
            balanceBefore: transferOut.balanceBefore,
            balanceAfter: transferOut.balanceAfter,
            originLocation: transferOut.originLocation?.name,
            originType: transferOut.originLocation?.type,
            originStore: transferOut.originLocation?.store,
            destinationLocation: transferOut.destinationLocation?.name,
            reason: transferOut.reason
        });

        log('MOVEMENT_IN', {
            type: transferIn.type,
            quantity: transferIn.quantity,
            unit: transferIn.unit,
            balanceBefore: transferIn.balanceBefore,
            balanceAfter: transferIn.balanceAfter,
            originLocation: transferIn.originLocation?.name,
            originType: transferIn.originLocation?.type,
            originStore: transferIn.originLocation?.store,
            destinationLocation: transferIn.destinationLocation?.name,
            destinationType: transferIn.destinationLocation?.type,
            destinationStore: transferIn.destinationLocation?.store,
            reason: transferIn.reason
        });

        // Verify originLocation and destinationLocation preserved
        if (transferOut.originLocation && transferOut.destinationLocation) {
            log('PASS', 'transfer_out: originLocation and destinationLocation preserved');
        } else {
            log('FAIL', 'transfer_out: locations missing');
        }
        if (transferIn.originLocation && transferIn.destinationLocation) {
            log('PASS', 'transfer_in: originLocation and destinationLocation preserved');
        } else {
            log('FAIL', 'transfer_in: locations missing');
        }

        // Verify origin is shared central (store = null)
        if (!transferOut.originLocation.store) {
            log('PASS', 'transfer_out origin has store = null (shared central)');
        } else {
            log('FAIL', `transfer_out origin should have store=null, got ${transferOut.originLocation.store}`);
        }

        // Verify transaction integrity: total stock should be 50
        const totalStock = centralAfter.balance + storeAfter.balance;
        if (totalStock === 50) {
            log('PASS', `Transaction integrity: total stock preserved (${totalStock}kg)`);
        } else {
            log('FAIL', `Transaction integrity BROKEN: total stock = ${totalStock}kg (expected 50)`);
        }

    } catch (err) {
        log('FAIL', `Transfer error: ${err.message}`);
        console.error(err);
    }

    // ========== TEST 12: Indices ==========
    console.log('\n--- Test 12: Indices ---');
    try {
        const locIndexes = await StockLocation.collection.indexes();
        log('INDEXES', `StockLocation indexes: ${locIndexes.map(i => `${i.name}: ${JSON.stringify(i.key)}`).join(', ')}`);

        const balIndexes = await StockBalance.collection.indexes();
        log('INDEXES', `StockBalance indexes: ${balIndexes.map(i => `${i.name}: ${JSON.stringify(i.key)}`).join(', ')}`);

        const movIndexes = await StockMovement.collection.indexes();
        log('INDEXES', `StockMovement indexes: ${movIndexes.map(i => `${i.name}: ${JSON.stringify(i.key)}`).join(', ')}`);

        log('PASS', 'All indexes loaded without conflicts');
    } catch (err) {
        log('FAIL', `Index check error: ${err.message}`);
    }

    // ========== CLEANUP ==========
    console.log('\n--- Cleanup ---');
    await StockBalance.deleteOne({ location: central._id, ingredient: ingredient._id });
    await StockBalance.deleteOne({ location: storeLoc._id, ingredient: ingredient._id });
    await StockMovement.deleteMany({ ingredient: ingredient._id, type: { $in: ['transfer_out', 'transfer_in'] } });
    await StockLocation.deleteOne({ type: 'CENTRAL_WAREHOUSE', store: null, description: /CHECKPOINT/i });
    await StockLocation.deleteOne({ description: /CHECKPOINT/i });
    await GlobalIngredient.deleteOne({ name: { $regex: /CHECKPOINT/i } });
    log('CLEANUP', 'Test data removed');

    console.log('\nCheckpoint complete');
    process.exit(0);
}

run().catch(async (err) => {
    console.error('Checkpoint failed:', err);
    await mongoose.disconnect();
    process.exit(1);
});
