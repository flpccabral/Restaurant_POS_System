/**
 * Teste Prático Fase 5 — Venda com Baixa Automática Transacional
 *
 * Cenário:
 * 1. Setup: estoque local com insumos suficientes
 * 2. Produto com ficha técnica ativa
 * 3. Criar pedido com itens
 * 4. Processar pagamento → dispara baixa automática
 * 5. Validar: saldo antes/depois, movimentos recipe_deduction, CMV no pedido
 * 6. Testar rollback com estoque insuficiente
 */

const mongoose = require('mongoose');
const config = require('../config/config');
const Store = require('../models/storeModel');
const GlobalIngredient = require('../models/globalIngredientModel');
const Product = require('../models/productModel');
const Recipe = require('../models/recipeModel');
const StockLocation = require('../models/stockLocationModel');
const StockBalance = require('../models/stockBalanceModel');
const StockMovement = require('../models/stockMovementModel');
const Order = require('../models/orderModel');
const orderCheckoutService = require('../services/orderCheckoutService');

let passCount = 0, failCount = 0;

function assert(condition, section, detail) {
    const status = condition ? 'PASS' : 'FAIL';
    if (condition) passCount++; else failCount++;
    console.log(`  [${status}] ${section}: ${typeof detail === 'object' ? JSON.stringify(detail).substring(0, 150) : detail}`);
    return condition;
}

// Helpers para log formatado
function logSection(title) { console.log(`\n--- ${title} ---`); }
function logDetail(key, value) { console.log(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`); }

async function run() {
    console.log('=== Teste Prático Fase 5 — Baixa Automática Transacional ===\n');

    await mongoose.connect(config.databaseURI);
    console.log('Connected to MongoDB\n');

    const store = await Store.findOne({ isActive: true });
    if (!store) { console.log('No active store found'); process.exit(1); }
    logDetail('Store', `${store.name} (${store._id})`);

    // ========== CLEANUP ==========
    await GlobalIngredient.deleteMany({ name: { $regex: /PHASE5_TEST/i } });
    await Product.deleteMany({ name: { $regex: /PHASE5_TEST/i } });
    await Recipe.deleteMany({ name: { $regex: /PHASE5_TEST/i } });
    await StockLocation.deleteMany({ description: /PHASE5_TEST/i });
    await StockBalance.deleteMany({ 'metadata.phase5_test': true });
    await Order.deleteMany({ 'metadata.phase5_test': true });
    await StockMovement.deleteMany({ 'metadata.phase5_test': true });

    // ========== 1. SETUP — INGREDIENTES ==========
    logSection('1. Setup — Ingredientes');

    const giFarinha = await GlobalIngredient.create({
        name: 'Farinha PHASE5_TEST',
        baseUnit: 'g',
        category: 'carboidrato',
        averageCost: 0.005, // R$ 5/kg
        isActive: true
    });

    const giOvo = await GlobalIngredient.create({
        name: 'Ovo PHASE5_TEST',
        baseUnit: 'unidade',
        category: 'outro',
        averageCost: 0.50,
        isActive: true
    });

    const giAcucar = await GlobalIngredient.create({
        name: 'Açúcar PHASE5_TEST',
        baseUnit: 'kg',
        category: 'carboidrato',
        averageCost: 4.00,
        isActive: true
    });

    logDetail('Farinha', `baseUnit=${giFarinha.baseUnit}, cost=${giFarinha.averageCost}/g`);
    logDetail('Ovo', `baseUnit=${giOvo.baseUnit}, cost=${giOvo.averageCost}/un`);
    logDetail('Açúcar', `baseUnit=${giAcucar.baseUnit}, cost=${giAcucar.averageCost}/kg`);

    // ========== 2. SETUP — RECEITA ==========
    logSection('2. Setup — Receita (Bolo de Cenoura)');

    const product = await Product.create({
        store: store._id,
        name: 'Bolo de Cenoura PHASE5_TEST',
        category: new mongoose.Types.ObjectId(),
        variations: [{
            name: 'Unidade',
            price: 15.00,
            sku: 'PHASE5-BOLO-001',
            isActive: true
        }],
        isActive: true
    });

    const recipe = await Recipe.create({
        store: store._id,
        sku: 'PHASE5-BOLO-001',
        product: product._id,
        variation: 'PHASE5-BOLO-001',
        name: 'Bolo de Cenoura PHASE5_TEST',
        ingredients: [
            { ingredient: giFarinha._id, netQuantity: 300, lossFactor: 5, unit: 'g' },
            { ingredient: giOvo._id, netQuantity: 3, lossFactor: 0, unit: 'unidade' },
            { ingredient: giAcucar._id, netQuantity: 0.2, lossFactor: 0, unit: 'kg' }
        ],
        yieldQuantity: 1,
        yieldUnit: 'bolo',
        isActive: true
    });

    logDetail('Receita', recipe.name);
    logDetail('SKU', recipe.sku);
    logDetail('Ingredientes', recipe.ingredients.length);

    // ========== 3. SETUP — ESTOQUE LOCAL ==========
    logSection('3. Setup — Estoque Local da Loja');

    const storeLocation = await StockLocation.getOrCreateStoreLocation(store._id, store.name);
    storeLocation.description = 'PHASE5_TEST';
    await storeLocation.save();

    logDetail('Localização', `${storeLocation.name} (type=${storeLocation.type})`);

    // Criar saldos iniciais
    const balFarinha = await StockBalance.create({
        store: store._id,
        location: storeLocation._id,
        ingredient: giFarinha._id,
        balance: 5000, // 5kg
        reserved: 0,
        available: 5000,
        unit: 'g',
        minimumStock: 1000,
        lastPurchasePrice: 0.005
    });

    const balOvo = await StockBalance.create({
        store: store._id,
        location: storeLocation._id,
        ingredient: giOvo._id,
        balance: 50,
        reserved: 0,
        available: 50,
        unit: 'unidade',
        minimumStock: 10,
        lastPurchasePrice: 0.50
    });

    const balAcucar = await StockBalance.create({
        store: store._id,
        location: storeLocation._id,
        ingredient: giAcucar._id,
        balance: 10, // 10kg
        reserved: 0,
        available: 10,
        unit: 'kg',
        minimumStock: 2,
        lastPurchasePrice: 4.00
    });

    logDetail('Farinha', `5000g (5kg)`);
    logDetail('Ovo', `50 unidades`);
    logDetail('Açúcar', `10kg`);

    // Salvar saldos antes
    const beforeFarinha = balFarinha.balance;
    const beforeOvo = balOvo.balance;
    const beforeAcucar = balAcucar.balance;

    logDetail('Saldo antes', `Farinha=${beforeFarinha}g, Ovo=${beforeOvo}un, Açúcar=${beforeAcucar}kg`);

    // ========== 4. TEST 1 — Venda com baixa automática ==========
    logSection('4. Test 1 — Venda de 2 Bolos com baixa automática');

    // Criar pedido
    const order = await Order.create({
        store: store._id,
        customerDetails: { name: 'Cliente Test', phone: '123456789', guests: 1 },
        orderStatus: 'pending',
        bills: { total: 30.00, tax: 0, totalWithTax: 30.00 },
        items: [{
            product: product._id,
            name: 'Bolo de Cenoura PHASE5_TEST',
            quantity: 2,
            price: 15.00,
            status: 'pending'
        }],
        metadata: { phase5_test: true }
    });

    logDetail('Pedido criado', `${order._id}`);

    // Executar baixa automática via service
    let deductionResult;
    try {
        // Iniciar transação
        const s = await mongoose.startSession();
        s.startTransaction();

        deductionResult = await orderCheckoutService.processOrderStockDeduction({
            storeId: store._id,
            orderId: order._id,
            orderItems: order.items,
            userId: null,
            session: s
        });

        // Atualizar pedido com CMV
        for (const itemResult of deductionResult.items) {
            const item = order.items.id(itemResult.itemId);
            if (item) {
                if (itemResult.recipeId) item.recipe = itemResult.recipeId;
                item.recipeVersion = itemResult.recipeVersion;
                item.cogs = itemResult.cogs;
                item.ingredientCosts = itemResult.ingredientCosts;
                item.stockDeductionStatus = itemResult.stockDeductionStatus;
                if (itemResult.movements) item.stockMovements = itemResult.movements;
            }
        }

        order.totalCOGS = deductionResult.totalCOGS;
        order.stockDeductionStatus = deductionResult.errors.length === 0 ? 'completed' : 'partial';
        await order.save({ session: s });

        await s.commitTransaction();
        s.endSession();

        logDetail('Baixa executada', 'SUCESSO');
        logDetail('totalCOGS', `R$ ${deductionResult.totalCOGS}`);
        logDetail('itemsProcessed', deductionResult.items.length);
        logDetail('errors', deductionResult.errors.length);
    } catch (err) {
        logDetail('ERRO na baixa', err.message);
        deductionResult = { items: [], errors: [{ reason: err.message }] };
    }

    // Validar resultado
    const orderUpdated = await Order.findById(order._id);
    assert(orderUpdated.totalCOGS > 0, 'COGS total', `R$ ${orderUpdated.totalCOGS} (expected > 0)`);
    assert(orderUpdated.stockDeductionStatus === 'completed', 'stockDeductionStatus', orderUpdated.stockDeductionStatus);

    // Validar saldos depois
    const afterFarinha = await StockBalance.findById(balFarinha._id);
    const afterOvo = await StockBalance.findById(balOvo._id);
    const afterAcucar = await StockBalance.findById(balAcucar._id);

    // Cálculos esperados para 2 bolos:
    // Farinha: 300 * 1.05 * 2 = 630g
    // Ovo: 3 * 1 * 2 = 6 unidades
    // Açúcar: 0.2 * 1 * 2 = 0.4 kg
    const expectedFarinha = 630;
    const expectedOvo = 6;
    const expectedAcucar = 0.4;

    logDetail('Farinha depois', `${afterFarinha.balance}g (antes=${beforeFarinha}, baixou=${beforeFarinha - afterFarinha.balance}, esperado=${expectedFarinha})`);
    logDetail('Ovo depois', `${afterOvo.balance}un (antes=${beforeOvo}, baixou=${beforeOvo - afterOvo.balance}, esperado=${expectedOvo})`);
    logDetail('Açúcar depois', `${afterAcucar.balance}kg (antes=${beforeAcucar}, baixou=${beforeAcucar - afterAcucar.balance}, esperado=${expectedAcucar})`);

    assert(afterFarinha.balance === beforeFarinha - expectedFarinha, 'Farinha saldo', `${afterFarinha.balance} (expected ${beforeFarinha - expectedFarinha})`);
    assert(afterOvo.balance === beforeOvo - expectedOvo, 'Ovo saldo', `${afterOvo.balance} (expected ${beforeOvo - expectedOvo})`);
    assert(Math.round((afterAcucar.balance) * 100) / 100 === Math.round((beforeAcucar - expectedAcucar) * 100) / 100, 'Açúcar saldo', `${afterAcucar.balance} (expected ${beforeAcucar - expectedAcucar})`);

    // Validar movimentos
    const movements = await StockMovement.find({
        'metadata.phase5_test': true,
        type: 'recipe_deduction'
    }).populate('ingredient', 'name');

    // Buscar movimentos por recipe
    const recipeMovements = await StockMovement.find({
        recipe: recipe._id,
        type: 'recipe_deduction',
        'metadata.phase5_test': true
    }).populate('ingredient', 'name');

    // Movimentos do teste atual (usando orderId como reference)
    const orderMovements = await StockMovement.find({
        reference: order._id.toString(),
        type: 'recipe_deduction'
    }).populate('ingredient', 'name');

    assert(orderMovements.length === 3, 'Movimentos recipe_deduction', `${orderMovements.length} movimentos (expected 3)`);

    for (const mov of orderMovements) {
        logDetail(`Movimento: ${mov.ingredient?.name}`, {
            type: mov.type,
            quantity: mov.quantity,
            unit: mov.unit,
            balanceBefore: mov.balanceBefore,
            balanceAfter: mov.balanceAfter,
            recipe: mov.metadata?.recipeName,
            orderId: mov.metadata?.orderId
        });
    }

    // Validar CMV por item
    const item = orderUpdated.items[0];
    assert(item.cogs > 0, 'CMV por item', `R$ ${item.cogs} (expected > 0)`);
    assert(item.recipe?.toString() === recipe._id.toString(), 'Recipe no item', item.recipe?.toString());
    assert(item.stockDeductionStatus === 'deducted', 'stockDeductionStatus do item', item.stockDeductionStatus);
    assert(item.ingredientCosts.length === 3, 'ingredientCosts', `${item.ingredientCosts.length} custos (expected 3)`);

    // ========== 5. TEST 2 — Rollback com estoque insuficiente ==========
    logSection('5. Test 2 — Rollback com estoque insuficiente');

    // Desativar primeira receita para usar a segunda (com estoque insuficiente)
    recipe.isActive = false;
    await recipe.save();

    // Criar segunda receita para teste de falha (usando o mesmo produto/variação existente)
    const recipe2 = await Recipe.create({
        store: store._id,
        sku: 'PHASE5-BOLO-002',
        product: product._id,
        variation: 'PHASE5-BOLO-001', // usar mesma variation do produto
        name: 'Bolo Gigante PHASE5_TEST',
        ingredients: [
            { ingredient: giFarinha._id, netQuantity: 5000, lossFactor: 0, unit: 'g' } // 5kg de farinha — mais do que tem
        ],
        yieldQuantity: 1,
        isActive: true
    });

    const order2 = await Order.create({
        store: store._id,
        customerDetails: { name: 'Cliente Test 2', phone: '123456789', guests: 1 },
        orderStatus: 'pending',
        bills: { total: 100.00, tax: 0, totalWithTax: 100.00 },
        items: [{
            product: product._id,
            name: 'Bolo Gigante PHASE5_TEST',
            quantity: 1, // precisaria 5kg de farinha — tem apenas ~4.3kg
            price: 50.00,
            status: 'pending'
        }],
        metadata: { phase5_test: true }
    });

    try {
        const s2 = await mongoose.startSession();
        s2.startTransaction();

        await orderCheckoutService.processOrderStockDeduction({
            storeId: store._id,
            orderId: order2._id,
            orderItems: order2.items,
            userId: null,
            session: s2
        });

        await s2.commitTransaction();
        s2.endSession();

        assert(false, 'Rollback test', 'deveria ter falhado (estoque insuficiente)');
    } catch (err) {
        assert(true, 'Rollback test', `falha esperada: ${err.message}`);

        // Verificar que saldo não foi alterado
        const checkFarinha = await StockBalance.findById(balFarinha._id);
        assert(checkFarinha.balance === afterFarinha.balance, 'Saldo após rollback', `Farinha=${checkFarinha.balance} (esperado ${afterFarinha.balance} — não alterado)`);
    }

    // ========== 6. TEST 3 — Produto sem receita ==========
    logSection('6. Test 3 — Produto sem ficha técnica');

    const productNoRecipe = await Product.create({
        store: store._id,
        name: 'Produto Sem Receita PHASE5_TEST',
        category: new mongoose.Types.ObjectId(),
        variations: [{
            name: 'Unidade',
            price: 5.00,
            sku: 'PHASE5-NORECIPE-001',
            isActive: true
        }],
        isActive: true
    });

    const order3 = await Order.create({
        store: store._id,
        customerDetails: { name: 'Cliente Test 3', phone: '123456789', guests: 1 },
        orderStatus: 'pending',
        bills: { total: 5.00, tax: 0, totalWithTax: 5.00 },
        items: [{
            product: productNoRecipe._id,
            name: 'Produto Sem Receita PHASE5_TEST',
            quantity: 1,
            price: 5.00,
            status: 'pending'
        }],
        metadata: { phase5_test: true }
    });

    const s3 = await mongoose.startSession();
    s3.startTransaction();

    const result3 = await orderCheckoutService.processOrderStockDeduction({
        storeId: store._id,
        orderId: order3._id,
        orderItems: order3.items,
        userId: null,
        session: s3
    });

    await s3.commitTransaction();
    s3.endSession();

    assert(result3.items[0].stockDeductionStatus === 'no_recipe', 'Sem receita', `status=${result3.items[0].stockDeductionStatus} (expected no_recipe)`);
    assert(result3.errors.length === 1, 'Erros sem receita', `${result3.errors.length} erro (expected 1)`);
    assert(result3.totalCOGS === 0, 'COGS sem receita', `R$ ${result3.totalCOGS} (expected 0)`);

    // ========== 7. CONFIRMAÇÃO: ESTOQUE LOCAL, NÃO CENTRAL ==========
    logSection('7. Confirmação — Baixa no estoque local, não central');

    const allMovements = await StockMovement.find({ reference: order._id.toString(), type: 'recipe_deduction' });
    let allLocal = true;
    for (const mov of allMovements) {
        const loc = await StockLocation.findById(mov.location);
        if (loc && loc.type !== 'STORE') {
            allLocal = false;
        }
    }
    assert(allLocal, 'Baixa em estoque local', `Todos os movimentos em type=STORE: ${allLocal}`);

    // ========== CLEANUP ==========
    logSection('Cleanup');
    await GlobalIngredient.deleteMany({ name: { $regex: /PHASE5_TEST/i } });
    await Product.deleteMany({ name: { $regex: /PHASE5_TEST/i } });
    await Recipe.deleteMany({ name: { $regex: /PHASE5_TEST/i } });
    await StockLocation.deleteOne({ description: /PHASE5_TEST/i });
    await StockBalance.deleteMany({ 'metadata.phase5_test': true });
    await Order.deleteMany({ 'metadata.phase5_test': true });
    await StockMovement.deleteMany({ 'metadata.phase5_test': true });
    console.log('  Test data cleaned');

    // ========== RESUMO ==========
    console.log(`\n=== RESUMO ===`);
    console.log(`Total: ${passCount + failCount} | Pass: ${passCount} | Fail: ${failCount}`);

    await mongoose.disconnect();

    if (failCount > 0) {
        console.log('\n⚠️  Algumas validações FALHARAM');
        process.exit(1);
    } else {
        console.log('\n✅ Todas as validações passaram — Fase 5 completa');
        process.exit(0);
    }
}

run().catch(async (err) => {
    console.error('Phase 5 test failed:', err);
    await mongoose.disconnect();
    process.exit(1);
});
