/**
 * Migration: Dados Operacionais Fase 9.1C
 *
 * 1. Atualiza metadados do produto Hambúrguer Artesanal (Matriz)
 * 2. Atualiza a Ficha Técnica existente com ingredients corretos
 * 3. Cria produto "Taxa de Serviço" com no_stock_impact
 *
 * Idempotente.
 *
 * Uso:
 *   node scripts/migrate-phase9-1c-data.js [--dry-run]
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const DEMO_STORE_ID = '6a1101372ff5c713c1b1a147';
const HAMBURGUER_ID = '6a123a2b0824a97594d48d7a';
const EXISTING_RECIPE_ID = '6a123a2c0824a97594d48d91';
const CATEGORY_LANCHES = '6a11b675515e85eb24eaf40b';

async function run() {
    const isDryRun = process.argv.includes('--dry-run');
    const PREFIX = isDryRun ? '[DRY-RUN]' : '[MIGRATE]';

    console.log(`${PREFIX} Fase 9.1C — Dados Operacionais`);
    console.log(`${PREFIX} Store: ${DEMO_STORE_ID}`);
    console.log(`\n`);

    const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/restaurant_pos';
    await mongoose.connect(MONGO_URI);
    console.log(`${PREFIX} Conectado ao MongoDB\n`);

    // Register models
    require('../models/productModel');
    require('../models/recipeModel');
    require('../models/globalIngredientModel');
    require('../models/categoryModel');

    const Product = mongoose.model('Product');
    const Recipe = mongoose.model('Recipe');
    const GlobalIngredient = mongoose.model('GlobalIngredient');
    const Category = mongoose.model('Category');

    // ============================================================
    // 1. ATUALIZAR METADADOS DO PRODUTO
    // ============================================================
    console.log(`${PREFIX} === 1. Produto: Hambúrguer Artesanal ===`);

    const product = await Product.findById(HAMBURGUER_ID);
    if (!product) {
        console.error(`${PREFIX}  ERRO: Produto ${HAMBURGUER_ID} nao encontrado!`);
        process.exit(1);
    }

    console.log(`${PREFIX}  Produto: ${product.name} (${product._id})`);
    console.log(`${PREFIX}    sellableType atual: ${product.sellableType || '(unset)'}`);
    console.log(`${PREFIX}    stockImpactRule atual: ${product.stockImpactRule || '(unset)'}`);
    console.log(`${PREFIX}    productReadinessStatus atual: ${product.productReadinessStatus || '(unset)'}`);

    const productUpdates = {
        sellableType: 'prepared_product',
        stockImpactRule: 'recipe_composition',
        productReadinessStatus: 'ready_for_sale'
    };

    const needsProductUpdate = (
        product.sellableType !== productUpdates.sellableType ||
        product.stockImpactRule !== productUpdates.stockImpactRule ||
        product.productReadinessStatus !== productUpdates.productReadinessStatus
    );

    if (needsProductUpdate) {
        if (isDryRun) {
            console.log(`${PREFIX}  [DRY-RUN] Atualizaria metadados do produto`);
            console.log(`${PREFIX}    set:`, JSON.stringify(productUpdates));
        } else {
            await Product.findByIdAndUpdate(HAMBURGUER_ID, productUpdates);
            console.log(`${PREFIX}  Metadados do produto atualizados OK`);
        }
    } else {
        console.log(`${PREFIX}  Produto ja configurado (idempotente)`);
    }

    // ============================================================
    // 2. ATUALIZAR FICHA TECNICA
    // ============================================================
    console.log(`\n${PREFIX} === 2. Ficha Técnica: Hambúrguer Artesanal ===`);

    // Resolve ingredient IDs by name
    const resolveIngredient = async (name) => {
        const ing = await GlobalIngredient.findOne({ name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') } }).lean();
        if (!ing) {
            console.warn(`${PREFIX}  AVISO: Ingrediente '${name}' nao encontrado!`);
        }
        return ing;
    };

    const carneBovina = await resolveIngredient('Carne Bovina');
    const paoHamburguer = await resolveIngredient('Pão de Hambúrguer');
    const queijoMussarela = await resolveIngredient('Queijo Mussarela');
    const alface = await resolveIngredient('Alface');
    const tomate = await resolveIngredient('Tomate');

    if (!carneBovina || !paoHamburguer || !queijoMussarela || !alface || !tomate) {
        console.error(`${PREFIX}  ERRO: Ingredientes necessarios nao encontrados. Abortando.`);
        process.exit(1);
    }

    const targetIngredients = [
        {
            ingredient: carneBovina._id,
            netQuantity: 180,
            lossFactor: 10,
            unit: 'g',
            substitute: null
        },
        {
            ingredient: paoHamburguer._id,
            netQuantity: 1,
            lossFactor: 0,
            unit: 'unidade',
            substitute: null
        },
        {
            ingredient: queijoMussarela._id,
            netQuantity: 50,
            lossFactor: 5,
            unit: 'g',
            substitute: null
        },
        {
            ingredient: alface._id,
            netQuantity: 1,
            lossFactor: 10,
            unit: 'unidade',
            substitute: null
        },
        {
            ingredient: tomate._id,
            netQuantity: 40,
            lossFactor: 5,
            unit: 'g',
            substitute: null
        }
    ];

    // The SKU from the product's variation P is: "hambúrguer-artesanal-p"
    const variationSku = 'hambúrguer-artesanal-p';

    // Check existing recipe
    const existingRecipe = await Recipe.findById(EXISTING_RECIPE_ID);
    if (existingRecipe) {
        console.log(`${PREFIX}  Receita existente encontrada: ${existingRecipe._id}`);
        console.log(`${PREFIX}    Nome: ${existingRecipe.name}`);
        console.log(`${PREFIX}    Variation atual: ${existingRecipe.variation}`);
        console.log(`${PREFIX}    SKU atual: ${existingRecipe.sku}`);
        console.log(`${PREFIX}    Versao: ${existingRecipe.version}`);

        const needsSkuFix = existingRecipe.sku !== variationSku || existingRecipe.variation !== variationSku;
        const needsIngredientFix = JSON.stringify(existingRecipe.ingredients.map(i => ({
            ingredient: i.ingredient.toString(),
            netQuantity: i.netQuantity,
            unit: i.unit,
            lossFactor: i.lossFactor
        }))) !== JSON.stringify(targetIngredients.map(i => ({
            ingredient: i.ingredient.toString(),
            netQuantity: i.netQuantity,
            unit: i.unit,
            lossFactor: i.lossFactor
        })));

        if (needsSkuFix || needsIngredientFix) {
            if (isDryRun) {
                console.log(`${PREFIX}  [DRY-RUN] Atualizaria receita:`);
                if (needsSkuFix) console.log(`${PREFIX}    variation: "${existingRecipe.variation}" -> "${variationSku}"`);
                if (needsSkuFix) console.log(`${PREFIX}    sku: "${existingRecipe.sku}" -> "${variationSku}"`);
                if (needsIngredientFix) console.log(`${PREFIX}    ingredients: atualizados`);
            } else {
                existingRecipe.variation = variationSku;
                existingRecipe.sku = variationSku;
                existingRecipe.ingredients = targetIngredients;
                existingRecipe.name = 'Ficha Técnica - Hambúrguer Artesanal (P)';
                existingRecipe.version = (existingRecipe.version || 1) + 1;
                await existingRecipe.save();
                console.log(`${PREFIX}  Receita atualizada OK (versao ${existingRecipe.version})`);
            }
        } else {
            console.log(`${PREFIX}  Receita ja esta correta (idempotente)`);
        }
    } else {
        // Create new recipe
        if (isDryRun) {
            console.log(`${PREFIX}  [DRY-RUN] Criaria nova receita`);
        } else {
            const newRecipe = await Recipe.create({
                recipeId: `recipe-${Date.now()}`,
                store: DEMO_STORE_ID,
                sku: variationSku,
                product: HAMBURGUER_ID,
                variation: variationSku,
                name: 'Ficha Técnica - Hambúrguer Artesanal (P)',
                ingredients: targetIngredients,
                preparationTime: 15,
                yieldQuantity: 1,
                yieldUnit: 'porção',
                version: 1,
                isActive: true
            });
            console.log(`${PREFIX}  Receita criada OK: ${newRecipe._id}`);
        }
    }

    // ============================================================
    // 3. CRIAR PRODUTO "TAXA DE SERVICO"
    // ============================================================
    console.log(`\n${PREFIX} === 3. Produto: Taxa de Serviço ===`);

    let taxaServico = await Product.findOne({
        name: { $regex: /^taxa de serviço$/i },
        store: DEMO_STORE_ID
    });

    if (taxaServico) {
        console.log(`${PREFIX}  Produto 'Taxa de Serviço' ja existe: ${taxaServico._id}`);
        console.log(`${PREFIX}    sellableType: ${taxaServico.sellableType || '(unset)'}`);
        console.log(`${PREFIX}    stockImpactRule: ${taxaServico.stockImpactRule || '(unset)'}`);

        const needsTaxaUpdate = (
            taxaServico.sellableType !== 'service_fee' ||
            taxaServico.stockImpactRule !== 'no_stock_impact'
        );

        if (needsTaxaUpdate) {
            if (isDryRun) {
                console.log(`${PREFIX}  [DRY-RUN] Atualizaria Taxa de Serviço`);
            } else {
                await Product.findByIdAndUpdate(taxaServico._id, {
                    sellableType: 'service_fee',
                    stockImpactRule: 'no_stock_impact',
                    productReadinessStatus: 'ready_for_sale'
                });
                console.log(`${PREFIX}  Taxa de Serviço atualizada OK`);
            }
        } else {
            console.log(`${PREFIX}  Taxa de Serviço ja configurada (idempotente)`);
        }
    } else {
        // Need to create it
        // Check if "Serviços" category exists, if not find the best category
        let servicosCategory = await Category.findOne({
            name: { $regex: /^serviços$/i },
            store: DEMO_STORE_ID
        });

        if (!servicosCategory && isDryRun) {
            console.log(`${PREFIX}  [DRY-RUN] Criaria categoria 'Serviços'`);
        }

        if (!isDryRun) {
            if (!servicosCategory) {
                servicosCategory = await Category.create({
                    name: 'Serviços',
                    store: DEMO_STORE_ID,
                    isActive: true
                });
                console.log(`${PREFIX}  Categoria 'Serviços' criada: ${servicosCategory._id}`);
            }

            // Create variations
            const variations = [{
                name: 'Padrão',
                price: 10.00,
                sku: 'taxa-de-servico-padrao',
                isActive: true,
                variationId: `var-${Date.now()}`
            }];

            await Product.create({
                name: 'Taxa de Serviço',
                store: DEMO_STORE_ID,
                category: servicosCategory._id,
                sellableType: 'service_fee',
                stockImpactRule: 'no_stock_impact',
                productReadinessStatus: 'ready_for_sale',
                price: 10.00,
                variations: variations,
                isActive: true,
                isCurrent: true,
                setupComplete: true
            });
            console.log(`${PREFIX}  Produto 'Taxa de Serviço' criado OK`);
        } else {
            console.log(`${PREFIX}  [DRY-RUN] Criaria produto 'Taxa de Serviço'`);
        }
    }

    console.log(`\n${PREFIX} Migracao Fase 9.1C concluida.`);
    await mongoose.disconnect();
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

run().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
