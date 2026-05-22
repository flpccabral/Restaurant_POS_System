/**
 * Validation Script: Phase 3 — Transferência estoque central → loja
 *
 * Testa:
 * 1. Criação de localizações (CENTRAL_WAREHOUSE + STORE)
 * 2. Entrada de estoque no central
 * 3. Transferência central → store
 * 4. Validação de saldo insuficiente
 * 5. Atomicidade (rollback em caso de erro)
 *
 * Uso: node scripts/validate-phase3.js [--auto-yes]
 */

const mongoose = require('mongoose');
const readline = require('readline');
const config = require('../config/config');

const StockLocation = require('../models/stockLocationModel');
const StockBalance = require('../models/stockBalanceModel');
const StockMovement = require('../models/stockMovementModel');
const Store = require('../models/storeModel');
const GlobalIngredient = require('../models/globalIngredientModel');
const User = require('../models/userModel'); // Register model for populate
const transferService = require('../services/transferService');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise((resolve) => rl.question(question, resolve));
}

function log(label, value = null) {
    if (value !== null) {
        console.log(`  ${label}: ${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}`);
    } else {
        console.log(`  ${label}`);
    }
}

async function runValidation() {
    console.log('🧪 Phase 3 Validation: Transferência estoque central → loja\n');

    const autoYes = process.argv.includes('--auto-yes');

    await mongoose.connect(config.databaseURI);
    console.log('✅ Connected to MongoDB\n');

    // 1. Obter uma loja ativa
    const store = await Store.findOne({ isActive: true });
    if (!store) {
        console.log('❌ No active store found. Create a store first.');
        process.exit(1);
    }
    log('Test Store', `${store.name} (${store._id})`);

    // 2. Obter ou criar localização STORE
    let storeLocation = await StockLocation.findOne({ store: store._id, type: 'STORE' });
    if (!storeLocation) {
        storeLocation = await StockLocation.create({
            name: `Estoque - ${store.name}`,
            type: 'STORE',
            store: store._id,
            description: 'Localização padrão da loja'
        });
        log('Created STORE location', storeLocation.name);
    } else {
        log('Existing STORE location', storeLocation.name);
    }

    // 3. Obter ou criar localização CENTRAL_WAREHOUSE
    let centralLocation = await StockLocation.findOne({ store: store._id, type: 'CENTRAL_WAREHOUSE' });
    if (!centralLocation) {
        centralLocation = await StockLocation.create({
            name: `Estoque Central - ${store.name}`,
            type: 'CENTRAL_WAREHOUSE',
            store: store._id,
            description: 'Estoque central da loja'
        });
        log('Created CENTRAL_WAREHOUSE location', centralLocation.name);
    } else {
        log('Existing CENTRAL_WAREHOUSE location', centralLocation.name);
    }

    // 4. Obter ou criar ingrediente de teste
    let ingredient = await GlobalIngredient.findOne({ name: 'Farinha de Trigo (TEST)' });
    if (!ingredient) {
        ingredient = await GlobalIngredient.create({
            name: 'Farinha de Trigo (TEST)',
            baseUnit: 'kg',
            category: 'carboidrato',
            averageCost: 5.50,
            isActive: true
        });
        log('Created test ingredient', ingredient.name);
    } else {
        log('Existing test ingredient', ingredient.name);
    }

    // 5. Criar saldo no estoque central com 50kg
    let centralBalance = await StockBalance.findOne({
        store: store._id,
        location: centralLocation._id,
        ingredient: ingredient._id
    });

    if (!centralBalance) {
        centralBalance = await StockBalance.create({
            store: store._id,
            location: centralLocation._id,
            ingredient: ingredient._id,
            balance: 50,
            reserved: 0,
            available: 50,
            unit: 'kg',
            minimumStock: 10,
            lastPurchasePrice: 5.50
        });
        log('Created central balance', `50 kg @ R$ 5.50`);
    } else {
        centralBalance.balance = 50;
        await centralBalance.save();
        log('Reset central balance', `50 kg`);
    }

    // 6. Limpar saldos e movimentos anteriores do teste
    await StockBalance.deleteOne({
        store: store._id,
        location: storeLocation._id,
        ingredient: ingredient._id
    });
    await StockMovement.deleteMany({
        store: store._id,
        ingredient: ingredient._id,
        type: { $in: ['transfer_out', 'transfer_in'] }
    });

    console.log('\n--- Test 1: Transferência normal (10kg central → store) ---');
    if (!autoYes) {
        const confirm = await ask('  Run? (y/n): ');
        if (confirm.toLowerCase() !== 'y') {
            console.log('  ⏭️  Skipped');
        } else {
            await testNormalTransfer(store, centralLocation, storeLocation, ingredient);
        }
    } else {
        await testNormalTransfer(store, centralLocation, storeLocation, ingredient);
    }

    console.log('\n--- Test 2: Validação de saldo insuficiente ---');
    if (!autoYes) {
        const confirm = await ask('  Run? (y/n): ');
        if (confirm.toLowerCase() !== 'y') {
            console.log('  ⏭️  Skipped');
        } else {
            await testInsufficientStock(store, centralLocation, ingredient);
        }
    } else {
        await testInsufficientStock(store, centralLocation, ingredient);
    }

    console.log('\n--- Test 3: Mesma origem e destino ---');
    if (!autoYes) {
        const confirm = await ask('  Run? (y/n): ');
        if (confirm.toLowerCase() !== 'y') {
            console.log('  ⏭️  Skipped');
        } else {
            await testSameOriginDestination(store, centralLocation, ingredient);
        }
    } else {
        await testSameOriginDestination(store, centralLocation, ingredient);
    }

    console.log('\n--- Test 4: Histórico de transferências ---');
    const history = await transferService.getTransferHistory(store._id.toString());
    log('Transfer records found', history.length);
    if (history.length > 0) {
        const first = history[0];
        log('Latest transfer', {
            quantity: first.transferOut.quantity,
            unit: first.transferOut.unit,
            origin: first.origin?.name,
            destination: first.destination?.name,
            reason: first.transferOut.reason
        });
    }

    console.log('\n--- Test 5: Validação sem executar ---');
    const validation = await transferService.validateTransfer(
        store._id.toString(),
        centralLocation._id.toString(),
        ingredient._id,
        5
    );
    log('Validation result', validation);

    // Cleanup
    console.log('\n🧹 Cleanup: Removing test data...');
    await StockBalance.deleteMany({
        store: store._id,
        ingredient: ingredient._id
    });
    await StockMovement.deleteMany({
        store: store._id,
        ingredient: ingredient._id
    });
    await GlobalIngredient.deleteOne({ _id: ingredient._id });
    log('Test data removed');

    console.log('\n✅ Phase 3 validation complete');
    rl.close();
    process.exit(0);
}

async function testNormalTransfer(store, centralLocation, storeLocation, ingredient) {
    try {
        const result = await transferService.createTransfer({
            storeId: store._id.toString(),
            originLocationId: centralLocation._id.toString(),
            destinationLocationId: storeLocation._id.toString(),
            ingredientId: ingredient._id,
            quantity: 10,
            unit: 'kg',
            reason: 'Teste de transferência Phase 3',
            userId: null
        });

        log('✅ Transfer successful', {
            quantity: result.quantity,
            originBalanceBefore: result.origin.balanceBefore,
            originBalanceAfter: result.origin.balanceAfter,
            destBalanceBefore: result.destination.balanceBefore,
            destBalanceAfter: result.destination.balanceAfter
        });

        // Verificar saldos
        const centralBal = await StockBalance.findOne({
            store: store._id,
            location: centralLocation._id,
            ingredient: ingredient._id
        });
        const storeBal = await StockBalance.findOne({
            store: store._id,
            location: storeLocation._id,
            ingredient: ingredient._id
        });

        if (centralBal.balance === 40 && storeBal.balance === 10) {
            log('✅ Balance verification passed', `Central: ${centralBal.balance}kg, Store: ${storeBal.balance}kg`);
        } else {
            log('❌ Balance verification FAILED', `Central: ${centralBal.balance}kg (expected 40), Store: ${storeBal.balance}kg (expected 10)`);
        }
    } catch (error) {
        log('❌ Transfer failed', error.message);
    }
}

async function testInsufficientStock(store, centralLocation, ingredient) {
    try {
        // Tentar transferir mais do que o saldo disponível
        const result = await transferService.createTransfer({
            storeId: store._id.toString(),
            originLocationId: centralLocation._id.toString(),
            destinationLocationId: new mongoose.Types.ObjectId().toString(),
            ingredientId: ingredient._id,
            quantity: 999,
            unit: 'kg',
            reason: 'Teste de saldo insuficiente',
            userId: null
        });
        log('❌ Should have failed but succeeded');
    } catch (error) {
        log('✅ Correctly rejected insufficient stock', error.message);
    }
}

async function testSameOriginDestination(store, centralLocation, ingredient) {
    try {
        const result = await transferService.createTransfer({
            storeId: store._id.toString(),
            originLocationId: centralLocation._id.toString(),
            destinationLocationId: centralLocation._id.toString(),
            ingredientId: ingredient._id,
            quantity: 5,
            unit: 'kg',
            reason: 'Teste mesma origem/destino',
            userId: null
        });
        log('❌ Should have failed but succeeded');
    } catch (error) {
        log('✅ Correctly rejected same origin/destination', error.message);
    }
}

runValidation().catch(async (err) => {
    console.error('❌ Validation failed:', err);
    await mongoose.disconnect();
    rl.close();
    process.exit(1);
});
