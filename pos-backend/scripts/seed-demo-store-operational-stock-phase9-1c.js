/**
 * Seed: Estoques Operacionais — Loja Demo - Matriz (Fase 9.1C)
 *
 * Cria/atualiza StockBalances para garantir saldo suficiente para
 * vendas reais no PDV. Idempotente — verifica existência antes de criar.
 *
 * Uso:
 *   node scripts/seed-demo-store-operational-stock-phase9-1c.js [--dry-run]
 *
 * Produtos alvo:
 *   - Refrigerante Lata (stock_item_direct)
 *   - Hambúrguer Artesanal (recipe_composition)
 *     -> Carne Bovina, Pão de Hambúrguer, Queijo Mussarela, Alface, Tomate
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

// ============================================================
// CONFIGURACAO
// ============================================================
const STORE_ID = '6a1101372ff5c713c1b1a147';
const LOCATION_ID = '6a1101527a7bf001d8117a4c';  // Estoque - Loja Demo - Matriz

const TARGET_BALANCES = [
    {
        ingredientId: '6a112740ad56cebe48a24c4e',  // Refrigerante Lata
        ingredientName: 'Refrigerante Lata',
        targetBalance: 100,
        unit: 'unidade',
        averageCost: 3.50,
        notes: 'Para venda direta (stock_item_direct) — Refrigerante Teste'
    },
    {
        ingredientId: '6a1101392ff5c713c1b1a17f',  // Carne Bovina
        ingredientName: 'Carne Bovina',
        targetBalance: 10000,  // 10kg em gramas (baseUnit: g)
        unit: 'g',
        averageCost: 0.045,
        notes: 'Para recipe_composition — Hambúrguer Artesanal (~180g/un)'
    },
    {
        ingredientId: '6a11273cad56cebe48a24c0b',  // Pão de Hambúrguer
        ingredientName: 'Pão de Hambúrguer',
        targetBalance: 100,
        unit: 'unidade',
        averageCost: 1.20,
        notes: 'Para recipe_composition — Hambúrguer Artesanal'
    },
    {
        ingredientId: '6a11013b2ff5c713c1b1a1ac',  // Queijo Mussarela
        ingredientName: 'Queijo Mussarela',
        targetBalance: 5000,
        unit: 'g',
        averageCost: 0.055,
        notes: 'Para recipe_composition — Hambúrguer Artesanal (~50g/un)'
    },
    {
        ingredientId: '6a11013b2ff5c713c1b1a1a3',  // Alface
        ingredientName: 'Alface',
        targetBalance: 50,
        unit: 'unidade',
        averageCost: 2.50,
        notes: 'Para recipe_composition — Hambúrguer Artesanal (~1un/un)'
    },
    {
        ingredientId: '6a11013b2ff5c713c1b1a19d',  // Tomate
        ingredientName: 'Tomate',
        targetBalance: 8000,
        unit: 'g',
        averageCost: 0.015,
        notes: 'Para recipe_composition — Hambúrguer Artesanal (~50g/un)'
    }
];

// ============================================================
// MAIN
// ============================================================
async function run() {
    const isDryRun = process.argv.includes('--dry-run');
    const PREFIX = isDryRun ? '[DRY-RUN]' : '[SEED]';

    console.log(`${PREFIX} Fase 9.1C — Estoques Operacionais Loja Demo - Matriz`);
    console.log(`${PREFIX} Store: ${STORE_ID}`);
    console.log(`${PREFIX} Location: ${LOCATION_ID}`);
    console.log(`${PREFIX} Modo: ${isDryRun ? 'SIMULACAO' : 'EXECUCAO'}`);
    console.log('');

    const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/restaurant_pos';
    await mongoose.connect(MONGO_URI);
    console.log(`${PREFIX} Conectado ao MongoDB\n`);

    // Register models
    require('../models/stockBalanceModel');
    const StockBalance = mongoose.model('StockBalance');

    const report = {
        storeId: STORE_ID,
        locationId: LOCATION_ID,
        executedAt: new Date().toISOString(),
        dryRun: isDryRun,
        results: []
    };

    for (const target of TARGET_BALANCES) {
        const existing = await StockBalance.findOne({
            location: LOCATION_ID,
            ingredient: target.ingredientId
        });

        if (existing) {
            const needsUpdate = existing.balance < target.targetBalance;
            if (needsUpdate) {
                console.log(`${PREFIX}  ${target.ingredientName}: saldo atual ${existing.balance}${existing.unit} < alvo ${target.targetBalance}${target.unit} — ATUALIZANDO`);

                if (!isDryRun) {
                    existing.balance = target.targetBalance;
                    existing.averageCost = target.averageCost;
                    existing.unit = target.unit;
                    await existing.save();
                }

                report.results.push({
                    ingredient: target.ingredientName,
                    ingredientId: target.ingredientId,
                    action: 'updated',
                    previousBalance: existing.balance,
                    newBalance: target.targetBalance,
                    unit: target.unit
                });
            } else {
                console.log(`${PREFIX}  ${target.ingredientName}: saldo ${existing.balance}${existing.unit} >= ${target.targetBalance}${target.unit} — OK (idempotente)`);
                report.results.push({
                    ingredient: target.ingredientName,
                    ingredientId: target.ingredientId,
                    action: 'no_change',
                    currentBalance: existing.balance,
                    unit: target.unit
                });
            }
        } else {
            console.log(`${PREFIX}  ${target.ingredientName}: NAO EXISTE — CRIANDO (${target.targetBalance} ${target.unit})`);

            if (!isDryRun) {
                await StockBalance.create({
                    location: LOCATION_ID,
                    ingredient: target.ingredientId,
                    balance: target.targetBalance,
                    unit: target.unit,
                    averageCost: target.averageCost,
                    store: STORE_ID
                });
            }

            report.results.push({
                ingredient: target.ingredientName,
                ingredientId: target.ingredientId,
                action: 'created',
                newBalance: target.targetBalance,
                unit: target.unit
            });
        }
    }

    console.log('');
    console.log(`${PREFIX} === RESUMO ===`);
    const created = report.results.filter(r => r.action === 'created').length;
    const updated = report.results.filter(r => r.action === 'updated').length;
    const unchanged = report.results.filter(r => r.action === 'no_change').length;
    console.log(`${PREFIX}  Criados: ${created}`);
    console.log(`${PREFIX}  Atualizados: ${updated}`);
    console.log(`${PREFIX}  Inalterados: ${unchanged}`);
    console.log(`${PREFIX}  Total: ${report.results.length}`);

    console.log(`\n${PREFIX} Concluido.`);

    await mongoose.disconnect();
}

run().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
