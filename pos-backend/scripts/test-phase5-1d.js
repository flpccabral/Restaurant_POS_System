/**
 * Teste Prático Fase 5.1D — Transferência inter-operações e subprodutos
 *
 * Cenários:
 * A. Bar → Hamburgueria: gordura bovina byproduct (2kg)
 * B. Item incompatível bloqueado (espetinho temperado → hamburgueria)
 * C. Rollback em falha (estoque insuficiente)
 * D. Mesma loja bloqueada
 * E. Central → Loja ainda funciona (regressão)
 */

const mongoose = require('mongoose');
const config = require('../config/config');
const Store = require('../models/storeModel');
const User = require('../models/userModel');
const Role = require('../models/roleModel');
const GlobalIngredient = require('../models/globalIngredientModel');
const StockLocation = require('../models/stockLocationModel');
const StockBalance = require('../models/stockBalanceModel');
const StockMovement = require('../models/stockMovementModel');
const interStoreTransferService = require('../services/interStoreTransferService');
const transferService = require('../services/transferService');

let passCount = 0, failCount = 0;

function assert(condition, section, detail) {
    const status = condition ? 'PASS' : 'FAIL';
    if (condition) passCount++; else failCount++;
    console.log(`  [${status}] ${section}: ${typeof detail === 'object' ? JSON.stringify(detail).substring(0, 150) : detail}`);
    return condition;
}

function logSection(title) { console.log(`\n--- ${title} ---`); }
function logDetail(key, value) { console.log(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`); }

async function run() {
    console.log('=== Teste Fase 5.1D — Transferência inter-operações e subprodutos ===\n');

    await mongoose.connect(config.databaseURI);
    console.log('Connected to MongoDB\n');

    // ========== SETUP ==========
    // Criar ou reutilizar stores com operationType
    let barStore = await Store.findOne({ name: /bar.*test.*5/i, isActive: true });
    let hamburgueriaStore = await Store.findOne({ name: /hamburgueria.*test.*5/i, isActive: true });
    let pizzariaStore = await Store.findOne({ name: /pizzaria.*test.*5/i, isActive: true });

    if (!barStore) {
        barStore = await Store.create({
            name: 'Bar Test 5.1D',
            phone: '111111111',
            email: 'bar@test51d.com',
            cnpj: '11.111.111/0001-11',
            operationType: 'bar',
            isActive: true
        });
    } else if (barStore.operationType !== 'bar') {
        barStore.operationType = 'bar';
        await barStore.save();
    }

    if (!hamburgueriaStore) {
        hamburgueriaStore = await Store.create({
            name: 'Hamburgueria Test 5.1D',
            phone: '222222222',
            email: 'hamburgueria@test51d.com',
            cnpj: '22.222.222/0001-22',
            operationType: 'hamburgueria',
            isActive: true
        });
    } else if (hamburgueriaStore.operationType !== 'hamburgueria') {
        hamburgueriaStore.operationType = 'hamburgueria';
        await hamburgueriaStore.save();
    }

    if (!pizzariaStore) {
        pizzariaStore = await Store.create({
            name: 'Pizzaria Test 5.1D',
            phone: '333333333',
            email: 'pizzaria@test51d.com',
            cnpj: '33.333.333/0001-33',
            operationType: 'pizzaria',
            isActive: true
        });
    }

    // Criar ou reutilizar usuário teste
    let testUser = await User.findOne({ email: 'test51d@example.com' });
    if (!testUser) {
        // Buscar uma role existente ou usar string
        const existingRole = await mongoose.model('Role').findOne({ isActive: true });
        const roleRef = existingRole ? existingRole._id : 'admin';

        testUser = await User.create({
            name: 'Test User 5.1D',
            email: 'test51d@example.com',
            phone: 1111111111,
            password: 'test123',
            role: roleRef,
            store: barStore._id,
            isMasterAdmin: true
        });
    }

    logDetail('Bar', `${barStore.name} (${barStore._id}) operationType=${barStore.operationType}`);
    logDetail('Hamburgueria', `${hamburgueriaStore.name} (${hamburgueriaStore._id}) operationType=${hamburgueriaStore.operationType}`);
    logDetail('Pizzaria', `${pizzariaStore.name} (${pizzariaStore._id}) operationType=${pizzariaStore.operationType}`);

    // ========== CLEANUP ==========
    await GlobalIngredient.deleteMany({ name: { $regex: /PHASE5_1D/i } });
    await StockMovement.deleteMany({
        store: { $in: [barStore._id, hamburgueriaStore._id, pizzariaStore._id] },
        'metadata.transferScope': 'inter_store'
    });
    await StockBalance.deleteMany({
        store: { $in: [barStore._id, hamburgueriaStore._id, pizzariaStore._id] },
        'metadata.test_phase5_1d': true
    });

    // Delete stale stores from previous 5.1D runs
    await Store.deleteMany({ name: /Regression Test 5\.1D/ });

    // Delete stale locations from previous test runs for these stores
    await StockLocation.deleteMany({
        store: { $in: [barStore._id, hamburgueriaStore._id, pizzariaStore._id] },
        name: { $regex: /Estoque - / }
    });

    // Clean central warehouse from previous runs
    await StockLocation.deleteMany({ name: /PHASE5_1D/ });

    // ========== SETUP — INGREDIENTES ==========
    logSection('Setup — Ingredientes');

    // Gordura bovina — byproduct compatível com bar e hamburgueria
    const gordura = await GlobalIngredient.create({
        name: 'Gordura bovina reaproveitável PHASE5_1D',
        category: 'outro',
        baseUnit: 'g',
        averageCost: 0.02,
        itemType: 'byproduct',
        productionState: 'raw',
        isByproduct: true,
        compatibleOperations: ['bar', 'hamburgueria', 'geral'],
        isActive: true
    });

    // Espetinho temperado — compatível apenas com bar
    const espetinho = await GlobalIngredient.create({
        name: 'Espetinho temperado PHASE5_1D',
        category: 'proteina',
        baseUnit: 'g',
        averageCost: 0.05,
        itemType: 'prepared',
        productionState: 'seasoned',
        isByproduct: false,
        compatibleOperations: ['bar'],
        isActive: true
    });

    // Ingrediente waste — deve ser bloqueado
    const wasteItem = await GlobalIngredient.create({
        name: 'Apara de carne PHASE5_1D',
        category: 'outro',
        baseUnit: 'g',
        averageCost: 0,
        itemType: 'byproduct',
        productionState: 'waste',
        isByproduct: true,
        compatibleOperations: ['geral'],
        isActive: true
    });

    // Ingrediente para central→store regressão
    const farinha = await GlobalIngredient.create({
        name: 'Farinha trigo PHASE5_1D',
        category: 'carboidrato',
        baseUnit: 'g',
        averageCost: 0.005,
        itemType: 'raw_material',
        productionState: 'raw',
        isByproduct: false,
        compatibleOperations: ['geral'],
        isActive: true
    });

    logDetail('Gordura', `byproduct, compatible=${JSON.stringify(gordura.compatibleOperations)}`);
    logDetail('Espetinho', `prepared, compatible=${JSON.stringify(espetinho.compatibleOperations)}`);
    logDetail('Waste', `byproduct, productionState=waste`);
    logDetail('Farinha', `raw_material, for central→store regression`);

    // ========== SETUP — STOCK LOCATIONS ==========
    logSection('Setup — Stock Locations');

    const barLocation = await StockLocation.getOrCreateStoreLocation(barStore._id, barStore.name);
    const hamburgueriaLocation = await StockLocation.getOrCreateStoreLocation(hamburgueriaStore._id, hamburgueriaStore.name);
    const pizzariaLocation = await StockLocation.getOrCreateStoreLocation(pizzariaStore._id, pizzariaStore.name);

    logDetail('Bar location', `${barLocation.name} (type=${barLocation.type})`);
    logDetail('Hamburgueria location', `${hamburgueriaLocation.name} (type=${hamburgueriaLocation.type})`);
    logDetail('Pizzaria location', `${pizzariaLocation.name} (type=${pizzariaLocation.type})`);

    // Central warehouse para regressão
    let centralLocation = await StockLocation.findOne({ type: 'CENTRAL_WAREHOUSE', store: null });
    if (!centralLocation) {
        centralLocation = await StockLocation.create({
            name: 'Central Warehouse PHASE5_1D',
            type: 'CENTRAL_WAREHOUSE',
            store: null,
            description: 'Shared central warehouse for testing',
            isActive: true
        });
    }

    logDetail('Central location', `${centralLocation.name} (type=${centralLocation.type}, store=${centralLocation.store})`);

    // ========== SETUP — STOCK BALANCES ==========
    logSection('Setup — Stock Balances');

    // Bar: 2000g de gordura
    const gorduraBalBar = await StockBalance.create({
        store: barStore._id,
        location: barLocation._id,
        ingredient: gordura._id,
        balance: 2000,
        reserved: 0,
        unit: 'g',
        metadata: { test_phase5_1d: true }
    });
    logDetail('Gordura no Bar', `2000g`);

    // Bar: 500g de espetinho
    const espetinhoBalBar = await StockBalance.create({
        store: barStore._id,
        location: barLocation._id,
        ingredient: espetinho._id,
        balance: 500,
        reserved: 0,
        unit: 'g',
        metadata: { test_phase5_1d: true }
    });
    logDetail('Espetinho no Bar', `500g`);

    // Bar: 300g de waste
    const wasteBalBar = await StockBalance.create({
        store: barStore._id,
        location: barLocation._id,
        ingredient: wasteItem._id,
        balance: 300,
        reserved: 0,
        unit: 'g',
        metadata: { test_phase5_1d: true }
    });
    logDetail('Waste no Bar', `300g`);

    // Central: 5000g de farinha (para regressão)
    const farinhaBalCentral = await StockBalance.create({
        store: null,
        location: centralLocation._id,
        ingredient: farinha._id,
        balance: 5000,
        reserved: 0,
        unit: 'g',
        metadata: { test_phase5_1d: true }
    });
    logDetail('Farinha no Central', `5000g`);

    // ========== CENÁRIO A — Bar → Hamburgueria (gordura 2kg) ==========
    logSection('Cenário A — Bar → Hamburgueria (gordura bovina 2kg)');

    logDetail('Gordura Bar antes', `${gorduraBalBar.balance}g`);

    const resultA = await interStoreTransferService.createInterStoreTransfer({
        originStoreId: barStore._id,
        destinationStoreId: hamburgueriaStore._id,
        originLocationId: barLocation._id,
        destinationLocationId: hamburgueriaLocation._id,
        ingredientId: gordura._id,
        quantity: 2000,
        unit: 'g',
        reason: 'Subproduto reaproveitável para blend de hambúrguer',
        userId: testUser._id
    });

    assert(resultA.success === true, 'Transfer success', resultA.success);
    assert(resultA.transferScope === 'inter_store', 'Transfer scope', resultA.transferScope);
    assert(resultA.origin.balanceBefore === 2000, 'Origin balance before', resultA.origin.balanceBefore);
    assert(resultA.origin.balanceAfter === 0, 'Origin balance after', resultA.origin.balanceAfter);
    assert(resultA.destination.balanceBefore === 0, 'Dest balance before', resultA.destination.balanceBefore);
    assert(resultA.destination.balanceAfter === 2000, 'Dest balance after', resultA.destination.balanceAfter);
    assert(resultA.ingredient.name.includes('Gordura'), 'Ingredient name', resultA.ingredient.name);
    assert(resultA.ingredient.itemType === 'byproduct', 'Ingredient itemType', resultA.ingredient.itemType);
    assert(resultA.ingredient.isByproduct === true, 'Ingredient isByproduct', resultA.ingredient.isByproduct);
    assert(resultA.compatibility.destinationOperationType === 'hamburgueria', 'Dest operation type', resultA.compatibility.destinationOperationType);
    assert(resultA.compatibility.isCompatible === true, 'Compatibility check', resultA.compatibility.isCompatible);

    // Verificar saldos no banco
    const gorduraBalAfter = await StockBalance.findOne({ location: barLocation._id, ingredient: gordura._id });
    const gorduraBalDest = await StockBalance.findOne({ location: hamburgueriaLocation._id, ingredient: gordura._id });

    assert(gorduraBalAfter.balance === 0, 'Bar balance in DB', `${gorduraBalAfter.balance}g`);
    assert(gorduraBalDest.balance === 2000, 'Hamburgueria balance in DB', `${gorduraBalDest.balance}g`);

    // Verificar movimentos
    const transferOutMov = await StockMovement.findById(resultA.movements.transferOut);
    const transferInMov = await StockMovement.findById(resultA.movements.transferIn);

    assert(transferOutMov.type === 'transfer_out', 'Transfer out type', transferOutMov.type);
    assert(transferInMov.type === 'transfer_in', 'Transfer in type', transferInMov.type);
    assert(transferOutMov.metadata.transferScope === 'inter_store', 'Transfer out scope metadata', transferOutMov.metadata.transferScope);
    assert(transferInMov.metadata.transferScope === 'inter_store', 'Transfer in scope metadata', transferInMov.metadata.transferScope);
    assert(transferOutMov.metadata.originStoreId === barStore._id.toString(), 'Transfer out origin store', transferOutMov.metadata.originStoreId);
    assert(transferOutMov.metadata.destinationStoreId === hamburgueriaStore._id.toString(), 'Transfer out dest store', transferOutMov.metadata.destinationStoreId);
    assert(transferOutMov.store.toString() === barStore._id.toString(), 'Transfer out store ref', transferOutMov.store);
    assert(transferInMov.store.toString() === hamburgueriaStore._id.toString(), 'Transfer in store ref', transferInMov.store);
    assert(transferOutMov.originLocation.toString() === barLocation._id.toString(), 'Transfer out origin location', transferOutMov.originLocation);
    assert(transferOutMov.destinationLocation.toString() === hamburgueriaLocation._id.toString(), 'Transfer out dest location', transferOutMov.destinationLocation);

    logDetail('Movimento transfer_out', `type=${transferOutMov.type}, qty=${transferOutMov.quantity}g, store=${transferOutMov.store}`);
    logDetail('Movimento transfer_in', `type=${transferInMov.type}, qty=${transferInMov.quantity}g, store=${transferInMov.store}`);

    // ========== CENÁRIO B — Item incompatível bloqueado ==========
    logSection('Cenário B — Item incompatível bloqueado (espetinho → hamburgueria)');

    const balBefore_B_origin = await StockBalance.findOne({ location: barLocation._id, ingredient: espetinho._id });
    const balBefore_B_dest = await StockBalance.findOne({ location: hamburgueriaLocation._id, ingredient: espetinho._id });
    const movBefore_B = await StockMovement.countDocuments({
        store: { $in: [barStore._id, hamburgueriaStore._id] },
        ingredient: espetinho._id,
        'metadata.transferScope': 'inter_store'
    });

    try {
        await interStoreTransferService.createInterStoreTransfer({
            originStoreId: barStore._id,
            destinationStoreId: hamburgueriaStore._id,
            originLocationId: barLocation._id,
            destinationLocationId: hamburgueriaLocation._id,
            ingredientId: espetinho._id,
            quantity: 200,
            unit: 'g',
            reason: 'Test incompatible transfer',
            userId: testUser._id
        });
        assert(false, 'Incompatible transfer', 'Should have thrown error');
    } catch (error) {
        assert(error.message.includes('not compatible') || error.message.includes('compatible'), 'Incompatible block error', error.message);
    }

    // Verificar que nada mudou
    const balAfter_B_origin = await StockBalance.findOne({ location: barLocation._id, ingredient: espetinho._id });
    const balAfter_B_dest = await StockBalance.findOne({ location: hamburgueriaLocation._id, ingredient: espetinho._id });
    const movAfter_B = await StockMovement.countDocuments({
        store: { $in: [barStore._id, hamburgueriaStore._id] },
        ingredient: espetinho._id,
        'metadata.transferScope': 'inter_store'
    });

    assert(balAfter_B_origin.balance === balBefore_B_origin.balance, 'Origin balance unchanged', `${balAfter_B_origin.balance}g (before=${balBefore_B_origin.balance}g)`);
    assert(!balAfter_B_dest || balAfter_B_dest.balance === (balBefore_B_dest?.balance || 0), 'Dest balance unchanged', `${balAfter_B_dest?.balance || 0}g`);
    assert(movAfter_B === movBefore_B, 'No movements created', `${movAfter_B} (before=${movBefore_B})`);

    // ========== CENÁRIO C — Rollback em falha ==========
    logSection('Cenário C — Rollback em falha (estoque insuficiente)');

    const gorduraBalBar_C = await StockBalance.findOne({ location: barLocation._id, ingredient: gordura._id });
    const gorduraBalHamb_C = await StockBalance.findOne({ location: hamburgueriaLocation._id, ingredient: gordura._id });

    // Bar tem 0g de gordura agora — tentar transferir 500g deve falhar
    try {
        await interStoreTransferService.createInterStoreTransfer({
            originStoreId: barStore._id,
            destinationStoreId: hamburgueriaStore._id,
            originLocationId: barLocation._id,
            destinationLocationId: hamburgueriaLocation._id,
            ingredientId: gordura._id,
            quantity: 500,
            unit: 'g',
            reason: 'Test insufficient stock',
            userId: testUser._id
        });
        assert(false, 'Insufficient stock', 'Should have thrown error');
    } catch (error) {
        assert(error.message.includes('Insufficient stock'), 'Insufficient stock error', error.message);
    }

    // Verificar rollback
    const gorduraBalBar_C_after = await StockBalance.findOne({ location: barLocation._id, ingredient: gordura._id });
    const gorduraBalHamb_C_after = await StockBalance.findOne({ location: hamburgueriaLocation._id, ingredient: gordura._id });

    assert(gorduraBalBar_C_after.balance === gorduraBalBar_C.balance, 'Rollback: origin unchanged', `${gorduraBalBar_C_after.balance}g (before=${gorduraBalBar_C.balance}g)`);
    assert(gorduraBalHamb_C_after.balance === gorduraBalHamb_C.balance, 'Rollback: dest unchanged', `${gorduraBalHamb_C_after.balance}g (before=${gorduraBalHamb_C.balance}g)`);

    // ========== CENÁRIO D — Mesma loja bloqueada ==========
    logSection('Cenário D — Mesma loja bloqueada');

    // Adicionar mais gordura ao Bar para ter saldo
    gorduraBalBar_C.balance += 1000;
    await gorduraBalBar_C.save();

    try {
        await interStoreTransferService.createInterStoreTransfer({
            originStoreId: barStore._id,
            destinationStoreId: barStore._id, // mesma loja!
            originLocationId: barLocation._id,
            destinationLocationId: barLocation._id,
            ingredientId: gordura._id,
            quantity: 500,
            unit: 'g',
            reason: 'Test same store',
            userId: testUser._id
        });
        assert(false, 'Same store block', 'Should have thrown error');
    } catch (error) {
        assert(error.message.includes('different') || error.message.includes('same'), 'Same store error', error.message);
    }

    // ========== CENÁRIO E — Central → Loja funciona (regressão) ==========
    logSection('Cenário E — Central → Loja (regressão transferService)');

    // Create isolated store + location for regression test to avoid stale data
    const regressionStore = await Store.create({
        name: 'Regression Test 5.1D',
        phone: '444444444',
        email: 'regression@test51d.com',
        cnpj: '44.444.444/0001-44',
        operationType: 'geral',
        isActive: true
    });
    const regressionLocation = await StockLocation.getOrCreateStoreLocation(regressionStore._id, regressionStore.name);

    // Add farinha balance to central
    const farinhaBalCentral_E = await StockBalance.findOne({ location: centralLocation._id, ingredient: farinha._id });
    if (!farinhaBalCentral_E || farinhaBalCentral_E.balance < 1000) {
        if (farinhaBalCentral_E) {
            farinhaBalCentral_E.balance = Math.max(farinhaBalCentral_E.balance, 5000);
            await farinhaBalCentral_E.save();
        } else {
            await StockBalance.create({
                store: null,
                location: centralLocation._id,
                ingredient: farinha._id,
                balance: 5000,
                reserved: 0,
                unit: 'g',
                metadata: { test_phase5_1d: true }
            });
        }
    }
    logDetail('Farinha no Central antes', `${(await StockBalance.findOne({ location: centralLocation._id, ingredient: farinha._id })).balance}g`);

    const resultE = await transferService.createTransfer({
        storeId: regressionStore._id,
        originLocationId: centralLocation._id,
        destinationLocationId: regressionLocation._id,
        ingredientId: farinha._id,
        quantity: 1000,
        unit: 'g',
        reason: 'Regression test: central → store',
        userId: testUser._id
    });

    assert(resultE.success === true, 'Central→store success', resultE.success);
    assert(resultE.origin.balanceAfter === 4000, 'Central balance after', resultE.origin.balanceAfter);
    assert(resultE.destination.balanceAfter === 1000, 'Regression store flour balance', resultE.destination.balanceAfter);
    assert(resultE.destination.storeId === regressionStore._id.toString(), 'Destination store ref', resultE.destination.storeId);

    // ========== VALIDAÇÕES ADICIONAIS ==========
    logSection('Validações adicionais');

    // 1. Waste bloqueado
    try {
        await interStoreTransferService.createInterStoreTransfer({
            originStoreId: barStore._id,
            destinationStoreId: hamburgueriaStore._id,
            originLocationId: barLocation._id,
            destinationLocationId: hamburgueriaLocation._id,
            ingredientId: wasteItem._id,
            quantity: 100,
            unit: 'g',
            reason: 'Test waste block',
            userId: testUser._id
        });
        assert(false, 'Waste block', 'Should have thrown error');
    } catch (error) {
        assert(error.message.includes('waste'), 'Waste block error', error.message);
    }

    // 2. Location type não-STORE bloqueada
    try {
        await interStoreTransferService.createInterStoreTransfer({
            originStoreId: barStore._id,
            destinationStoreId: hamburgueriaStore._id,
            originLocationId: centralLocation._id, // CENTRAL_WAREHOUSE, não STORE
            destinationLocationId: hamburgueriaLocation._id,
            ingredientId: gordura._id,
            quantity: 100,
            unit: 'g',
            reason: 'Test non-STORE origin',
            userId: testUser._id
        });
        assert(false, 'Non-STORE origin block', 'Should have thrown error');
    } catch (error) {
        assert(error.message.includes('STORE'), 'Non-STORE origin error', error.message);
    }

    // 3. Quantidade negativa
    try {
        await interStoreTransferService.createInterStoreTransfer({
            originStoreId: barStore._id,
            destinationStoreId: hamburgueriaStore._id,
            originLocationId: barLocation._id,
            destinationLocationId: hamburgueriaLocation._id,
            ingredientId: gordura._id,
            quantity: -100,
            unit: 'g',
            reason: 'Test negative qty',
            userId: testUser._id
        });
        assert(false, 'Negative qty block', 'Should have thrown error');
    } catch (error) {
        assert(error.message.includes('positive'), 'Negative qty error', error.message);
    }

    // 4. Same location IDs
    try {
        await interStoreTransferService.createInterStoreTransfer({
            originStoreId: barStore._id,
            destinationStoreId: hamburgueriaStore._id,
            originLocationId: barLocation._id,
            destinationLocationId: barLocation._id, // mesma location!
            ingredientId: gordura._id,
            quantity: 100,
            unit: 'g',
            reason: 'Test same location',
            userId: testUser._id
        });
        assert(false, 'Same location block', 'Should have thrown error');
    } catch (error) {
        assert(error.message.includes('same') || error.message.includes('cannot be the same'), 'Same location error', error.message);
    }

    // 5. Validação — listAvailableStores
    const availableStores = await interStoreTransferService.listAvailableStores();
    assert(availableStores.length >= 3, 'List stores count', `${availableStores.length} stores`);
    const barFound = availableStores.find(s => s.operationType === 'bar');
    assert(barFound !== undefined, 'Bar store with operationType=bar in list', barFound ? `${barFound.name} (${barFound.operationType})` : 'not found');

    // 6. Validação — validateInterStoreTransfer (valid case)
    // Adicionar gordura ao Bar para validação passar
    const gorduraForValidation = await StockBalance.findOne({ location: barLocation._id, ingredient: gordura._id });
    if (gorduraForValidation.balance < 500) {
        gorduraForValidation.balance = 1000;
        await gorduraForValidation.save();
    }

    const validation = await interStoreTransferService.validateInterStoreTransfer({
        originStoreId: barStore._id,
        destinationStoreId: hamburgueriaStore._id,
        originLocationId: barLocation._id,
        destinationLocationId: hamburgueriaLocation._id,
        ingredientId: gordura._id,
        quantity: 500
    });

    assert(validation.valid === true, 'Valid transfer', validation.valid);
    assert(validation.compatibility.destinationOperationType === 'hamburgueria', 'Validation compatibility', validation.compatibility.destinationOperationType);

    // 7. Validação — validateInterStoreTransfer (incompatible)
    const validationIncompatible = await interStoreTransferService.validateInterStoreTransfer({
        originStoreId: barStore._id,
        destinationStoreId: hamburgueriaStore._id,
        originLocationId: barLocation._id,
        destinationLocationId: hamburgueriaLocation._id,
        ingredientId: espetinho._id,
        quantity: 100
    });

    assert(validationIncompatible.valid === false, 'Invalid transfer blocked', validationIncompatible.valid);
    assert(validationIncompatible.reason.includes('compatible'), 'Incompatibility reason', validationIncompatible.reason);

    // 8. Validação — operationType field existe no Store
    const storeWithOpType = await Store.findById(barStore._id);
    assert(storeWithOpType.operationType === 'bar', 'Store operationType', storeWithOpType.operationType);

    // 9. Validação — metadata.transferScope nos movimentos existentes
    const interStoreMovCount = await StockMovement.countDocuments({ 'metadata.transferScope': 'inter_store' });
    assert(interStoreMovCount >= 2, 'Inter-store movements created', `${interStoreMovCount} movements`);

    // 10. Validação — GlobalIngredient campos Phase 5.1A
    const gorduraDoc = await GlobalIngredient.findById(gordura._id);
    assert(gorduraDoc.itemType === 'byproduct', 'GI itemType', gorduraDoc.itemType);
    assert(gorduraDoc.isByproduct === true, 'GI isByproduct', gorduraDoc.isByproduct);
    assert(Array.isArray(gorduraDoc.compatibleOperations), 'GI compatibleOperations', JSON.stringify(gorduraDoc.compatibleOperations));

    // ========== CLEANUP ==========
    logSection('Cleanup');
    await GlobalIngredient.deleteMany({ name: { $regex: /PHASE5_1D/i } });
    await StockBalance.deleteMany({ 'metadata.test_phase5_1d': true });
    await StockMovement.deleteMany({ 'metadata.transferScope': 'inter_store' });
    await StockLocation.deleteMany({ name: /PHASE5_1D/i });
    console.log('  Test data cleaned');

    // ========== RESUMO ==========
    console.log('\n=== RESUMO ===');
    console.log(`Total: ${passCount + failCount} | Pass: ${passCount} | Fail: ${failCount}\n`);

    if (failCount === 0) {
        console.log('✅ Todas as validações passaram — Fase 5.1D completa');
    } else {
        console.log(`⚠️  Algumas validações FALHARAM (${failCount} de ${passCount + failCount})`);
    }

    await mongoose.disconnect();
    process.exit(failCount > 0 ? 1 : 0);
}

run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
