/**
 * Teste Prático Fase 5.5 — Reversão operacional e estorno de estoque
 *
 * Cenário A — Venda com baixa e reversão total
 * Cenário B — Dupla reversão bloqueada
 * Cenário C — Rollback em falha simulada
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
const stockReversalService = require('../services/stockReversalService');

let passCount = 0, failCount = 0;

function assert(condition, section, detail) {
    const status = condition ? 'PASS' : 'FAIL';
    if (condition) passCount++; else failCount++;
    console.log(`  [${status}] ${section}: ${typeof detail === 'object' ? JSON.stringify(detail).substring(0, 150) : detail}`);
    return condition;
}

function logSection(title) { console.log(`\n--- ${title} ---`); }
function logDetail(key, value) { console.log(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`); }

// Helper para processar venda com baixa
async function processSaleWithDeduction(store, product, recipe, quantity, stockBalances) {
    const order = await Order.create({
        store: store._id,
        customerDetails: { name: 'Cliente Test', phone: '123456789', guests: 1 },
        orderStatus: 'paid',
        bills: { total: quantity * 15, tax: 0, totalWithTax: quantity * 15 },
        items: [{
            product: product._id,
            name: 'Bolo Test 5.5',
            quantity,
            price: 15,
            status: 'pending'
        }]
    });

    const session = await mongoose.startSession();
    session.startTransaction();

    const deductionResult = await orderCheckoutService.processOrderStockDeduction({
        storeId: store._id,
        orderId: order._id,
        orderItems: order.items,
        userId: null,
        session
    });

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
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return await Order.findById(order._id);
}

async function run() {
    console.log('=== Teste Fase 5.5 — Reversão operacional e estorno de estoque ===\n');

    await mongoose.connect(config.databaseURI);
    console.log('Connected to MongoDB\n');

    const store = await Store.findOne({ isActive: true });
    if (!store) { console.log('No active store found'); process.exit(1); }
    logDetail('Store', `${store.name} (${store._id})`);

    // ========== CLEANUP ==========
    await GlobalIngredient.deleteMany({ name: { $regex: /PHASE5_5/i } });
    await Product.deleteMany({ name: { $regex: /PHASE5_5/i } });
    await Recipe.deleteMany({ name: { $regex: /PHASE5_5/i } });
    await StockLocation.deleteMany({ description: /PHASE5_5_TEST/i });
    // Remove orders and movements created by this test
    await Order.deleteMany({ 'metadata.test_phase5_5': true });
    await StockMovement.deleteMany({ 'metadata.test_phase5_5': true });
    await StockBalance.deleteMany({ 'metadata.test_phase5_5': true });

    // ========== SETUP ==========
    logSection('Setup — Ingredientes, Receita, Estoque');

    const giFarinha = await GlobalIngredient.create({
        name: 'Farinha PHASE5_5',
        baseUnit: 'g',
        category: 'carboidrato',
        averageCost: 0.005,
        isActive: true
    });

    const giOvo = await GlobalIngredient.create({
        name: 'Ovo PHASE5_5',
        baseUnit: 'unidade',
        category: 'outro',
        averageCost: 0.50,
        isActive: true
    });

    const product = await Product.create({
        store: store._id,
        name: 'Bolo PHASE5_5',
        category: new mongoose.Types.ObjectId(),
        variations: [{ name: 'Unidade', price: 15, sku: 'PHASE5_5-001', isActive: true }],
        isActive: true
    });

    const recipe = await Recipe.create({
        store: store._id,
        sku: 'PHASE5_5-001',
        product: product._id,
        variation: 'PHASE5_5-001',
        name: 'Bolo PHASE5_5',
        ingredients: [
            { ingredient: giFarinha._id, netQuantity: 300, lossFactor: 5, unit: 'g' },
            { ingredient: giOvo._id, netQuantity: 3, lossFactor: 0, unit: 'unidade' }
        ],
        yieldQuantity: 1,
        isActive: true
    });

    const storeLocation = await StockLocation.getOrCreateStoreLocation(store._id, store.name);
    storeLocation.description = 'PHASE5_5_TEST';
    await storeLocation.save();

    // Estoque inicial
    const balFarinha = await StockBalance.create({
        store: store._id,
        location: storeLocation._id,
        ingredient: giFarinha._id,
        balance: 5000, reserved: 0, available: 5000,
        unit: 'g', minimumStock: 1000, lastPurchasePrice: 0.005,
        metadata: { test_phase5_5: true }
    });

    const balOvo = await StockBalance.create({
        store: store._id,
        location: storeLocation._id,
        ingredient: giOvo._id,
        balance: 50, reserved: 0, available: 50,
        unit: 'unidade', minimumStock: 10, lastPurchasePrice: 0.50,
        metadata: { test_phase5_5: true }
    });

    logDetail('Farinha', `5000g`);
    logDetail('Ovo', `50 unidades`);

    // ========== CENÁRIO A — Venda com baixa e reversão total ==========
    logSection('Cenário A — Venda → Baixa → Reversão total');

    // 1. Processar venda com baixa
    logDetail('1. Processando venda com baixa automática (2 bolos)');

    const orderA = await processSaleWithDeduction(store, product, recipe, 2, [balFarinha, balOvo]);

    assert(orderA.stockDeductionStatus === 'completed', 'Stock deduction status', orderA.stockDeductionStatus);
    assert(orderA.totalCOGS > 0, 'COGS calculado', `R$ ${orderA.totalCOGS}`);

    const itemA = orderA.items[0];
    assert(itemA.stockDeductionStatus === 'deducted', 'Item stockDeductionStatus', itemA.stockDeductionStatus);

    // 2. Verificar saldos após baixa
    logDetail('2. Saldos após baixa');

    const farinhaAfterDeduction = await StockBalance.findById(balFarinha._id);
    const ovoAfterDeduction = await StockBalance.findById(balOvo._id);

    // Farinha: 300 * 1.05 * 2 = 630g
    const farinhaDeducted = 630;
    // Ovo: 3 * 1 * 2 = 6 unidades
    const ovoDeducted = 6;

    logDetail('Farinha', `${farinhaAfterDeduction.balance}g (baixou=${farinhaDeducted}g)`);
    logDetail('Ovo', `${ovoAfterDeduction.balance}un (baixou=${ovoDeducted}un)`);

    assert(farinhaAfterDeduction.balance === 5000 - farinhaDeducted, 'Farinha após baixa', `${farinhaAfterDeduction.balance}g (expected ${5000 - farinhaDeducted})`);
    assert(ovoAfterDeduction.balance === 50 - ovoDeducted, 'Ovo após baixa', `${ovoAfterDeduction.balance}un (expected ${50 - ovoDeducted})`);

    // 3. Verificar movimentos recipe_deduction
    logDetail('3. Movimentos recipe_deduction');

    const originalMovements = await StockMovement.find({
        reference: orderA._id.toString(),
        type: 'recipe_deduction'
    }).populate('ingredient', 'name');

    assert(originalMovements.length === 2, 'Movimentos originais', `${originalMovements.length} (expected 2: farinha + ovo)`);

    for (const mov of originalMovements) {
        logDetail(`  ${mov.type}`, `${mov.ingredient?.name}: ${mov.quantity}${mov.unit} (${mov.balanceBefore}→${mov.balanceAfter})`);
    }

    // 4. Executar reversão
    logDetail('4. Executando reversão');

    const reversalResult = await stockReversalService.reverseOrderStockDeduction({
        orderId: orderA._id.toString(),
        reason: 'Cancelamento para teste Fase 5.5',
        userId: null
    });

    assert(reversalResult.success === true, 'Reversal success', reversalResult.success);
    assert(reversalResult.originalMovementCount === 2, 'Movements reversed', `${reversalResult.originalMovementCount} (expected 2)`);

    // 5. Verificar pedido atualizado
    const orderAfterReversal = await Order.findById(orderA._id);
    assert(orderAfterReversal.stockReversalStatus === 'reversed', 'Order stockReversalStatus', orderAfterReversal.stockReversalStatus);
    assert(orderAfterReversal.stockReversalReason === 'Cancelamento para teste Fase 5.5', 'Reversal reason', orderAfterReversal.stockReversalReason);
    assert(orderAfterReversal.stockReversedAt !== null, 'ReversedAt timestamp', orderAfterReversal.stockReversedAt);
    assert(orderAfterReversal.stockDeductionStatus === 'pending', 'Deduction status after reversal', orderAfterReversal.stockDeductionStatus);

    // Verificar items atualizados
    const itemAfterReversal = orderAfterReversal.items[0];
    assert(itemAfterReversal.stockDeductionStatus === 'pending', 'Item stockDeductionStatus after reversal', itemAfterReversal.stockDeductionStatus);
    assert(itemAfterReversal.stockReversalStatus === 'reversed', 'Item stockReversalStatus', itemAfterReversal.stockReversalStatus);

    // 6. Verificar saldos após reversão
    logDetail('5. Saldos após reversão');

    const farinhaAfterReversal = await StockBalance.findById(balFarinha._id);
    const ovoAfterReversal = await StockBalance.findById(balOvo._id);

    logDetail('Farinha', `${farinhaAfterReversal.balance}g (antes=${farinhaAfterDeduction.balance}, voltou=5000)`);
    logDetail('Ovo', `${ovoAfterReversal.balance}un (antes=${ovoAfterDeduction.balance}, voltou=50)`);

    assert(farinhaAfterReversal.balance === 5000, 'Farinha após reversão', `${farinhaAfterReversal.balance}g (expected 5000 — voltou ao original)`);
    assert(ovoAfterReversal.balance === 50, 'Ovo após reversão', `${ovoAfterReversal.balance}un (expected 50 — voltou ao original)`);

    // 7. Verificar movimentos recipe_deduction_reversal
    logDetail('6. Movimentos recipe_deduction_reversal');

    const reversalMovements = await StockMovement.find({
        reference: orderA._id.toString(),
        type: 'recipe_deduction_reversal'
    }).populate('ingredient', 'name');

    assert(reversalMovements.length === 2, 'Reversal movements', `${reversalMovements.length} (expected 2)`);

    for (const mov of reversalMovements) {
        logDetail(`  ${mov.type}`, `${mov.ingredient?.name}: +${mov.quantity}${mov.unit} (${mov.balanceBefore}→${mov.balanceAfter}), reversalOf=${mov.reversalOf}`);
    }

    // Verificar que reversalOf aponta para movimento original
    for (const revMov of reversalMovements) {
        assert(revMov.reversalOf !== null, 'reversalOf reference', `${revMov.reversalOf} (expected original movement ID)`);
        const origMov = originalMovements.find(m => m._id.toString() === revMov.reversalOf.toString());
        assert(origMov !== undefined, 'Original movement found', origMov?.ingredient?.name);
        assert(origMov.quantity === revMov.quantity, 'Quantity matches original', `${revMov.quantity} = ${origMov.quantity}`);
    }

    // Verificar que movimentos originais foram preservados
    const preservedOriginals = await StockMovement.find({
        _id: { $in: originalMovements.map(m => m._id) }
    });
    assert(preservedOriginals.length === 2, 'Original movements preserved', `${preservedOriginals.length} (expected 2 — não deletados)`);

    // ========== CENÁRIO B — Dupla reversão bloqueada ==========
    logSection('Cenário B — Dupla reversão bloqueada');

    try {
        await stockReversalService.reverseOrderStockDeduction({
            orderId: orderA._id.toString(),
            reason: 'Tentativa de dupla reversão',
            userId: null
        });

        assert(false, 'Double reversal block', 'deveria ter falhado (já revertido)');
    } catch (err) {
        assert(true, 'Double reversal block', `falha esperada: ${err.message}`);
        assert(err.message.includes('already been reversed'), 'Erro específico', 'mensagem inclui "already been reversed"');
    }

    // Verificar que saldos não mudaram
    const farinhaAfterDoubleAttempt = await StockBalance.findById(balFarinha._id);
    const ovoAfterDoubleAttempt = await StockBalance.findById(balOvo._id);

    assert(farinhaAfterDoubleAttempt.balance === farinhaAfterReversal.balance, 'Farinha após dupla tentativa', `${farinhaAfterDoubleAttempt.balance}g (não mudou)`);
    assert(ovoAfterDoubleAttempt.balance === ovoAfterReversal.balance, 'Ovo após dupla tentativa', `${ovoAfterDoubleAttempt.balance}un (não mudou)`);

    // Verificar que nenhum movimento duplicado foi criado
    const totalReversalMovements = await StockMovement.find({
        reference: orderA._id.toString(),
        type: 'recipe_deduction_reversal'
    });
    assert(totalReversalMovements.length === 2, 'Sem movimentos duplicados', `${totalReversalMovements.length} (expected 2 — nenhum extra)`);

    // ========== CENÁRIO C — Rollback em falha simulada ==========
    logSection('Cenário C — Rollback em falha simulada');

    // Criar outro pedido com estoque insuficiente (vai falhar na baixa)
    const orderC = await Order.create({
        store: store._id,
        customerDetails: { name: 'Cliente Test C', phone: '123456789', guests: 1 },
        orderStatus: 'pending',
        bills: { total: 15, tax: 0, totalWithTax: 15 },
        items: [{
            product: product._id,
            name: 'Bolo PHASE5_5',
            quantity: 1,
            price: 15,
            status: 'pending'
        }],
        metadata: { test_phase5_5: true }
    });

    // Simular: pedido sem baixa de estoque (stockDeductionStatus = 'pending')
    orderC.stockDeductionStatus = 'pending';
    await orderC.save();

    // Tentar reverter pedido sem baixa
    try {
        await stockReversalService.reverseOrderStockDeduction({
            orderId: orderC._id.toString(),
            reason: 'Tentativa de reversão sem baixa',
            userId: null
        });

        assert(false, 'Reversal without deduction', 'deveria ter falhado (sem baixa)');
    } catch (err) {
        assert(true, 'Reversal without deduction', `falha esperada: ${err.message}`);
        assert(err.message.includes('no stock was deducted') || err.message.includes('No recipe_deduction'), 'Erro específico', err.message);
    }

    // Tentar reverter pedido que não existe
    try {
        await stockReversalService.reverseOrderStockDeduction({
            orderId: new mongoose.Types.ObjectId().toString(),
            reason: 'Tentativa com ID inexistente',
            userId: null
        });

        assert(false, 'Reversal non-existent order', 'deveria ter falhado (pedido inexistente)');
    } catch (err) {
        assert(true, 'Reversal non-existent order', `falha esperada: ${err.message}`);
    }

    // Testar cancelOrder
    logSection('Teste — cancelOrder com reversão');

    // Criar pedido com baixa
    const orderCancel = await processSaleWithDeduction(store, product, recipe, 1, [balFarinha, balOvo]);

    const farinhaBeforeCancel = await StockBalance.findById(balFarinha._id);
    const saldoAntes = farinhaBeforeCancel.balance;
    logDetail('Farinha antes do cancel', `${saldoAntes}g`);

    const cancelResult = await stockReversalService.cancelOrder({
        orderId: orderCancel._id.toString(),
        reason: 'Cancelamento operacional',
        userId: null
    });

    assert(cancelResult.success === true, 'Cancel success', cancelResult.success);
    assert(cancelResult.order.orderStatus === 'cancelled', 'Order status cancelled', cancelResult.order.orderStatus);
    assert(cancelResult.stockReversed === true, 'Stock reversed on cancel', cancelResult.stockReversed);

    const farinhaAfterCancel = await StockBalance.findById(balFarinha._id);
    // Farinha: 300 * 1.05 * 1 = 315g deduzido
    const expectedAfterCancel = saldoAntes + 315;
    logDetail('Farinha depois do cancel', `${farinhaAfterCancel.balance}g (antes=${saldoAntes}, +315g revertido)`);

    assert(farinhaAfterCancel.balance === expectedAfterCancel, 'Farinha após cancel', `${farinhaAfterCancel.balance}g (expected ${expectedAfterCancel})`);

    // Tentar cancelar pedido já cancelado
    try {
        await stockReversalService.cancelOrder({
            orderId: orderCancel._id.toString(),
            reason: 'Duplo cancelamento',
            userId: null
        });

        assert(false, 'Double cancel block', 'deveria ter falhado (já cancelado)');
    } catch (err) {
        assert(true, 'Double cancel block', `falha esperada: ${err.message}`);
    }

    // ========== VALIDAR CAMPOS ADICIONADOS ==========
    logSection('Validação — Campos adicionados');

    // Verificar tipo recipe_deduction_reversal no enum
    const reversalMov = await StockMovement.findOne({ type: 'recipe_deduction_reversal' });
    assert(reversalMov !== null, 'recipe_deduction_reversal type exists', `found: ${reversalMov?.type}`);
    assert(reversalMov.reversalOf !== null, 'reversalOf field exists', `${reversalMov.reversalOf}`);

    // Verificar campos no Order
    const orderWithFields = await Order.findById(orderA._id);
    assert(orderWithFields.stockReversalStatus !== undefined, 'stockReversalStatus exists', orderWithFields.stockReversalStatus);
    assert(orderWithFields.stockReversedAt !== undefined, 'stockReversedAt exists', orderWithFields.stockReversedAt);
    assert(orderWithFields.stockReversalReason !== undefined, 'stockReversalReason exists', orderWithFields.stockReversalReason);
    assert(orderWithFields.stockReversalMovements !== undefined, 'stockReversalMovements exists', `${orderWithFields.stockReversalMovements?.length || 0} movements`);

    // Verificar campos nos itens
    const itemWithReversal = orderWithFields.items[0];
    assert(itemWithReversal.stockReversalStatus !== undefined, 'Item stockReversalStatus exists', itemWithReversal.stockReversalStatus);
    assert(itemWithReversal.stockReversalMovements !== undefined, 'Item stockReversalMovements exists', `${itemWithReversal.stockReversalMovements?.length || 0} movements`);

    // ========== ENDPOINTS ==========
    logSection('Validação — Endpoints registrados');

    const fs = require('fs');
    const path = require('path');
    const routeFile = path.join(__dirname, '../routes/orderRoute.js');
    const routeContent = fs.readFileSync(routeFile, 'utf8');

    assert(routeContent.includes('/:id/reverse-stock'), 'reverse-stock route', 'encontrada');
    assert(routeContent.includes('/:id/cancel'), 'cancel route', 'encontrada');
    assert(routeContent.includes('orderReversalController'), 'orderReversalController import', 'encontrado');

    // ========== CLEANUP ==========
    logSection('Cleanup');
    await GlobalIngredient.deleteMany({ name: { $regex: /PHASE5_5/i } });
    await Product.deleteMany({ name: { $regex: /PHASE5_5/i } });
    await Recipe.deleteMany({ name: { $regex: /PHASE5_5/i } });
    await StockLocation.deleteMany({ description: /PHASE5_5_TEST/i });
    await Order.deleteMany({ 'metadata.test_phase5_5': true });
    await StockMovement.deleteMany({ 'metadata.test_phase5_5': true });
    await StockBalance.deleteMany({ 'metadata.test_phase5_5': true });
    console.log('  Test data cleaned');

    // ========== RESUMO ==========
    console.log(`\n=== RESUMO ===`);
    console.log(`Total: ${passCount + failCount} | Pass: ${passCount} | Fail: ${failCount}`);

    await mongoose.disconnect();

    if (failCount > 0) {
        console.log('\n⚠️  Algumas validações FALHARAM');
        process.exit(1);
    } else {
        console.log('\n✅ Todas as validações passaram — Fase 5.5 completa');
        process.exit(0);
    }
}

run().catch(async (err) => {
    console.error('Phase 5.5 test failed:', err);
    await mongoose.disconnect();
    process.exit(1);
});
