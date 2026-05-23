/**
 * Script de Seed - Dados Iniciais 🌱
 *
 * Cria:
 * - 1 Loja padrão
 * - 1 Usuário Master Admin
 * - Ingredientes globais básicos
 * - Categorias de exemplo
 *
 * Uso: node scripts/seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Import models
const Store = require('../models/storeModel');
const User = require('../models/userModel');
const Role = require('../models/roleModel');
const GlobalIngredient = require('../models/globalIngredientModel');
const Category = require('../models/categoryModel');
const Product = require('../models/productModel');
const Recipe = require('../models/recipeModel');
const StockBalance = require('../models/stockBalanceModel');
const { createSystemRoles } = require('../controllers/roleController');

const seedDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB Connected');

        // 1. Criar Loja Padrão
        console.log('\n📦 Creating default store...');
        let store = await Store.findOne({ cnpj: '00.000.000/0001-00' });

        if (!store) {
            store = await Store.create({
                name: 'Loja Demo - Matriz',
                cnpj: '00.000.000/0001-00',
                email: 'contato@lojademo.com.br',
                phone: '(11) 99999-9999',
                address: {
                    street: 'Rua Demo',
                    number: '123',
                    neighborhood: 'Centro',
                    city: 'São Paulo',
                    state: 'SP',
                    zipCode: '01000-000'
                },
                subscriptionPlan: 'enterprise',
                settings: {
                    taxRate: 5.25,
                    currency: 'BRL',
                    timezone: 'America/Sao_Paulo'
                }
            });
            console.log('✅ Store created:', store.name);
        } else {
            console.log('ℹ️  Store already exists:', store.name);
        }

        // 2. Criar Roles do Sistema
        console.log('\n🔐 Creating system roles...');
        await createSystemRoles(store._id);
        console.log('✅ System roles created: Admin, Gerente, Caixa, Garçom');

        // 3. Criar Master Admin
        console.log('\n👤 Creating master admin user...');
        let admin = await User.findOne({ email: 'admin@pos.com' });

        if (!admin) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            // Buscar role Admin criada acima
            const adminRole = await Role.findOne({ store: store._id, name: 'Admin' });
            admin = await User.create({
                name: 'Master Admin',
                email: 'admin@pos.com',
                phone: 11999999999,
                password: hashedPassword,
                role: adminRole?._id || 'Admin',
                store: store._id,
                isMasterAdmin: true,
                isActive: true
            });
            console.log('✅ Master Admin created: admin@pos.com / admin123');
        } else {
            console.log('ℹ️  Master Admin already exists: admin@pos.com');
        }

        // 4. Criar Usuário de Exemplo (não admin) - Garçom
        console.log('\n👤 Creating standard user (Garçom)...');
        let user = await User.findOne({ email: 'user@pos.com' });

        if (!user) {
            const hashedPassword = await bcrypt.hash('user123', 10);
            // Buscar role Garçom
            const waiterRole = await Role.findOne({ store: store._id, name: 'Garçom' });
            user = await User.create({
                name: 'Usuário Demo',
                email: 'user@pos.com',
                phone: 11988888888,
                password: hashedPassword,
                role: waiterRole?._id || 'Garçom',
                store: store._id,
                isMasterAdmin: false,
                isActive: true
            });
            console.log('✅ User created: user@pos.com / user123 (Role: Garçom)');
        } else {
            console.log('ℹ️  Standard user already exists: user@pos.com');
        }

        // 5. Criar Ingredientes Globais
        console.log('\n🧀 Creating global ingredients...');

        const ingredients = [
            // Proteínas
            { name: 'Frango (Peito)', category: 'proteina', baseUnit: 'g', averageCost: 0.025 },
            { name: 'Carne Bovina', category: 'proteina', baseUnit: 'g', averageCost: 0.045 },
            { name: 'Porco', category: 'proteina', baseUnit: 'g', averageCost: 0.035 },
            { name: 'Peixe (Tilápia)', category: 'proteina', baseUnit: 'g', averageCost: 0.040 },
            { name: 'Ovo', category: 'proteina', baseUnit: 'unidade', averageCost: 0.80 },

            // Carboidratos
            { name: 'Arroz Branco', category: 'carboidrato', baseUnit: 'g', averageCost: 0.008 },
            { name: 'Feijão', category: 'carboidrato', baseUnit: 'g', averageCost: 0.012 },
            { name: 'Macarrão', category: 'carboidrato', baseUnit: 'g', averageCost: 0.010 },
            { name: 'Batata', category: 'carboidrato', baseUnit: 'g', averageCost: 0.006 },
            { name: 'Farinha de Trigo', category: 'carboidrato', baseUnit: 'g', averageCost: 0.005 },
            { name: 'Pão', category: 'carboidrato', baseUnit: 'unidade', averageCost: 0.50 },

            // Vegetais
            { name: 'Tomate', category: 'vegetal', baseUnit: 'g', averageCost: 0.015 },
            { name: 'Cebola', category: 'vegetal', baseUnit: 'g', averageCost: 0.010 },
            { name: 'Alface', category: 'vegetal', baseUnit: 'unidade', averageCost: 2.50 },
            { name: 'Cenoura', category: 'vegetal', baseUnit: 'g', averageCost: 0.012 },
            { name: 'Brócolis', category: 'vegetal', baseUnit: 'g', averageCost: 0.025 },

            // Laticínios
            { name: 'Queijo Mussarela', category: 'laticinio', baseUnit: 'g', averageCost: 0.055 },
            { name: 'Queijo Parmesão', category: 'laticinio', baseUnit: 'g', averageCost: 0.065 },
            { name: 'Leite', category: 'laticinio', baseUnit: 'ml', averageCost: 0.004 },
            { name: 'Manteiga', category: 'laticinio', baseUnit: 'g', averageCost: 0.040 },
            { name: 'Creme de Leite', category: 'laticinio', baseUnit: 'g', averageCost: 0.030 },

            // Temperos
            { name: 'Sal', category: 'tempero', baseUnit: 'g', averageCost: 0.002 },
            { name: 'Pimenta', category: 'tempero', baseUnit: 'g', averageCost: 0.15 },
            { name: 'Alho', category: 'tempero', baseUnit: 'g', averageCost: 0.08 },
            { name: 'Azeite de Oliva', category: 'tempero', baseUnit: 'ml', averageCost: 0.12 },
            { name: 'Óleo', category: 'tempero', baseUnit: 'ml', averageCost: 0.02 },
            { name: 'Vinagre', category: 'tempero', baseUnit: 'ml', averageCost: 0.01 },
            { name: 'Molho de Soja (Shoyu)', category: 'tempero', baseUnit: 'ml', averageCost: 0.05 },
            { name: 'Extrato de Tomate', category: 'tempero', baseUnit: 'g', averageCost: 0.03 },

            // Bebidas
            { name: 'Água', category: 'bebida', baseUnit: 'ml', averageCost: 0.005 },
            { name: 'Refrigerante', category: 'bebida', baseUnit: 'ml', averageCost: 0.01 },
            { name: 'Suco Natural', category: 'bebida', baseUnit: 'ml', averageCost: 0.03 },
            { name: 'Cerveja', category: 'bebida', baseUnit: 'ml', averageCost: 0.02 },
            { name: 'Vinho', category: 'bebida', baseUnit: 'ml', averageCost: 0.08 },
            { name: 'Café', category: 'bebida', baseUnit: 'ml', averageCost: 0.02 },

            // Outros
            { name: 'Açúcar', category: 'outro', baseUnit: 'g', averageCost: 0.004 },
            { name: 'Mel', category: 'outro', baseUnit: 'g', averageCost: 0.05 },
            { name: 'Chocolate', category: 'outro', baseUnit: 'g', averageCost: 0.06 },
            { name: 'Baunilha', category: 'outro', baseUnit: 'ml', averageCost: 0.20 }
        ];

        let createdCount = 0;
        let skippedCount = 0;

        for (const ing of ingredients) {
            const existing = await GlobalIngredient.findOne({ name: ing.name });
            if (!existing) {
                // Adicionar conversões comuns
                if (ing.baseUnit === 'g' || ing.baseUnit === 'kg') {
                    ing.conversionToBase = new Map([
                        ['kg', 1000],
                        ['g', 1],
                        ['xícara', 120],
                        ['colher_sopa', 15],
                        ['colher_chá', 5]
                    ]);
                } else if (ing.baseUnit === 'ml' || ing.baseUnit === 'L') {
                    ing.conversionToBase = new Map([
                        ['L', 1000],
                        ['ml', 1],
                        ['xícara', 240],
                        ['colher_sopa', 15],
                        ['colher_chá', 5]
                    ]);
                }

                await GlobalIngredient.create(ing);
                createdCount++;
            } else {
                skippedCount++;
            }
        }

        console.log(`✅ Created ${createdCount} ingredients (${skippedCount} already existed)`);

        // 6. Criar Categorias de Exemplo
        console.log('\n📂 Creating categories...');
        const categoriesData = [
            { name: 'Bebidas', description: 'Bebidas em geral', order: 0 },
            { name: 'Lanches', description: 'Lanches e sanduíches', order: 1 },
            { name: 'Pratos Principais', description: 'Pratos de almoço e jantar', order: 2 },
            { name: 'Sobremesas', description: 'Doces e sobremesas', order: 3 },
            { name: 'Entradas', description: 'Aperitivos e entradas', order: 4 }
        ];

        const categories = {};
        for (const catData of categoriesData) {
            let category = await Category.findOne({ store: store._id, name: catData.name });
            if (!category) {
                category = await Category.create({
                    store: store._id,
                    ...catData
                });
                console.log(`   ✅ Category: ${catData.name}`);
            }
            categories[catData.name] = category;
        }

        // 7. Criar Produtos de Exemplo
        console.log('\n🍔 Creating products...');
        const productsData = [
            {
                name: 'Hambúrguer Artesanal',
                category: categories['Lanches'],
                variations: [
                    { name: 'P', price: 25.90 },
                    { name: 'M', price: 32.90 },
                    { name: 'G', price: 39.90 }
                ]
            },
            {
                name: 'Pizza Margherita',
                category: categories['Pratos Principais'],
                variations: [
                    { name: 'Individual', price: 45.00 },
                    { name: 'Grande', price: 65.00 }
                ]
            },
            {
                name: 'Refrigerante',
                category: categories['Bebidas'],
                variations: [
                    { name: 'Lata', price: 6.00 },
                    { name: '600ml', price: 9.00 }
                ]
            }
        ];

        const products = {};
        for (const prodData of productsData) {
            let product = await Product.findOne({ store: store._id, name: prodData.name });
            if (!product) {
                product = await Product.create({
                    store: store._id,
                    name: prodData.name,
                    category: prodData.category._id,
                    variations: prodData.variations.map(v => ({
                        name: v.name,
                        price: v.price,
                        sku: prodData.name.toLowerCase().replace(/\s+/g, '-') + '-' + v.name.toLowerCase()
                    }))
                });
                console.log(`   ✅ Product: ${prodData.name} (${prodData.variations.length} variações)`);
            }
            products[prodData.name] = product;
        }

        // 8. Criar Receitas (Ficha Técnica)
        console.log('\n📝 Creating recipes...');
        const recipesData = [
            {
                name: 'Hambúrguer Artesanal - P',
                sku: 'hamburguer-artesanal-p',
                product: products['Hambúrguer Artesanal'],
                variation: 'P',
                ingredients: [
                    { ingredientName: 'Carne Bovina', netQuantity: 150, unit: 'g', lossFactor: 10 },
                    { ingredientName: 'Pão', netQuantity: 1, unit: 'unidade', lossFactor: 0 },
                    { ingredientName: 'Queijo Mussarela', netQuantity: 50, unit: 'g', lossFactor: 5 },
                    { ingredientName: 'Alface', netQuantity: 1, unit: 'unidade', lossFactor: 10 },
                    { ingredientName: 'Tomate', netQuantity: 50, unit: 'g', lossFactor: 5 }
                ]
            },
            {
                name: 'Pizza Margherita - Individual',
                sku: 'pizza-margherita-individual',
                product: products['Pizza Margherita'],
                variation: 'Individual',
                ingredients: [
                    { ingredientName: 'Farinha de Trigo', netQuantity: 200, unit: 'g', lossFactor: 0 },
                    { ingredientName: 'Queijo Mussarela', netQuantity: 100, unit: 'g', lossFactor: 5 },
                    { ingredientName: 'Tomate', netQuantity: 100, unit: 'g', lossFactor: 10 },
                    { ingredientName: 'Azeite de Oliva', netQuantity: 15, unit: 'ml', lossFactor: 0 }
                ]
            },
            {
                name: 'Refrigerante - Lata',
                sku: 'refrigerante-lata',
                product: products['Refrigerante'],
                variation: 'Lata',
                ingredients: []
            }
        ];

        for (const recipeData of recipesData) {
            let recipe = await Recipe.findOne({ store: store._id, sku: recipeData.sku });
            if (!recipe && recipeData.ingredients.length > 0) {
                const ingredients = [];
                for (const ing of recipeData.ingredients) {
                    const globalIng = await GlobalIngredient.findOne({ name: ing.ingredientName });
                    if (globalIng) {
                        ingredients.push({
                            ingredient: globalIng._id,
                            netQuantity: ing.netQuantity,
                            lossFactor: ing.lossFactor,
                            unit: ing.unit
                        });
                    }
                }

                if (ingredients.length > 0) {
                    recipe = await Recipe.create({
                        store: store._id,
                        sku: recipeData.sku,
                        product: recipeData.product._id,
                        variation: recipeData.variation,
                        name: recipeData.name,
                        ingredients,
                        yieldQuantity: 1
                    });
                    console.log(`   ✅ Recipe: ${recipeData.name} (${ingredients.length} ingredientes)`);
                }
            }
        }

        // 9. Criar Saldo de Estoque Inicial
        console.log('\n📊 Creating initial stock balances...');

        // Buscar a localização padrão da loja
        const defaultLocation = await require('../models/stockLocationModel').findOne({
            store: store._id,
            type: 'STORE',
            isActive: true
        });
        if (!defaultLocation) {
            console.error('❌ No default STOCK_LOCATION found for store. Run migration first.');
            process.exit(1);
        }
        console.log(`   📍 Using location: ${defaultLocation.name} (${defaultLocation._id})`);

        const stockIngredients = [
            { name: 'Carne Bovina', minimumStock: 5000, initialBalance: 10000 },
            { name: 'Pão', minimumStock: 50, initialBalance: 100 },
            { name: 'Queijo Mussarela', minimumStock: 2000, initialBalance: 5000 },
            { name: 'Alface', minimumStock: 20, initialBalance: 50 },
            { name: 'Tomate', minimumStock: 3000, initialBalance: 8000 },
            { name: 'Farinha de Trigo', minimumStock: 10000, initialBalance: 25000 },
            { name: 'Azeite de Oliva', minimumStock: 1000, initialBalance: 3000 }
        ];

        for (const stockData of stockIngredients) {
            const ingredient = await GlobalIngredient.findOne({ name: stockData.name });
            if (ingredient) {
                let stockBalance = await StockBalance.findOne({
                    store: store._id,
                    ingredient: ingredient._id
                });

                if (!stockBalance) {
                    stockBalance = await StockBalance.create({
                        store: store._id,
                        location: defaultLocation._id,
                        ingredient: ingredient._id,
                        balance: stockData.initialBalance,
                        reserved: 0,
                        available: stockData.initialBalance,
                        minimumStock: stockData.minimumStock,
                        unit: ingredient.baseUnit,
                        lastPurchasePrice: ingredient.averageCost
                    });
                    console.log(`   ✅ Stock: ${stockData.name} - ${stockData.initialBalance} ${ingredient.baseUnit}`);
                }
            }
        }

        // Resumo
        console.log('\n' + '='.repeat(60));
        console.log('📊 SEED COMPLETED');
        console.log('='.repeat(60));

        const rolesCount = await Role.countDocuments({ store: store._id });
        const usersCount = await User.countDocuments({ store: store._id });
        const ingredientsCount = await GlobalIngredient.countDocuments();
        const categoriesCount = await Category.countDocuments({ store: store._id });
        const productsCount = await Product.countDocuments({ store: store._id });
        const recipesCount = await Recipe.countDocuments({ store: store._id });
        const stockCount = await StockBalance.countDocuments({ store: store._id });

        console.log('\n📦 STORE:');
        console.log(`   Name: ${store.name}`);
        console.log(`   CNPJ: ${store.cnpj}`);

        console.log('\n🔐 ROLES CREATED:');
        console.log(`   Total: ${rolesCount} roles`);
        const roles = await Role.find({ store: store._id }).select('name description');
        roles.forEach(r => console.log(`   - ${r.name}: ${r.description}`));

        console.log('\n👥 USERS:');
        console.log(`   Total: ${usersCount} users`);
        console.log('   📝 CREDENTIALS:');
        console.log('      Master Admin: admin@pos.com / admin123');
        console.log('      Standard User (Garçom): user@pos.com / user123');

        console.log('\n🧀 INGREDIENTS:');
        console.log(`   Total: ${ingredientsCount} global ingredients`);

        console.log('\n📂 CATEGORIES (Fase 2):');
        console.log(`   Total: ${categoriesCount} categories`);

        console.log('\n🍔 PRODUCTS (Fase 2):');
        console.log(`   Total: ${productsCount} products`);

        console.log('\n📝 RECIPES (Fase 2):');
        console.log(`   Total: ${recipesCount} recipes`);

        console.log('\n📊 STOCK BALANCES (Fase 2):');
        console.log(`   Total: ${stockCount} items`);

        console.log('\n✅ Ready to start the server!\n');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Seed failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
};

seedDatabase();
