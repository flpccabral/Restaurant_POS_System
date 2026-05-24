/**
 * Migration: Regras de Impacto em Estoque (Fase 9.1A)
 *
 * Aplica configurações de sellableType e stockImpactRule para produtos
 * da Loja Demo - Matriz, de forma idempotente.
 *
 * Uso:
 *   node scripts/migrate-stock-impact-rules-phase9-1a.js [--dry-run]
 *
 * Opções:
 *   --dry-run   Apenas simula as alterações, não persiste no banco
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const DEMO_STORE_ID = '6a1101372ff5c713c1b1a147';

const MIGRATIONS = [
    {
        productName: 'Hamburgue',
        updates: {
            sellableType: 'prepared_product',
            stockImpactRule: 'recipe_composition',
            $unset: { directStockItem: '', directStockQuantity: '', directStockUnit: '' }
        }
    },
    {
        productName: 'Hamburguer Artesanal',
        updates: {
            sellableType: 'prepared_product',
            stockImpactRule: 'recipe_composition',
            $unset: { directStockItem: '', directStockQuantity: '', directStockUnit: '' }
        }
    },
    {
        productName: 'Pizza Margherita',
        updates: {
            sellableType: 'prepared_product',
            stockImpactRule: 'recipe_composition',
            $unset: { directStockItem: '', directStockQuantity: '', directStockUnit: '' }
        }
    },
    {
        productName: 'Refrigerante',
        updates: {
            sellableType: 'industrialized_resale',
            stockImpactRule: 'stock_item_direct',
            // directStockItem será resolvido dinamicamente abaixo
            directStockQuantity: 1,
            directStockUnit: 'unidade'
        },
        needsIngredient: 'Refrigerante Lata'
    },
    {
        productName: 'Refrigerante Teste',
        updates: {
            sellableType: 'industrialized_resale',
            stockImpactRule: 'stock_item_direct',
            directStockQuantity: 1,
            directStockUnit: 'unidade'
        },
        needsIngredient: 'Refrigerante Lata'
    },
    {
        productName: 'Produto Sem Receita',
        updates: {
            isActive: false
        }
    }
];

async function runMigration() {
    const isDryRun = process.argv.includes('--dry-run');
    const prefix = isDryRun ? '[DRY-RUN]' : '[MIGRATE]';

    console.log(`${prefix} Fase 9.1A — Regras de Impacto em Estoque`);
    console.log(`${prefix} Loja Demo - Matriz: ${DEMO_STORE_ID}`);
    console.log(`${prefix} Modo: ${isDryRun ? 'SIMULACAO (--dry-run)' : 'EXECUCAO'}`);
    console.log('');

    const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/restaurant_pos';

    await mongoose.connect(MONGO_URI);
    console.log(`${prefix} Conectado ao MongoDB\n`);

    // Register models by requiring their files
    require('../models/productModel');
    require('../models/globalIngredientModel');

    const Product = mongoose.model('Product');
    const GlobalIngredient = mongoose.model('GlobalIngredient');

    // 1. Resolver ingredient IDs
    const ingredientCache = {};
    for (const m of MIGRATIONS) {
        if (m.needsIngredient) {
            if (!ingredientCache[m.needsIngredient]) {
                const ingredient = await GlobalIngredient.findOne({
                    name: { $regex: new RegExp(`^${escapeRegex(m.needsIngredient)}$`, 'i') }
                }).lean();

                if (ingredient) {
                    ingredientCache[m.needsIngredient] = ingredient._id;
                    console.log(`${prefix}  Ingrediente encontrado: ${m.needsIngredient} -> ${ingredient._id}`);
                } else {
                    console.warn(`${prefix}  AVISO: Ingrediente '${m.needsIngredient}' nao encontrado!`);
                }
            }
        }
    }
    console.log('');

    // 2. Migrar ingredientes: marcar Refrigerante Lata com isSellableDirectly
    const refrigeranteLata = await GlobalIngredient.findOne({
        name: { $regex: /^refrigerante lata$/i }
    });

    if (refrigeranteLata) {
        const ingredientUpdates = { isSellableDirectly: true };
        if (refrigeranteLata.itemType !== 'industrialized') {
            ingredientUpdates.itemType = 'industrialized';
        }

        const needsIngredientUpdate = !refrigeranteLata.isSellableDirectly || refrigeranteLata.itemType !== 'industrialized';

        if (needsIngredientUpdate) {
            if (isDryRun) {
                console.log(`${prefix}  [DRY-RUN] Refrigerante Lata -> isSellableDirectly: true, itemType: industrialized`);
                console.log(`${prefix}    (atual: isSellableDirectly=${refrigeranteLata.isSellableDirectly}, itemType=${refrigeranteLata.itemType})`);
            } else {
                await GlobalIngredient.findByIdAndUpdate(refrigeranteLata._id, ingredientUpdates);
                console.log(`${prefix}  Refrigerante Lata atualizado: isSellableDirectly: true, itemType: industrialized`);
            }
        } else {
            console.log(`${prefix}  Refrigerante Lata ja esta configurado (idempotente)`);
        }
    } else {
        console.warn(`${prefix}  AVISO: Ingrediente 'Refrigerante Lata' nao encontrado para marcar isSellableDirectly`);
    }
    console.log('');

    // 3. Migrar produtos
    const report = {
        storeId: DEMO_STORE_ID,
        executedAt: new Date().toISOString(),
        dryRun: isDryRun,
        changes: []
    };

    for (const m of MIGRATIONS) {
        const filter = {
            store: DEMO_STORE_ID,
            name: { $regex: new RegExp(`^${escapeRegex(m.productName)}$`, 'i') }
        };

        const product = await Product.findOne(filter).lean();

        if (!product) {
            console.warn(`${prefix}  AVISO: Produto '${m.productName}' nao encontrado na loja Demo - Matriz`);
            report.changes.push({
                productName: m.productName,
                status: 'not_found',
                message: 'Produto nao encontrado na loja'
            });
            continue;
        }

        // Build updates
        const updateData = { ...m.updates };

        // Resolve directStockItem if needed
        if (m.needsIngredient && ingredientCache[m.needsIngredient]) {
            updateData.directStockItem = ingredientCache[m.needsIngredient];
        }

        // Check if already migrated (idempotent)
        const needsUpdate = Object.keys(updateData).some(key => {
            if (key === '$unset') return false; // Always check $unset separately
            return String(product[key]) !== String(updateData[key]);
        });

        // Check $unset fields
        const unsetFields = updateData.$unset ? Object.keys(updateData.$unset) : [];
        const hasUnsetNeeded = unsetFields.some(f => product[f] != null);

        if (!needsUpdate && !hasUnsetNeeded) {
            console.log(`${prefix}  Produto '${m.productName}' ja esta atualizado (idempotente)`);
            report.changes.push({
                productName: m.productName,
                status: 'skipped',
                message: 'Ja configurado'
            });
            continue;
        }

        // Show what will change
        const changes = {};
        for (const [key, value] of Object.entries(updateData)) {
            if (key === '$unset') continue;
            if (String(product[key]) !== String(value)) {
                changes[key] = { from: product[key], to: value };
            }
        }
        for (const field of unsetFields) {
            if (product[field] != null) {
                changes[field] = { from: product[field], to: null };
            }
        }

        console.log(`${prefix}  Produto '${m.productName}' (${product._id}):`);
        for (const [field, vals] of Object.entries(changes)) {
            console.log(`    ${field}: ${JSON.stringify(vals.from)} -> ${JSON.stringify(vals.to)}`);
        }

        if (!isDryRun) {
            const updatePayload = {};
            const unsetPayload = {};

            for (const [key, value] of Object.entries(updateData)) {
                if (key === '$unset') continue;
                updatePayload[key] = value;
            }
            if (updateData.$unset) {
                for (const field of Object.keys(updateData.$unset)) {
                    unsetPayload[field] = '';
                }
            }

            const op = {};
            if (Object.keys(updatePayload).length > 0) op.$set = updatePayload;
            if (Object.keys(unsetPayload).length > 0) op.$unset = unsetPayload;

            await Product.findByIdAndUpdate(product._id, op);

            console.log(`${prefix}  -> Atualizado com sucesso`);
        } else {
            console.log(`${prefix}  -> [DRY-RUN] Nao persisti`);
        }

        report.changes.push({
            productName: m.productName,
            productId: product._id.toString(),
            status: isDryRun ? 'dry_run' : 'updated',
            changes
        });
    }

    // 4. Summary
    console.log('\n' + '='.repeat(60));
    console.log(`${prefix} RESUMO DA MIGRACAO`);
    console.log('='.repeat(60));
    const updated = report.changes.filter(c => c.status === 'updated').length;
    const skipped = report.changes.filter(c => c.status === 'skipped').length;
    const notFound = report.changes.filter(c => c.status === 'not_found').length;
    const dryRunCount = report.changes.filter(c => c.status === 'dry_run').length;
    console.log(`  Produtos atualizados: ${updated}`);
    console.log(`  Produtos ja ok: ${skipped}`);
    console.log(`  Produtos nao encontrados: ${notFound}`);
    console.log(`  Dry-run: ${dryRunCount}`);
    console.log(`  Ingrediente marcado isSellableDirectly: ${refrigeranteLata ? 'verificado' : 'nao encontrado'}`);
    console.log('');

    await mongoose.disconnect();
    console.log(`${prefix} Migration concluida`);

    return report;
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

runMigration()
    .then((report) => {
        console.log('\nRelatorio:', JSON.stringify(report, null, 2));
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
