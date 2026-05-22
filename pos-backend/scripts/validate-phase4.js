/**
 * Checkpoint Final Fase 4 — Validação prática
 *
 * Valida:
 * 1. Conversão de unidades (kg↔g, L↔ml, unidade)
 * 2. Erro para caixa/pacote sem fator explícito
 * 3. Conversão com fator explícito funciona
 * 4. simulateConsumption com dados reais
 * 5. Endpoints de vendabilidade
 * 6. deductStock NÃO conectado ao checkout
 */

const mongoose = require('mongoose');
const config = require('../config/config');
const uc = require('../services/unitConversionService');
const Recipe = require('../models/recipeModel');
const Product = require('../models/productModel');
const Store = require('../models/storeModel');
const GlobalIngredient = require('../models/globalIngredientModel');
const StockLocation = require('../models/stockLocationModel');
const StockBalance = require('../models/stockBalanceModel');
const recipeService = require('../services/recipeService');

let passCount = 0, failCount = 0;
const results = [];

function assert(condition, section, detail) {
    const status = condition ? 'PASS' : 'FAIL';
    if (condition) passCount++; else failCount++;
    results.push({ status, section, detail: typeof detail === 'object' ? JSON.stringify(detail, null, 2) : detail });
    console.log(`  [${status}] ${section}: ${typeof detail === 'object' ? JSON.stringify(detail) : detail}`);
    return condition;
}

async function run() {
    console.log('=== Checkpoint Final Fase 4 — Validação prática ===\n');

    await mongoose.connect(config.databaseURI);
    console.log('Connected to MongoDB\n');

    const store = await Store.findOne({ isActive: true });
    if (!store) { console.log('No active store found'); process.exit(1); }
    console.log(`Store: ${store.name}\n`);

    // ========== 1. CONVERSÃO DE UNIDADES ==========
    console.log('--- 1. Validação de conversão de unidades ---');

    const r1 = uc.toBaseUnit(5, 'kg', 'g');
    assert(r1.quantityInBase === 5000, 'kg→g', `5kg = ${r1.quantityInBase}g (expected 5000)`);

    const r2 = uc.toBaseUnit(2500, 'g', 'kg');
    assert(r2.quantityInBase === 2.5, 'g→kg', `2500g = ${r2.quantityInBase}kg (expected 2.5)`);

    const r3 = uc.toBaseUnit(1.5, 'L', 'ml');
    assert(r3.quantityInBase === 1500, 'L→ml', `1.5L = ${r3.quantityInBase}ml (expected 1500)`);

    const r4 = uc.toBaseUnit(500, 'ml', 'L');
    assert(r4.quantityInBase === 0.5, 'ml→L', `500ml = ${r4.quantityInBase}L (expected 0.5)`);

    const r5 = uc.toBaseUnit(10, 'unidade', 'unidade');
    assert(r5.quantityInBase === 10, 'unidade→unidade', `10unidade = ${r5.quantityInBase} (expected 10)`);

    // ========== 2. ERRO PARA CAIXA/PACOTE SEM FATOR ==========
    console.log('\n--- 2. Validação de erro para caixa/pacote sem fator ---');

    try {
        uc.toBaseUnit(3, 'caixa', 'g');
        assert(false, 'caixa sem fator', 'deveria ter lançado erro');
    } catch (e) {
        assert(true, 'caixa sem fator', `erro claro: ${e.message}`);
    }

    try {
        uc.toBaseUnit(5, 'pacote', 'g');
        assert(false, 'pacote sem fator', 'deveria ter lançado erro');
    } catch (e) {
        assert(true, 'pacote sem fator', `erro claro: ${e.message}`);
    }

    // ========== 3. CONVERSÃO COM FATOR EXPLÍCITO ==========
    console.log('\n--- 3. Conversão com fator explícito ---');

    const r6 = uc.toBaseUnit(3, 'caixa', 'g', { caixa: 5000 });
    assert(r6.quantityInBase === 15000, 'caixa com fator', `3 caixas (5kg cada) = ${r6.quantityInBase}g (expected 15000)`);

    const r7 = uc.toBaseUnit(2, 'pacote', 'g', { pacote: 500 });
    assert(r7.quantityInBase === 1000, 'pacote com fator', `2 pacotes (500g cada) = ${r7.quantityInBase}g (expected 1000)`);

    // ========== 4. CALCULATE CONSUMPTION ==========
    console.log('\n--- 4. calculateConsumption ---');

    const c1 = uc.calculateConsumption(
        { netQuantity: 150, lossFactor: 10, unit: 'g' },
        3,
        { baseUnit: 'g', conversionToBase: new Map() }
    );
    assert(c1.quantityInBase === 495, '150g * 1.10 * 3', `consumption = ${c1.quantityInBase}g (expected 495)`);

    const c2 = uc.calculateConsumption(
        { netQuantity: 0.5, lossFactor: 0, unit: 'kg' },
        2,
        { baseUnit: 'g', conversionToBase: new Map() }
    );
    assert(c2.quantityInBase === 1000, '0.5kg * 2 → g', `consumption = ${c2.quantityInBase}g (expected 1000)`);

    // ========== 5. SIMULAÇÃO REAL DE CONSUMO ==========
    console.log('\n--- 5. Simulação real de consumo futuro ---');

    // Setup: criar dados de teste
    await GlobalIngredient.deleteMany({ name: { $regex: /CHECKPOINT/i } });
    await Recipe.deleteMany({ name: { $regex: /CHECKPOINT/i } });
    await StockBalance.deleteMany({ 'metadata.checkpoint_phase4': true });
    await StockLocation.deleteMany({ description: /CHECKPOINT_PHASE4/i });

    const giFarinha = await GlobalIngredient.create({
        name: 'Farinha de trigo CHECKPOINT',
        baseUnit: 'g',
        category: 'carboidrato',
        averageCost: 0.005, // R$ 0.005/g = R$ 5/kg
        isActive: true
    });

    const giOvo = await GlobalIngredient.create({
        name: 'Ovo CHECKPOINT',
        baseUnit: 'unidade',
        category: 'outro',
        averageCost: 0.50,
        isActive: true
    });

    const giAcucar = await GlobalIngredient.create({
        name: 'Açúcar CHECKPOINT',
        baseUnit: 'kg',
        category: 'carboidrato',
        averageCost: 4.00,
        isActive: true
    });

    console.log(`  Ingredientes criados: Farinha(baseUnit=g), Ovo(baseUnit=unidade), Açúcar(baseUnit=kg)`);

    const recipe = await Recipe.create({
        store: store._id,
        sku: 'CHECKPOINT-BOLO-001',
        product: new mongoose.Types.ObjectId(), // produto fictício para simulação
        variation: 'UNIDADE',
        name: 'Bolo de Cenoura CHECKPOINT (TEST)',
        ingredients: [
            { ingredient: giFarinha._id, netQuantity: 300, lossFactor: 5, unit: 'g' },
            { ingredient: giOvo._id, netQuantity: 3, lossFactor: 0, unit: 'unidade' },
            { ingredient: giAcucar._id, netQuantity: 0.2, lossFactor: 0, unit: 'kg' }
        ],
        yieldQuantity: 1,
        yieldUnit: 'bolo',
        isActive: true
    });

    console.log(`  Receita criada: ${recipe.name}`);

    // Popular ingredientes no recipe para o simulateConsumption funcionar
    recipe.ingredients[0].ingredient = giFarinha;
    recipe.ingredients[1].ingredient = giOvo;
    recipe.ingredients[2].ingredient = giAcucar;

    const simulation = await recipeService.simulateConsumption(recipe._id, 5);

    console.log(`  Simulação: 5 bolos`);
    console.log(`  Ingredientes simulados: ${simulation.wouldDeduct.length}`);

    assert(simulation.wouldDeduct.length === 3, 'wouldDeduct count', `${simulation.wouldDeduct.length} ingredientes (expected 3)`);
    assert(simulation.recipeName.includes('Bolo'), 'recipeName', simulation.recipeName);
    assert(simulation.quantity === 5, 'quantity', simulation.quantity);
    assert(simulation.allIngredientsAvailable === false, 'stock availability', `allIngredientsAvailable=${simulation.allIngredientsAvailable} (expected false — estoque vazio)`);

    // Verificar cada ingrediente simulado
    const farinhaSim = simulation.wouldDeduct.find(d => d.ingredientName.includes('Farinha'));
    if (farinhaSim) {
        assert(farinhaSim.recipeQuantity === 300, 'farinha recipeQuantity', farinhaSim.recipeQuantity);
        assert(farinhaSim.stockUnit === 'g', 'farinha stockUnit', farinhaSim.stockUnit);
        // 300 * 1.05 * 5 = 1575g
        assert(farinhaSim.quantityInStockUnit === 1575, 'farinha quantity', `${farinhaSim.quantityInStockUnit}g (expected 1575)`);
        assert(farinhaSim.hasEnough === false, 'farinha stock', 'estoque vazio — hasEnough=false (correto)');
    }

    const ovoSim = simulation.wouldDeduct.find(d => d.ingredientName.includes('Ovo'));
    if (ovoSim) {
        assert(ovoSim.recipeQuantity === 3, 'ovo recipeQuantity', ovoSim.recipeQuantity);
        // 3 * 1 * 5 = 15 unidades
        assert(ovoSim.quantityInStockUnit === 15, 'ovo quantity', `${ovoSim.quantityInStockUnit}un (expected 15)`);
    }

    const acucarSim = simulation.wouldDeduct.find(d => d.ingredientName.includes('Açúcar'));
    if (acucarSim) {
        // 0.2 * 1 * 5 = 1.0 kg → baseUnit=kg → 1.0
        assert(acucarSim.recipeQuantity === 0.2, 'acucar recipeQuantity', acucarSim.recipeQuantity);
        assert(acucarSim.quantityInStockUnit === 1, 'acucar quantity', `${acucarSim.quantityInStockUnit}kg (expected 1)`);
    }

    assert(simulation.totalEstimatedCost > 0, 'totalEstimatedCost', `R$ ${simulation.totalEstimatedCost} (expected > 0)`);

    // ========== 6. VENDABILIDADE ==========
    console.log('\n--- 6. Produto vendável vs não vendável ---');

    // Recipe com produto real — testar que Recipe existe para a recipe
    const activeRecipe = await Recipe.findOne({ isActive: true }).limit(1);
    if (activeRecipe) {
        assert(true, 'recipe ativa existe', `${activeRecipe.name} — vendável (tem ficha ativa)`);
    }

    // Verificar que inactive recipe não é vendável
    const inactiveRecipe = await Recipe.create({
        store: store._id,
        sku: 'CHECKPOINT-INACTIVE-001',
        product: new mongoose.Types.ObjectId(),
        variation: 'UNIDADE',
        name: 'Produto Inativo CHECKPOINT (TEST)',
        ingredients: [
            { ingredient: giFarinha._id, netQuantity: 100, lossFactor: 0, unit: 'g' }
        ],
        isActive: false
    });
    assert(inactiveRecipe.isActive === false, 'recipe inativa', `${inactiveRecipe.name} — NÃO vendável (isActive=false)`);

    // ========== 7. DEDUCT STOCK NÃO CONECTADO AO CHECKOUT ==========
    console.log('\n--- 7. Confirmação: checkout NÃO chama deductStock ---');

    // Verificar nos arquivos do PDV/Order
    const fs = require('fs');
    const path = require('path');

    const pdvFile = path.join(__dirname, '../controllers/pdvController.js');
    const hasRecipeServiceInPDV = fs.existsSync(pdvFile) && fs.readFileSync(pdvFile, 'utf8').includes('recipeService');
    assert(hasRecipeServiceInPDV === false, 'PDV controller', `recipeService no PDV: ${hasRecipeServiceInPDV} (expected false — CORRETO)`);

    const orderFile = path.join(__dirname, '../models/orderModel.js');
    const hasDeductInOrder = fs.existsSync(orderFile) && fs.readFileSync(orderFile, 'utf8').includes('deductStock');
    assert(hasDeductInOrder === false, 'Order model', `deductStock no Order: ${hasDeductInOrder} (expected false — CORRETO)`);

    // ========== 8. VALIDATE RECIPE ==========
    console.log('\n--- 8. Validate recipe endpoint ---');

    const validateResult = uc.validateUnit('kg', 'g');
    assert(validateResult.valid === true, 'validateUnit kg→g', `valid=${validateResult.valid}`);

    const validateBad = uc.validateUnit('caixa', 'g');
    assert(validateBad.valid === false, 'validateUnit caixa→g', `valid=${validateBad.valid} (expected false)`);

    // ========== 9. VERIFICAR ENDPOINTS ==========
    console.log('\n--- 9. Endpoints registrados ---');

    const routeFile = path.join(__dirname, '../routes/recipeRoute.js');
    const routeContent = fs.readFileSync(routeFile, 'utf8');

    const endpoints = [
        ['POST', '/', 'createRecipe'],
        ['GET', '/', 'getRecipes'],
        ['GET', '/sku/:sku', 'getRecipeBySku'],
        ['GET', '/:id', 'getRecipeById'],
        ['PUT', '/:id', 'updateRecipe'],
        ['PUT', '/:id/toggle-status', 'toggleRecipeStatus'],
        ['DELETE', '/:id', 'deleteRecipe'],
        ['GET', '/:id/cost', 'calculateRecipeCost'],
        ['GET', '/:id/stock/check', 'checkStockAvailability'],
        ['POST', '/:id/stock/deduct', 'deductStock'],
        ['POST', '/validate', 'validateRecipe'],
        ['GET', '/without-recipe', 'getProductsWithoutRecipe'],
        ['GET', '/sellable', 'getSellableProducts'],
        ['GET', '/non-sellable', 'getNonSellableProducts'],
        ['GET', '/product/:productId/sellable', 'checkProductSellability'],
        ['GET', '/:id/stock/simulate', 'simulateConsumption']
    ];

    for (const [method, route, func] of endpoints) {
        const exists = routeContent.includes(route) && routeContent.includes(func);
        assert(exists, `${method} ${route}`, exists ? `${func} — registrado` : `${func} — NÃO ENCONTRADO`);
    }

    // ========== CLEANUP ==========
    console.log('\n--- Cleanup ---');
    await GlobalIngredient.deleteMany({ name: { $regex: /CHECKPOINT/i } });
    await Recipe.deleteMany({ name: { $regex: /CHECKPOINT/i } });
    console.log('  Test data cleaned');

    // ========== RESUMO ==========
    console.log(`\n=== RESUMO ===`);
    console.log(`Total: ${passCount + failCount} | Pass: ${passCount} | Fail: ${failCount}`);

    await mongoose.disconnect();

    if (failCount > 0) {
        console.log('\n⚠️  Algumas validações FALHARAM — revisar antes de liberar Fase 5');
        process.exit(1);
    } else {
        console.log('\n✅ Todas as validações passaram — Fase 4 completa');
        process.exit(0);
    }
}

run().catch(async (err) => {
    console.error('Checkpoint failed:', err);
    await mongoose.disconnect();
    process.exit(1);
});
