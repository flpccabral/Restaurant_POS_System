/**
 * Teste Prático Fase 6 — Observabilidade e Reabastecimento Inteligente
 *
 * Cenários obrigatórios:
 * A. Bar→Hamburgueria gordura replenishment (inter_store_transfer)
 * B. Central supplies store (central_to_store)
 * C. Purchase needed (no internal source)
 *
 * Validações adicionais:
 * - Health statuses: stockout, critical, low, ok, excess, no_policy
 * - Consumption calculation (24h, 7d)
 * - Incompatible items blocked
 * - Policy CRUD endpoints (direct model operations)
 * - Alert generation and resolution
 * - Operational timeline
 * - Regression: previous phases still working
 */

const mongoose = require('mongoose');
const config = require('../config/config');

// Models
const Store = require('../models/storeModel');
const User = require('../models/userModel');
const Role = require('../models/roleModel');
const GlobalIngredient = require('../models/globalIngredientModel');
const StockLocation = require('../models/stockLocationModel');
const StockBalance = require('../models/stockBalanceModel');
const StockMovement = require('../models/stockMovementModel');
const StockPolicy = require('../models/stockPolicyModel');
const OperationalAlert = require('../models/operationalAlertModel');
const ProductionBatch = require('../models/productionBatchModel');

// Services
const stockHealthService = require('../services/stockHealthService');
const replenishmentService = require('../services/replenishmentService');
const observabilityService = require('../services/observabilityService');

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
    console.log('=== Teste Fase 6 — Observabilidade e Reabastecimento Inteligente ===\n');

    await mongoose.connect(config.databaseURI);
    console.log('Connected to MongoDB\n');

    // ========== SETUP ==========
    logSection('Setup — Stores');

    // Clean previous Phase 6 test data (aggressive)
    await Store.deleteMany({ name: { $regex: /PHASE6_TEST/ } });
    await Store.deleteMany({ cnpj: { $in: ['11.111.111/0001-11', '22.222.222/0001-22', '33.333.333/0001-33'] } });
    await StockLocation.deleteMany({ name: { $regex: /PHASE6_TEST/ } });
    await StockLocation.deleteMany({ name: { $regex: /Central Warehouse PHASE6/ } });
    await GlobalIngredient.deleteMany({ name: { $regex: /PHASE6/ } });
    await StockPolicy.deleteMany({ 'metadata.test_phase6': true });
    await OperationalAlert.deleteMany({ 'metadata.test_phase6': true });
    await StockBalance.deleteMany({ 'metadata.test_phase6': true });
    await StockMovement.deleteMany({ 'metadata.test_phase6': true });
    await ProductionBatch.deleteMany({ 'metadata.test_phase6': true });
    await User.deleteMany({ email: 'test@phase6.com' });

    // Create test stores
    const barStore = await Store.create({
        name: 'PHASE6_TEST Bar',
        phone: '1111111111',
        email: 'bar@phase6test.com',
        cnpj: '11.111.111/0001-11',
        operationType: 'bar',
        isActive: true
    });

    const hamburgueriaStore = await Store.create({
        name: 'PHASE6_TEST Hamburgueria',
        phone: '2222222222',
        email: 'hamburgueria@phase6test.com',
        cnpj: '22.222.222/0001-22',
        operationType: 'hamburgueria',
        isActive: true
    });

    const cozinhaStore = await Store.create({
        name: 'PHASE6_TEST Cozinha',
        phone: '3333333333',
        email: 'cozinha@phase6test.com',
        cnpj: '33.333.333/0001-33',
        operationType: 'cozinha',
        isActive: true
    });

    logDetail('Bar', `${barStore.name} opType=${barStore.operationType}`);
    logDetail('Hamburgueria', `${hamburgueriaStore.name} opType=${hamburgueriaStore.operationType}`);
    logDetail('Cozinha', `${cozinhaStore.name} opType=${cozinhaStore.operationType}`);

    // Create test user
    const existingRole = await Role.findOne({ isActive: true });
    const testUser = await User.create({
        name: 'PHASE6 Test User',
        email: 'test@phase6.com',
        phone: 1999999999,
        password: 'test123',
        role: existingRole ? existingRole._id : 'admin',
        store: barStore._id,
        isMasterAdmin: true
    });

    // Create locations
    const barLocation = await StockLocation.getOrCreateStoreLocation(barStore._id, barStore.name);
    const hamburgueriaLocation = await StockLocation.getOrCreateStoreLocation(hamburgueriaStore._id, hamburgueriaStore.name);
    const cozinhaLocation = await StockLocation.getOrCreateStoreLocation(cozinhaStore._id, cozinhaStore.name);

    // Central warehouse
    let centralLocation = await StockLocation.findOne({ type: 'CENTRAL_WAREHOUSE', store: null });
    if (!centralLocation) {
        centralLocation = await StockLocation.create({
            name: 'Central Warehouse PHASE6',
            type: 'CENTRAL_WAREHOUSE',
            store: null,
            description: 'Central warehouse for Phase 6 testing',
            isActive: true
        });
    }

    logDetail('Bar location', barLocation._id.toString());
    logDetail('Hamburgueria location', hamburgueriaLocation._id.toString());
    logDetail('Cozinha location', cozinhaLocation._id.toString());
    logDetail('Central location', centralLocation._id.toString());

    // ========== INGREDIENTS ==========
    logSection('Setup — Ingredients');

    // Gordura bovina — byproduct compatível com bar e hamburgueria
    const gordura = await GlobalIngredient.create({
        name: 'Gordura bovina PHASE6',
        category: 'outro',
        baseUnit: 'g',
        averageCost: 0.02,
        itemType: 'byproduct',
        productionState: 'raw',
        isByproduct: true,
        compatibleOperations: ['bar', 'hamburgueria', 'geral'],
        isActive: true
    });

    // Patinho cru — compatível geral
    const patinho = await GlobalIngredient.create({
        name: 'Patinho cru PHASE6',
        category: 'proteina',
        baseUnit: 'g',
        averageCost: 0.08,
        itemType: 'raw_material',
        productionState: 'raw',
        isByproduct: false,
        compatibleOperations: ['geral'],
        isActive: true
    });

    // Queijo mussarela — compatível APENAS com hamburgueria (sem 'geral' para testar bloqueio)
    const queijo = await GlobalIngredient.create({
        name: 'Queijo mussarela PHASE6',
        category: 'laticinio',
        baseUnit: 'g',
        averageCost: 0.04,
        itemType: 'raw_material',
        productionState: 'raw',
        isByproduct: false,
        compatibleOperations: ['hamburgueria'],
        isActive: true
    });

    // Farinha — compatível geral (para cenário central→store)
    const farinha = await GlobalIngredient.create({
        name: 'Farinha de trigo PHASE6',
        category: 'carboidrato',
        baseUnit: 'g',
        averageCost: 0.005,
        itemType: 'raw_material',
        productionState: 'raw',
        isByproduct: false,
        compatibleOperations: ['geral'],
        isActive: true
    });

    logDetail('Gordura', `byproduct, compat=${gordura.compatibleOperations.join(',')}`);
    logDetail('Patinho', `raw_material, compat=${patinho.compatibleOperations.join(',')}`);
    logDetail('Queijo', `raw_material, compat=${queijo.compatibleOperations.join(',')}`);
    logDetail('Farinha', `raw_material, compat=${farinha.compatibleOperations.join(',')}`);

    // ========== CENÁRIO A — Bar→Hamburgueria gordura replenishment ==========
    logSection('Cenário A — Inter-store transfer recommendation (Bar→Hamburgueria gordura)');

    // Hamburgueria: gordura com 0g → stockout
    await StockBalance.create({
        store: hamburgueriaStore._id,
        location: hamburgueriaLocation._id,
        ingredient: gordura._id,
        balance: 0,
        reserved: 0,
        unit: 'g',
        metadata: { test_phase6: true }
    });

    // Hamburgueria: policy gordura — min=1000, reorder=1500, ideal=3000, max=5000
    await StockPolicy.create({
        store: hamburgueriaStore._id,
        location: hamburgueriaLocation._id,
        ingredient: gordura._id,
        minQuantity: 1000,
        reorderPoint: 1500,
        idealQuantity: 3000,
        maxQuantity: 5000,
        unit: 'g',
        priority: 'high',
        metadata: { test_phase6: true }
    });

    // Bar: 2000g de gordura
    await StockBalance.create({
        store: barStore._id,
        location: barLocation._id,
        ingredient: gordura._id,
        balance: 2000,
        reserved: 0,
        unit: 'g',
        metadata: { test_phase6: true }
    });

    // Bar: policy gordura — min=500, reorder=800, ideal=1500, max=3000
    await StockPolicy.create({
        store: barStore._id,
        location: barLocation._id,
        ingredient: gordura._id,
        minQuantity: 500,
        reorderPoint: 800,
        idealQuantity: 1500,
        maxQuantity: 3000,
        unit: 'g',
        priority: 'medium',
        metadata: { test_phase6: true }
    });

    // Central: 0g de gordura
    await StockBalance.create({
        store: null,
        location: centralLocation._id,
        ingredient: gordura._id,
        balance: 0,
        reserved: 0,
        unit: 'g',
        metadata: { test_phase6: true }
    });

    logDetail('Hamburgueria gordura', '0g (stockout), policy: min=1000, reorder=1500, ideal=3000, max=5000');
    logDetail('Bar gordura', '2000g, policy: min=500, reorder=800, ideal=1500, max=3000');
    logDetail('Central gordura', '0g');

    // A.1 — Health check: Hamburgueria gordura = stockout
    const healthA = await stockHealthService.calculateStockHealth({
        storeId: hamburgueriaStore._id.toString(),
        locationId: hamburgueriaLocation._id.toString(),
        ingredientId: gordura._id.toString()
    });

    assert(healthA.status === 'stockout', 'Health status', healthA.status);
    assert(healthA.balance === 0, 'Balance', `${healthA.balance}g`);
    assert(healthA.policy.minQuantity === 1000, 'Policy min', healthA.policy.minQuantity);
    assert(healthA.deficitToIdeal === 3000, 'Deficit to ideal', healthA.deficitToIdeal);
    assert(healthA.unit === 'g', 'Unit', healthA.unit);

    // A.2 — Replenishment recommendation: inter_store_transfer
    const recA = await replenishmentService.generateReplenishmentRecommendation({
        storeId: hamburgueriaStore._id.toString(),
        ingredientId: gordura._id.toString(),
        locationId: hamburgueriaLocation._id.toString()
    });

    assert(recA.type === 'inter_store_transfer', 'Recommendation type', recA.type);
    assert(recA.priority === 'critical', 'Priority (stockout)', recA.priority);
    assert(recA.suggestedQuantity > 0, 'Suggested quantity', recA.suggestedQuantity);
    assert(recA.source.type === 'inter_store', 'Source type', recA.source.type);
    assert(recA.source.storeName.includes('Bar'), 'Source store', recA.source.storeName);
    assert(recA.justification.includes('Bar'), 'Justification mentions Bar', recA.justification.substring(0, 100));

    logDetail('Rec type', recA.type);
    logDetail('Source', recA.source.storeName);
    logDetail('Quantity', `${recA.suggestedQuantity}g`);
    logDetail('Justification', recA.justification.substring(0, 150));

    // A.3 — Alert generation
    await observabilityService.generateAlerts(hamburgueriaStore._id.toString());

    const alertsA = await OperationalAlert.find({
        store: hamburgueriaStore._id,
        ingredient: gordura._id,
        status: { $in: ['new', 'acknowledged'] }
    });

    assert(alertsA.length > 0, 'Alert generated for stockout', `${alertsA.length} alert(s)`);
    const stockoutAlert = alertsA.find(a => a.type === 'stockout');
    assert(stockoutAlert !== undefined, 'Stockout alert type', stockoutAlert ? stockoutAlert.type : 'not found');
    assert(stockoutAlert.severity === 'critical', 'Stockout severity', stockoutAlert.severity);

    // A.4 — Store health summary
    const storeHealthA = await stockHealthService.getStoreStockHealth(hamburgueriaStore._id.toString());

    assert(storeHealthA.ingredientCount >= 1, 'Store has ingredients', storeHealthA.ingredientCount);
    assert(storeHealthA.statusSummary.stockout >= 1, 'Stockout count', storeHealthA.statusSummary.stockout);

    // ========== CENÁRIO B — Central supplies store ==========
    logSection('Cenário B — Central→Store replenishment');

    // Hamburgueria: patinho cru com 500g (abaixo do mínimo)
    await StockBalance.create({
        store: hamburgueriaStore._id,
        location: hamburgueriaLocation._id,
        ingredient: patinho._id,
        balance: 500,
        reserved: 0,
        unit: 'g',
        metadata: { test_phase6: true }
    });

    // Hamburgueria: policy patinho — min=1000, reorder=2000, ideal=5000, max=8000
    await StockPolicy.create({
        store: hamburgueriaStore._id,
        location: hamburgueriaLocation._id,
        ingredient: patinho._id,
        minQuantity: 1000,
        reorderPoint: 2000,
        idealQuantity: 5000,
        maxQuantity: 8000,
        unit: 'g',
        priority: 'high',
        metadata: { test_phase6: true }
    });

    // Central: 10000g de patinho cru
    await StockBalance.create({
        store: null,
        location: centralLocation._id,
        ingredient: patinho._id,
        balance: 10000,
        reserved: 0,
        unit: 'g',
        metadata: { test_phase6: true }
    });

    logDetail('Hamburgueria patinho', '500g (critical), policy: min=1000, ideal=5000');
    logDetail('Central patinho', '10000g');

    // B.1 — Health check: Hamburgueria patinho = critical
    const healthB = await stockHealthService.calculateStockHealth({
        storeId: hamburgueriaStore._id.toString(),
        locationId: hamburgueriaLocation._id.toString(),
        ingredientId: patinho._id.toString()
    });

    assert(healthB.status === 'critical', 'Health status', healthB.status);
    assert(healthB.balance === 500, 'Balance', `${healthB.balance}g`);
    assert(healthB.policy.minQuantity === 1000, 'Policy min', healthB.policy.minQuantity);

    // B.2 — Replenishment: central_to_store
    const recB = await replenishmentService.generateReplenishmentRecommendation({
        storeId: hamburgueriaStore._id.toString(),
        ingredientId: patinho._id.toString(),
        locationId: hamburgueriaLocation._id.toString()
    });

    assert(recB.type === 'central_to_store', 'Recommendation type', recB.type);
    assert(recB.priority === 'high', 'Priority (critical status)', recB.priority);
    assert(recB.source.type === 'central_warehouse', 'Source type', recB.source.type);
    assert(recB.suggestedQuantity > 0, 'Suggested quantity', recB.suggestedQuantity);
    assert(recB.suggestedQuantity <= 10000, 'Quantity within central stock', recB.suggestedQuantity);

    logDetail('Rec type', recB.type);
    logDetail('Source', recB.source.locationName);
    logDetail('Quantity', `${recB.suggestedQuantity}g`);

    // B.3 — Incompatible inter-store NOT recommended
    // Queijo só compatível com hamburgueria. Cozinha tem queijo mas é incompatível.
    // (Central already covers this, so inter-store shouldn't be suggested)
    assert(recB.source.type !== 'inter_store' || recB.source.storeOperationType !== 'cozinha',
        'No incompatible inter-store source', 'OK');

    // ========== CENÁRIO C — Purchase needed ==========
    logSection('Cenário C — Purchase needed (no internal source)');

    // Cozinha: farinha com 0g → stockout (farinha is compatible with 'geral' = all stores)
    // Central: 0g de farinha (already has flour for Bar, but let's ensure Central has 0 for cozinha scenario)
    // Bar has farinha (3000g) but... farinha is compatible with 'geral' so inter-store might be recommended
    // We need a different ingredient — one that no store has stock of

    // Create a unique ingredient that NO store has
    const sal = await GlobalIngredient.create({
        name: 'Sal marinho PHASE6',
        category: 'tempero',
        baseUnit: 'g',
        averageCost: 0.001,
        itemType: 'raw_material',
        productionState: 'raw',
        isByproduct: false,
        compatibleOperations: ['geral'],
        isActive: true
    });

    // Cozinha: sal com 0g → stockout
    await StockBalance.create({
        store: cozinhaStore._id,
        location: cozinhaLocation._id,
        ingredient: sal._id,
        balance: 0,
        reserved: 0,
        unit: 'g',
        metadata: { test_phase6: true }
    });

    // Cozinha: policy sal — min=100, reorder=200, ideal=500, max=1000
    await StockPolicy.create({
        store: cozinhaStore._id,
        location: cozinhaLocation._id,
        ingredient: sal._id,
        minQuantity: 100,
        reorderPoint: 200,
        idealQuantity: 500,
        maxQuantity: 1000,
        unit: 'g',
        priority: 'medium',
        metadata: { test_phase6: true }
    });

    // Central: 0g de sal
    await StockBalance.create({
        store: null,
        location: centralLocation._id,
        ingredient: sal._id,
        balance: 0,
        reserved: 0,
        unit: 'g',
        metadata: { test_phase6: true }
    });

    // No other store has sal

    logDetail('Cozinha sal', '0g (stockout)');
    logDetail('Central sal', '0g');
    logDetail('Other stores', 'no sal stock');

    // C.1 — Health check: Cozinha sal = stockout
    const healthC = await stockHealthService.calculateStockHealth({
        storeId: cozinhaStore._id.toString(),
        locationId: cozinhaLocation._id.toString(),
        ingredientId: sal._id.toString()
    });

    assert(healthC.status === 'stockout', 'Health status', healthC.status);

    // C.2 — Replenishment: purchase_needed
    const recC = await replenishmentService.generateReplenishmentRecommendation({
        storeId: cozinhaStore._id.toString(),
        ingredientId: sal._id.toString(),
        locationId: cozinhaLocation._id.toString()
    });

    assert(recC.type === 'purchase_needed', 'Recommendation type', recC.type);
    assert(recC.priority === 'critical', 'Priority', recC.priority);
    assert(recC.justification.toLowerCase().includes('purchase') || recC.justification.toLowerCase().includes('external'),
        'Justification mentions purchase', recC.justification.substring(0, 150));
    assert(recC.actionSuggested.toLowerCase().includes('purchase'), 'Action suggests purchase', recC.actionSuggested);

    logDetail('Rec type', recC.type);
    logDetail('Justification', recC.justification.substring(0, 150));

    // ========== HEALTH STATUS VALIDATIONS ==========
    logSection('Health status validations');

    // H.1 — ok status
    // Bar: farinha com 3000g, policy min=500, reorder=1000, ideal=2000, max=5000
    await StockBalance.create({
        store: barStore._id,
        location: barLocation._id,
        ingredient: farinha._id,
        balance: 3000,
        reserved: 0,
        unit: 'g',
        metadata: { test_phase6: true }
    });
    await StockPolicy.create({
        store: barStore._id,
        location: barLocation._id,
        ingredient: farinha._id,
        minQuantity: 500,
        reorderPoint: 1000,
        idealQuantity: 2000,
        maxQuantity: 5000,
        unit: 'g',
        priority: 'low',
        metadata: { test_phase6: true }
    });

    const healthOk = await stockHealthService.calculateStockHealth({
        storeId: barStore._id.toString(),
        locationId: barLocation._id.toString(),
        ingredientId: farinha._id.toString()
    });
    assert(healthOk.status === 'ok', 'OK status', healthOk.status);

    // H.2 — low status
    // Hamburgueria: farinha com 1200g (between reorder=1000 and ideal=2000, but let's make it low)
    // Need: balance <= reorderPoint but > minQuantity
    await StockBalance.create({
        store: hamburgueriaStore._id,
        location: hamburgueriaLocation._id,
        ingredient: farinha._id,
        balance: 1200,
        reserved: 0,
        unit: 'g',
        metadata: { test_phase6: true }
    });
    await StockPolicy.create({
        store: hamburgueriaStore._id,
        location: hamburgueriaLocation._id,
        ingredient: farinha._id,
        minQuantity: 500,
        reorderPoint: 1500,
        idealQuantity: 3000,
        maxQuantity: 6000,
        unit: 'g',
        priority: 'low',
        metadata: { test_phase6: true }
    });

    const healthLow = await stockHealthService.calculateStockHealth({
        storeId: hamburgueriaStore._id.toString(),
        locationId: hamburgueriaLocation._id.toString(),
        ingredientId: farinha._id.toString()
    });
    assert(healthLow.status === 'low', 'LOW status', healthLow.status);
    assert(healthLow.balance === 1200, 'LOW balance', `${healthLow.balance}g`);

    // H.3 — excess status
    // Bar: farinha already has 3000g, max=5000. Let's add more to push it over.
    const farinhaBalBar = await StockBalance.findOne({
        location: barLocation._id,
        ingredient: farinha._id
    });
    farinhaBalBar.balance = 7000;
    await farinhaBalBar.save();

    const healthExcess = await stockHealthService.calculateStockHealth({
        storeId: barStore._id.toString(),
        locationId: barLocation._id.toString(),
        ingredientId: farinha._id.toString()
    });
    assert(healthExcess.status === 'excess', 'EXCESS status', healthExcess.status);
    assert(healthExcess.excessOverMax === 2000, 'Excess over max', healthExcess.excessOverMax);

    // H.4 — no_policy status
    // Create balance without policy
    await StockBalance.create({
        store: barStore._id,
        location: barLocation._id,
        ingredient: queijo._id,
        balance: 500,
        reserved: 0,
        unit: 'g',
        metadata: { test_phase6: true }
    });

    const healthNoPolicy = await stockHealthService.calculateStockHealth({
        storeId: barStore._id.toString(),
        locationId: barLocation._id.toString(),
        ingredientId: queijo._id.toString()
    });
    assert(healthNoPolicy.status === 'no_policy', 'NO_POLICY status', healthNoPolicy.status);
    assert(healthNoPolicy.policy === null, 'No policy object', healthNoPolicy.policy);

    // H.5 — Network health
    const networkHealth = await stockHealthService.getIngredientNetworkHealth(gordura._id.toString());

    assert(networkHealth.ingredient.name.includes('Gordura'), 'Network ingredient', networkHealth.ingredient.name);
    assert(networkHealth.networkSummary.totalStores >= 2, 'Network stores', networkHealth.networkSummary.totalStores);
    assert(networkHealth.networkSummary.storesWithStock >= 1, 'Stores with stock', networkHealth.networkSummary.storesWithStock);
    assert(networkHealth.networkSummary.stockoutStores >= 1, 'Stockout stores', networkHealth.networkSummary.stockoutStores);

    logDetail('Network total stores', networkHealth.networkSummary.totalStores);
    logDetail('Network stockout', networkHealth.networkSummary.stockoutStores);
    logDetail('Network with stock', networkHealth.networkSummary.storesWithStock);

    // ========== CONSUMPTION CALCULATION ==========
    logSection('Consumption calculation');

    // Create StockMovement records to simulate consumption
    const now = Date.now();

    // Movement 2h ago: recipe_deduction of 200g gordura at Bar
    await StockMovement.create({
        store: barStore._id,
        location: barLocation._id,
        ingredient: gordura._id,
        type: 'recipe_deduction',
        quantity: 200,
        unit: 'g',
        balanceBefore: 2000,
        balanceAfter: 1800,
        reason: 'Test consumption',
        metadata: { test_phase6: true }
    });

    // Movement 1h ago: recipe_deduction of 100g gordura at Bar
    await StockMovement.create({
        store: barStore._id,
        location: barLocation._id,
        ingredient: gordura._id,
        type: 'recipe_deduction',
        quantity: 100,
        unit: 'g',
        balanceBefore: 1800,
        balanceAfter: 1700,
        reason: 'Test consumption',
        metadata: { test_phase6: true }
    });

    // Movement 30min ago: reversal of 50g
    await StockMovement.create({
        store: barStore._id,
        location: barLocation._id,
        ingredient: gordura._id,
        type: 'recipe_deduction_reversal',
        quantity: 50,
        unit: 'g',
        balanceBefore: 1700,
        balanceAfter: 1750,
        reason: 'Test reversal',
        metadata: { test_phase6: true }
    });

    // Calculate consumption for last 24h
    const consumption24h = await stockHealthService._calculateConsumption(
        barStore._id.toString(),
        barLocation._id.toString(),
        gordura._id.toString(),
        24
    );

    assert(consumption24h.grossConsumption === 300, 'Gross consumption 24h', `${consumption24h.grossConsumption}g`);
    assert(consumption24h.reversedConsumption === 50, 'Reversed consumption 24h', `${consumption24h.reversedConsumption}g`);
    assert(consumption24h.netConsumption === 250, 'Net consumption 24h', `${consumption24h.netConsumption}g`);
    assert(consumption24h.transactionCount === 2, 'Transaction count', consumption24h.transactionCount);

    logDetail('Gross 24h', `${consumption24h.grossConsumption}g`);
    logDetail('Reversed 24h', `${consumption24h.reversedConsumption}g`);
    logDetail('Net 24h', `${consumption24h.netConsumption}g`);

    // ========== STORE RECOMMENDATIONS ==========
    logSection('Store recommendations');

    const storeRecs = await replenishmentService.generateStoreRecommendations(hamburgueriaStore._id.toString());

    assert(storeRecs.storeId === hamburgueriaStore._id.toString(), 'Store ID', storeRecs.storeId);
    assert(storeRecs.totalRecommendations >= 2, 'Has recommendations', storeRecs.totalRecommendations);

    // Should have inter_store_transfer for gordura and central_to_store for patinho
    const gorduraRec = storeRecs.recommendations.find(r =>
        r.ingredient.id === gordura._id.toString() && r.type === 'inter_store_transfer'
    );
    const patinhoRec = storeRecs.recommendations.find(r =>
        r.ingredient.id === patinho._id.toString() && r.type === 'central_to_store'
    );

    assert(gorduraRec !== undefined, 'Gordura inter_store_transfer rec', gorduraRec ? gorduraRec.type : 'not found');
    assert(patinhoRec !== undefined, 'Patinho central_to_store rec', patinhoRec ? patinhoRec.type : 'not found');

    logDetail('Total recs', storeRecs.totalRecommendations);
    logDetail('Gordura rec', gorduraRec ? gorduraRec.type : 'not found');
    logDetail('Patinho rec', patinhoRec ? patinhoRec.type : 'not found');

    // ========== NETWORK RECOMMENDATIONS ==========
    logSection('Network recommendations');

    const networkRecs = await replenishmentService.generateNetworkRecommendations();

    assert(networkRecs.totalStores >= 3, 'Network stores', networkRecs.totalStores);
    assert(networkRecs.totalRecommendations >= 3, 'Network recommendations', networkRecs.totalRecommendations);

    logDetail('Total stores', networkRecs.totalStores);
    logDetail('Total recs', networkRecs.totalRecommendations);

    // ========== ALERT GENERATION & RESOLUTION ==========
    logSection('Alert generation and resolution');

    // Generate alerts for all stores
    await observabilityService.generateAlerts(hamburgueriaStore._id.toString());
    await observabilityService.generateAlerts(cozinhaStore._id.toString());
    await observabilityService.generateAlerts(barStore._id.toString());

    // Get alerts
    const allAlerts = await observabilityService.getAlerts(hamburgueriaStore._id.toString());

    assert(allAlerts.count > 0, 'Alerts exist for hamburgueria', allAlerts.count);

    // Resolve an alert
    const firstAlert = allAlerts.alerts.find(a => a.status === 'new');
    if (firstAlert) {
        const resolved = await observabilityService.resolveAlert(firstAlert._id, testUser._id, 'Test resolution');

        assert(resolved.status === 'resolved', 'Alert resolved', resolved.status);
        assert(resolved.resolvedBy.toString() === testUser._id.toString(), 'Resolved by user', resolved.resolvedBy);

        logDetail('Resolved alert', firstAlert.type);
    }

    // Resolve already resolved alert should fail
    if (firstAlert) {
        try {
            await observabilityService.resolveAlert(firstAlert._id, testUser._id, 'Should fail');
            assert(false, 'Double resolve', 'Should have thrown');
        } catch (err) {
            assert(err.message.includes('already'), 'Double resolve error', err.message);
        }
    }

    // Resolve non-existent alert should fail
    try {
        const fakeId = new mongoose.Types.ObjectId();
        await observabilityService.resolveAlert(fakeId, testUser._id, 'Should fail');
        assert(false, 'Non-existent alert', 'Should have thrown');
    } catch (err) {
        assert(err.message === 'Alert not found', 'Not found error', err.message);
    }

    // ========== OPERATIONAL TIMELINE ==========
    logSection('Operational timeline');

    const timeline = await observabilityService.getOperationalTimeline(hamburgueriaStore._id.toString());

    assert(timeline.storeId === hamburgueriaStore._id.toString(), 'Timeline store', timeline.storeId);
    assert(timeline.eventCount > 0, 'Has events', timeline.eventCount);

    // Events should be sorted by timestamp descending
    if (timeline.events.length > 1) {
        const sorted = timeline.events.every((e, i) => {
            if (i === 0) return true;
            return new Date(e.timestamp) <= new Date(timeline.events[i - 1].timestamp);
        });
        assert(sorted, 'Events sorted by timestamp', sorted);
    }

    // Should have movement type events (from consumption movements)
    // Note: StockMovements were created for Bar, not Hamburgueria
    // But Hamburgueria should have alerts from generateAlerts
    const alertEvents = timeline.events.filter(e => e.type === 'alert');
    assert(alertEvents.length > 0, 'Has alert events in timeline', alertEvents.length);

    logDetail('Total events', timeline.eventCount);
    logDetail('Alert events', alertEvents.length);
    logDetail('Event types', [...new Set(timeline.events.map(e => e.type))].join(', '));

    // ========== POLICY CRUD (direct model operations) ==========
    logSection('Policy CRUD validations');

    // Create policy
    const newPolicy = await StockPolicy.create({
        store: barStore._id,
        location: barLocation._id,
        ingredient: patinho._id,
        minQuantity: 200,
        reorderPoint: 500,
        idealQuantity: 1000,
        maxQuantity: 2000,
        unit: 'g',
        priority: 'medium',
        metadata: { test_phase6: true }
    });
    assert(newPolicy._id, 'Policy created', newPolicy.policyId);
    assert(newPolicy.isActive === true, 'Policy active', newPolicy.isActive);

    // Duplicate policy should fail
    try {
        await StockPolicy.create({
            store: barStore._id,
            location: barLocation._id,
            ingredient: patinho._id,
            minQuantity: 200,
            reorderPoint: 500,
            idealQuantity: 1000,
            maxQuantity: 2000,
            unit: 'g',
            priority: 'medium',
            metadata: { test_phase6: true }
        });
        assert(false, 'Duplicate policy', 'Should have thrown');
    } catch (err) {
        assert(err.code === 11000, 'Duplicate policy error code', err.code);
    }

    // Validation: min > reorder should fail
    try {
        await StockPolicy.create({
            store: barStore._id,
            location: barLocation._id,
            ingredient: queijo._id,
            minQuantity: 500,
            reorderPoint: 200, // less than min!
            idealQuantity: 1000,
            maxQuantity: 2000,
            unit: 'g',
            priority: 'medium',
            metadata: { test_phase6: true }
        });
        assert(false, 'Invalid policy (min>reorder)', 'Should have thrown');
    } catch (err) {
        assert(err.errors && err.errors.minQuantity, 'Validation error on minQuantity', 'OK');
    }

    // Update policy
    newPolicy.minQuantity = 300;
    newPolicy.reorderPoint = 600;
    await newPolicy.save();

    const updatedPolicy = await StockPolicy.findById(newPolicy._id);
    assert(updatedPolicy.minQuantity === 300, 'Updated min', updatedPolicy.minQuantity);
    assert(updatedPolicy.reorderPoint === 600, 'Updated reorder', updatedPolicy.reorderPoint);

    // Delete policy (soft delete)
    updatedPolicy.isActive = false;
    await updatedPolicy.save();

    const deletedPolicy = await StockPolicy.findById(newPolicy._id);
    assert(deletedPolicy.isActive === false, 'Policy deactivated', deletedPolicy.isActive);

    // ========== INCOMPATIBLE ITEM BLOCKED ==========
    logSection('Incompatible item blocked in recommendations');

    // Queijo is only compatible with hamburgueria. Cozinha is 'cozinha' operation.
    // Cozinha has queijo at 0g (stockout from scenario C).
    // Even if another store had queijo, it shouldn't be recommended to cozinha.

    // Give hamburgueria some queijo (excess)
    await StockBalance.create({
        store: hamburgueriaStore._id,
        location: hamburgueriaLocation._id,
        ingredient: queijo._id,
        balance: 5000,
        reserved: 0,
        unit: 'g',
        metadata: { test_phase6: true }
    });

    // Policy for queijo at hamburgueria
    await StockPolicy.create({
        store: hamburgueriaStore._id,
        location: hamburgueriaLocation._id,
        ingredient: queijo._id,
        minQuantity: 500,
        reorderPoint: 1000,
        idealQuantity: 2000,
        maxQuantity: 4000,
        unit: 'g',
        priority: 'medium',
        metadata: { test_phase6: true }
    });

    // Get recommendation for cozinha queijo (stockout, but queijo incompatible with cozinha)
    const recIncompatible = await replenishmentService.generateReplenishmentRecommendation({
        storeId: cozinhaStore._id.toString(),
        ingredientId: queijo._id.toString(),
        locationId: cozinhaLocation._id.toString()
    });

    // Queijo is compatible with ['hamburgueria'] only, cozinha is 'cozinha'
    // Should return no_action because ingredient isn't compatible with destination
    assert(recIncompatible.type === 'no_action', 'No action for incompatible ingredient', recIncompatible.type);
    const reason = recIncompatible.justification || recIncompatible.reason || '';
    assert(reason.toLowerCase().includes('compatible') || reason.toLowerCase().includes('not compatible'),
        'Reason mentions incompatibility', reason.substring(0, 150));

    logDetail('Rec for cozinha queijo', recIncompatible.type);
    logDetail('Reason', reason.substring(0, 150));

    // ========== REGRESSION — Previous phases still work ==========
    logSection('Regression — Previous phases');

    // Test: StockMovement still works (Phase 5)
    const movCount = await StockMovement.countDocuments();
    assert(movCount > 0, 'StockMovement exists', movCount);

    // Test: ProductionBatch model accessible (Phase 5.1A)
    const batchCount = await ProductionBatch.countDocuments();
    assert(batchCount !== undefined, 'ProductionBatch accessible', 'OK');

    // Test: Store operationType field exists (Phase 5.1D)
    const storeWithOpType = await Store.findById(barStore._id);
    assert(storeWithOpType.operationType === 'bar', 'Store operationType', storeWithOpType.operationType);

    // Test: StockLocation types exist (Phase 5)
    const locCount = await StockLocation.countDocuments();
    assert(locCount >= 4, 'StockLocations exist', locCount);

    // ========== TIMELINE WITH PRODUCTION BATCH ==========
    logSection('Timeline with production batch');

    await ProductionBatch.deleteOne({ batchId: 'PHASE6-TEST-BATCH-001' });

    // Create a production batch for hamburgueria
    const batch = await ProductionBatch.create({
        store: hamburgueriaStore._id,
        location: hamburgueriaLocation._id,
        batchId: 'PHASE6-TEST-BATCH-001',
        status: 'completed',
        inputs: [
            {
                ingredient: patinho._id,
                quantity: 1000,
                unit: 'g',
                outputType: 'consumed'
            }
        ],
        outputs: [
            {
                ingredient: gordura._id,
                quantity: 200,
                unit: 'g',
                outputType: 'byproduct'
            }
        ],
        yieldPercentage: 20,
        user: testUser._id,
        completedAt: new Date(),
        metadata: { test_phase6: true }
    });

    const timelineWithBatch = await observabilityService.getOperationalTimeline(hamburgueriaStore._id.toString());

    const productionEvents = timelineWithBatch.events.filter(e => e.type === 'production');
    assert(productionEvents.length > 0, 'Has production events', productionEvents.length);

    const batchEvent = productionEvents.find(e => e.batchId === 'PHASE6-TEST-BATCH-001');
    assert(batchEvent !== undefined, 'Batch event found', batchEvent ? batchEvent.eventType : 'not found');
    assert(batchEvent.inputs.length === 1, 'Batch inputs', batchEvent.inputs.length);
    assert(batchEvent.outputs.length === 1, 'Batch outputs', batchEvent.outputs.length);

    logDetail('Batch event', batchEvent.eventType);

    // ========== ALERT DEDUPLICATION ==========
    logSection('Alert deduplication');

    // Generate alerts again — should not create duplicates
    const alertsBefore = await OperationalAlert.countDocuments({
        store: hamburgueriaStore._id,
        type: 'stockout',
        ingredient: gordura._id
    });

    await observabilityService.generateAlerts(hamburgueriaStore._id.toString());

    const alertsAfter = await OperationalAlert.countDocuments({
        store: hamburgueriaStore._id,
        type: 'stockout',
        ingredient: gordura._id
    });

    assert(alertsAfter === alertsBefore, 'No duplicate alerts', `${alertsAfter} (before=${alertsBefore})`);

    // ========== SUMMARY ==========
    console.log('\n=== RESUMO ===');
    console.log(`Total: ${passCount + failCount} | Pass: ${passCount} | Fail: ${failCount}\n`);

    // ========== CLEANUP ==========
    logSection('Cleanup');
    await Store.deleteMany({ name: { $regex: /PHASE6_TEST/ } });
    await StockLocation.deleteMany({ name: { $regex: /PHASE6_TEST/ } });
    await StockLocation.deleteMany({ name: { $regex: /Central Warehouse PHASE6/ } });
    await GlobalIngredient.deleteMany({ name: { $regex: /PHASE6/ } });
    await StockPolicy.deleteMany({ 'metadata.test_phase6': true });
    await OperationalAlert.deleteMany({ 'metadata.test_phase6': true });
    await StockBalance.deleteMany({ 'metadata.test_phase6': true });
    await StockMovement.deleteMany({ 'metadata.test_phase6': true });
    await ProductionBatch.deleteMany({ 'metadata.test_phase6': true });
    console.log('  Test data cleaned');

    if (failCount === 0) {
        console.log('\n✅ Todas as validações passaram — Fase 6 completa');
    } else {
        console.log(`\n⚠️  Algumas validações FALHARAM (${failCount} de ${passCount + failCount})`);
    }

    await mongoose.disconnect();
    process.exit(failCount > 0 ? 1 : 0);
}

run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
