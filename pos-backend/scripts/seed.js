/**
 * Script de Seed - Dados Iniciais e Usuários de Teste
 *
 * Cria:
 * - 1 Loja padrão (Loja Demo - Matriz)
 * - 1 Loja secundária (Loja Demo - Filial)
 * - Roles do sistema (Admin, Gerente, Caixa, Garçom, Operador)
 * - 1 Usuário Master Admin (admin@pos.com)
 * - 1 Gerente de Loja (gerente.demo@pos.com)
 * - 1 Operador/Leitura (operador.demo@pos.com)
 * - 1 Usuário Demo padrão (user@pos.com, Garçom)
 * - Ingredientes globais básicos
 * - Categorias de exemplo
 * - Produtos de exemplo
 * - Receitas de exemplo
 * - Saldos de estoque iniciais
 *
 * Uso: node scripts/seed.js
 *
 * IMPORTANTE: Não usar bcrypt.hash manualmente antes de User.create().
 * O modelo User tem hook pre('save') que faz o hash automaticamente.
 * Fazer hash manual causa double-hash e senha inválida.
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
const StockLocation = require('../models/stockLocationModel');

/**
 * Cria roles do sistema para uma loja específica.
 * Adaptado do roleController.createSystemRoles.
 */
async function createSystemRolesForStore(storeId) {
    const systemRoles = [
        {
            name: 'Admin',
            description: 'Acesso total ao sistema',
            permissions: {
                orders: { create: true, read: true, update: true, delete: true, cancel: true },
                tables: { create: true, read: true, update: true, delete: true },
                products: { create: true, read: true, update: true, delete: true },
                inventory: { create: true, read: true, update: true, delete: true, adjust: true, transfer: true },
                payments: { create: true, read: true, refund: true },
                users: { create: true, read: true, update: true, delete: true, manageRoles: true },
                devices: { read: true, approve: true, revoke: true },
                reports: { read: true, export: true, financial: true },
                settings: { read: true, update: true }
            },
            isSystem: true,
            isActive: true
        },
        {
            name: 'Gerente',
            description: 'Gerente de loja com acesso operacional amplo',
            permissions: {
                orders: { create: true, read: true, update: true, delete: false, cancel: true },
                tables: { create: true, read: true, update: true, delete: false },
                products: { create: false, read: true, update: true, delete: false },
                inventory: { create: true, read: true, update: true, delete: false, adjust: true, transfer: true },
                payments: { create: true, read: true, refund: false },
                users: { create: false, read: true, update: false, delete: false, manageRoles: false },
                devices: { read: true, approve: false, revoke: false },
                reports: { read: true, export: true, financial: false },
                settings: { read: true, update: false }
            },
            isSystem: true,
            isActive: true
        },
        {
            name: 'Operador',
            description: 'Acesso somente leitura ao inventário e operações básicas',
            permissions: {
                orders: { create: false, read: true, update: false, delete: false, cancel: false },
                tables: { create: false, read: true, update: false, delete: false },
                products: { create: false, read: true, update: false, delete: false },
                inventory: { create: false, read: true, update: false, delete: false, adjust: false, transfer: false },
                payments: { create: false, read: true, refund: false },
                users: { create: false, read: false, update: false, delete: false, manageRoles: false },
                devices: { read: false, approve: false, revoke: false },
                reports: { read: true, export: false, financial: false },
                settings: { read: false, update: false }
            },
            isSystem: true,
            isActive: true
        },
        {
            name: 'Caixa',
            description: 'Operações de caixa e pedidos',
            permissions: {
                orders: { create: true, read: true, update: false, delete: false, cancel: true },
                tables: { create: true, read: true, update: false, delete: false },
                products: { create: false, read: true, update: false, delete: false },
                inventory: { create: false, read: false, update: false, delete: false, adjust: false, transfer: false },
                payments: { create: true, read: true, refund: false },
                users: { create: false, read: false, update: false, delete: false, manageRoles: false },
                devices: { read: false, approve: false, revoke: false },
                reports: { read: false, export: false, financial: false },
                settings: { read: false, update: false }
            },
            isSystem: true,
            isActive: true
        },
        {
            name: 'Garçom',
            description: 'Abertura de pedidos e atendimento ao cliente',
            permissions: {
                orders: { create: true, read: true, update: true, delete: false, cancel: false },
                tables: { create: false, read: true, update: false, delete: false },
                products: { create: false, read: true, update: false, delete: false },
                inventory: { create: false, read: false, update: false, delete: false, adjust: false, transfer: false },
                payments: { create: false, read: false, refund: false },
                users: { create: false, read: false, update: false, delete: false, manageRoles: false },
                devices: { read: false, approve: false, revoke: false },
                reports: { read: false, export: false, financial: false },
                settings: { read: false, update: false }
            },
            isSystem: true,
            isActive: true
        }
    ];

    const createdRoles = {};
    for (const roleData of systemRoles) {
        let role = await Role.findOne({ store: storeId, name: roleData.name });
        if (!role) {
            role = await Role.create({
                store: storeId,
                ...roleData
            });
            console.log(`   ✅ Role: ${roleData.name}`);
        } else {
            console.log(`   ℹ️  Role already exists: ${roleData.name}`);
        }
        createdRoles[roleData.name] = role;
    }
    return createdRoles;
}

async function seedDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB Connected');

        // ──────────────────────────────────────────────────────────────────────
        // 1. CRIAR LOJA PADRÃO (MATRIZ)
        // ──────────────────────────────────────────────────────────────────────
        console.log('\n📦 Creating default store (Matriz)...');
        let store1 = await Store.findOne({ cnpj: '00.000.000/0001-00' });

        if (!store1) {
            store1 = await Store.create({
                name: 'Loja Demo - Matriz',
                cnpj: '00.000.000/0001-00',
                email: 'matriz@lojademo.com.br',
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
            console.log('✅ Store created:', store1.name);
        } else {
            console.log('ℹ️  Store already exists:', store1.name);
        }

        // ──────────────────────────────────────────────────────────────────────
        // 2. CRIAR LOJA SECUNDÁRIA (FILIAL)
        // ──────────────────────────────────────────────────────────────────────
        console.log('\n📦 Creating secondary store (Filial)...');
        let store2 = await Store.findOne({ cnpj: '00.000.000/0002-00' });

        if (!store2) {
            store2 = await Store.create({
                name: 'Loja Demo - Filial',
                cnpj: '00.000.000/0002-00',
                email: 'filial@lojademo.com.br',
                phone: '(11) 98888-8888',
                address: {
                    street: 'Avenida Secundária',
                    number: '456',
                    neighborhood: 'Jardins',
                    city: 'São Paulo',
                    state: 'SP',
                    zipCode: '01400-000'
                },
                subscriptionPlan: 'enterprise',
                settings: {
                    taxRate: 5.25,
                    currency: 'BRL',
                    timezone: 'America/Sao_Paulo'
                }
            });
            console.log('✅ Store created:', store2.name);
        } else {
            console.log('ℹ️  Store already exists:', store2.name);
        }

        // Ensure stock locations exist for both stores (for stock balance creation)
        console.log('\n📍 Ensuring stock locations for stores...');
        for (const store of [store1, store2]) {
            const existingLocation = await StockLocation.findOne({
                store: store._id,
                type: 'STORE',
                isActive: true
            });
            if (!existingLocation) {
                await StockLocation.create({
                    store: store._id,
                    name: `${store.name} - Estoque Principal`,
                    code: `${store === store1 ? 'MATRIZ' : 'FILIAL'}-PRINCIPAL`,
                    type: 'STORE',
                    isActive: true
                });
                console.log(`   ✅ Location created for ${store.name}`);
            } else {
                console.log(`   ℹ️  Location exists for ${store.name}`);
            }
        }

        // ──────────────────────────────────────────────────────────────────────
        // 3. CRIAR ROLES DO SISTEMA PARA AMBAS AS LOJAS
        // ──────────────────────────────────────────────────────────────────────
        console.log('\n🔐 Creating system roles...');
        const rolesStore1 = await createSystemRolesForStore(store1._id);
        const rolesStore2 = await createSystemRolesForStore(store2._id);
        console.log('✅ System roles created for both stores');

        // ──────────────────────────────────────────────────────────────────────
        // 4. CRIAR USUÁRIOS DE TESTE
        // ──────────────────────────────────────────────────────────────────────

        // 4a. Master Admin
        console.log('\n👤 Creating master admin user...');
        let admin = await User.findOne({ email: 'admin@pos.com' });

        if (!admin) {
            // IMPORTANTE: Não usar bcrypt.hash aqui — o hook pre('save') do modelo
            // faz o hash automaticamente. Usar bcrypt.hash causa double-hash.
            admin = await User.create({
                name: 'Master Admin',
                email: 'admin@pos.com',
                phone: 11999999999,
                password: 'admin123',
                role: rolesStore1['Admin']._id || 'Admin',
                store: store1._id,
                isMasterAdmin: true,
                isActive: true
            });
            console.log('✅ Master Admin created: admin@pos.com / admin123');
        } else {
            console.log('ℹ️  Master Admin already exists: admin@pos.com');
            // Fix password if it has double-hash issue
            const testMatch = await bcrypt.compare('admin123', admin.password);
            if (!testMatch) {
                console.log('   ⚠️  Double-hash detected! Fixing password...');
                admin.password = 'admin123';
                await admin.save();
                console.log('   ✅ Password fixed!');
            }
        }

        // 4b. Gerente de Loja
        console.log('\n👤 Creating store manager user (Gerente)...');
        let gerente = await User.findOne({ email: 'gerente.demo@pos.com' });

        if (!gerente) {
            gerente = await User.create({
                name: 'Gerente Demo',
                email: 'gerente.demo@pos.com',
                phone: 11977777777,
                password: 'gerente123',
                role: rolesStore1['Gerente']._id,
                store: store1._id,
                isMasterAdmin: false,
                isActive: true
            });
            console.log('✅ Gerente created: gerente.demo@pos.com / gerente123');
        } else {
            console.log('ℹ️  Gerente already exists: gerente.demo@pos.com');
            // Fix double-hash
            const testMatch = await bcrypt.compare('gerente123', gerente.password);
            if (!testMatch) {
                console.log('   ⚠️  Double-hash detected! Fixing password...');
                gerente.password = 'gerente123';
                await gerente.save();
                console.log('   ✅ Password fixed!');
            }
        }

        // 4c. Operador (somente leitura)
        console.log('\n👤 Creating operator user (Operador - readonly)...');
        let operador = await User.findOne({ email: 'operador.demo@pos.com' });

        if (!operador) {
            operador = await User.create({
                name: 'Operador Demo',
                email: 'operador.demo@pos.com',
                phone: 11966666666,
                password: 'operador123',
                role: rolesStore1['Operador']._id,
                store: store1._id,
                isMasterAdmin: false,
                isActive: true
            });
            console.log('✅ Operador created: operador.demo@pos.com / operador123');
        } else {
            console.log('ℹ️  Operador already exists: operador.demo@pos.com');
            // Fix double-hash
            const testMatch = await bcrypt.compare('operador123', operador.password);
            if (!testMatch) {
                console.log('   ⚠️  Double-hash detected! Fixing password...');
                operador.password = 'operador123';
                await operador.save();
                console.log('   ✅ Password fixed!');
            }
        }

        // 4d. Usuário Demo padrão (Garçom, legado)
        console.log('\n👤 Creating standard user (Garçom)...');
        let user = await User.findOne({ email: 'user@pos.com' });

        if (!user) {
            user = await User.create({
                name: 'Usuário Demo',
                email: 'user@pos.com',
                phone: 11988888888,
                password: 'user123',
                role: rolesStore1['Garçom']._id,
                store: store1._id,
                isMasterAdmin: false,
                isActive: true
            });
            console.log('✅ User created: user@pos.com / user123 (Role: Garçom)');
        } else {
            console.log('ℹ️  Standard user already exists: user@pos.com');
            // Fix double-hash
            const testMatch = await bcrypt.compare('user123', user.password);
            if (!testMatch) {
                console.log('   ⚠️  Double-hash detected! Fixing password...');
                user.password = 'user123';
                await user.save();
                console.log('   ✅ Password fixed!');
            }
        }

        // 4e. Segundo gerente na filial (para testar isolamento)
        console.log('\n👤 Creating filial manager (Gerente - Filial)...');
        let gerenteFilial = await User.findOne({ email: 'gerente.filial@pos.com' });

        if (!gerenteFilial) {
            gerenteFilial = await User.create({
                name: 'Gerente Filial',
                email: 'gerente.filial@pos.com',
                phone: 11955555555,
                password: 'gerente123',
                role: rolesStore2['Gerente']._id,
                store: store2._id,
                isMasterAdmin: false,
                isActive: true
            });
            console.log('✅ Gerente Filial created: gerente.filial@pos.com / gerente123');
        } else {
            console.log('ℹ️  Gerente Filial already exists: gerente.filial@pos.com');
        }

        // ──────────────────────────────────────────────────────────────────────
        // 5. CRIAR INGREDIENTES GLOBAIS
        // ──────────────────────────────────────────────────────────────────────
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

        // ──────────────────────────────────────────────────────────────────────
        // 6. CRIAR CATEGORIAS DE EXEMPLO (para ambas as lojas)
        // ──────────────────────────────────────────────────────────────────────
        console.log('\n📂 Creating categories...');
        const categoriesData = [
            { name: 'Bebidas', description: 'Bebidas em geral', order: 0 },
            { name: 'Lanches', description: 'Lanches e sanduíches', order: 1 },
            { name: 'Pratos Principais', description: 'Pratos de almoço e jantar', order: 2 },
            { name: 'Sobremesas', description: 'Doces e sobremesas', order: 3 },
            { name: 'Entradas', description: 'Aperitivos e entradas', order: 4 }
        ];

        const categoriesStore1 = {};
        for (const catData of categoriesData) {
            let category = await Category.findOne({ store: store1._id, name: catData.name });
            if (!category) {
                category = await Category.create({
                    store: store1._id,
                    ...catData
                });
                console.log(`   ✅ Category (Matriz): ${catData.name}`);
            }
            categoriesStore1[catData.name] = category;
        }

        const categoriesStore2 = {};
        for (const catData of categoriesData) {
            let category = await Category.findOne({ store: store2._id, name: catData.name });
            if (!category) {
                category = await Category.create({
                    store: store2._id,
                    ...catData
                });
                console.log(`   ✅ Category (Filial): ${catData.name}`);
            }
            categoriesStore2[catData.name] = category;
        }

        // ──────────────────────────────────────────────────────────────────────
        // 7. CRIAR PRODUTOS DE EXEMPLO
        // ──────────────────────────────────────────────────────────────────────
        console.log('\n🍔 Creating products...');
        const productsData = [
            {
                name: 'Hambúrguer Artesanal',
                categoryKey: 'Lanches',
                variations: [
                    { name: 'P', price: 25.90 },
                    { name: 'M', price: 32.90 },
                    { name: 'G', price: 39.90 }
                ]
            },
            {
                name: 'Pizza Margherita',
                categoryKey: 'Pratos Principais',
                variations: [
                    { name: 'Individual', price: 45.00 },
                    { name: 'Grande', price: 65.00 }
                ]
            },
            {
                name: 'Refrigerante',
                categoryKey: 'Bebidas',
                variations: [
                    { name: 'Lata', price: 6.00 },
                    { name: '600ml', price: 9.00 }
                ]
            }
        ];

        async function createProductsForStore(store, categories) {
            const products = {};
            for (const prodData of productsData) {
                let product = await Product.findOne({ store: store._id, name: prodData.name });
                if (!product) {
                    product = await Product.create({
                        store: store._id,
                        name: prodData.name,
                        category: categories[prodData.categoryKey]._id,
                        variations: prodData.variations.map(v => ({
                            name: v.name,
                            price: v.price,
                            sku: prodData.name.toLowerCase().replace(/\s+/g, '-') + '-' + v.name.toLowerCase()
                        }))
                    });
                    console.log(`   ✅ Product (${store.name}): ${prodData.name}`);
                }
                products[prodData.name] = product;
            }
            return products;
        }

        const productsStore1 = await createProductsForStore(store1, categoriesStore1);
        const productsStore2 = await createProductsForStore(store2, categoriesStore2);

        // ──────────────────────────────────────────────────────────────────────
        // 8. CRIAR RECEITAS (Ficha Técnica)
        // ──────────────────────────────────────────────────────────────────────
        console.log('\n📝 Creating recipes...');
        const recipesData = [
            {
                name: 'Hambúrguer Artesanal - P',
                sku: 'hamburguer-artesanal-p',
                productName: 'Hambúrguer Artesanal',
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
                productName: 'Pizza Margherita',
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
                productName: 'Refrigerante',
                variation: 'Lata',
                ingredients: []
            }
        ];

        async function createRecipesForStore(store, products) {
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
                            product: products[recipeData.productName]._id,
                            variation: recipeData.variation,
                            name: recipeData.name,
                            ingredients,
                            yieldQuantity: 1
                        });
                        console.log(`   ✅ Recipe (${store.name}): ${recipeData.name} (${ingredients.length} ingredientes)`);
                    }
                }
            }
        }

        await createRecipesForStore(store1, productsStore1);
        await createRecipesForStore(store2, productsStore2);

        // ──────────────────────────────────────────────────────────────────────
        // 9. CRIAR SALDO DE ESTOQUE INICIAL
        // ──────────────────────────────────────────────────────────────────────
        console.log('\n📊 Creating initial stock balances...');

        const stockIngredients = [
            { name: 'Carne Bovina', minimumStock: 5000, initialBalance: 10000 },
            { name: 'Pão', minimumStock: 50, initialBalance: 100 },
            { name: 'Queijo Mussarela', minimumStock: 2000, initialBalance: 5000 },
            { name: 'Alface', minimumStock: 20, initialBalance: 50 },
            { name: 'Tomate', minimumStock: 3000, initialBalance: 8000 },
            { name: 'Farinha de Trigo', minimumStock: 10000, initialBalance: 25000 },
            { name: 'Azeite de Oliva', minimumStock: 1000, initialBalance: 3000 }
        ];

        async function createStockForStore(store) {
            const defaultLocation = await StockLocation.findOne({
                store: store._id,
                type: 'STORE',
                isActive: true
            });
            if (!defaultLocation) {
                console.error(`❌ No STOCK_LOCATION found for store ${store.name}.`);
                return;
            }

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
                        console.log(`   ✅ Stock (${store.name}): ${stockData.name} - ${stockData.initialBalance} ${ingredient.baseUnit}`);
                    }
                }
            }
        }

        await createStockForStore(store1);
        await createStockForStore(store2);

        // ──────────────────────────────────────────────────────────────────────
        // RESUMO
        // ──────────────────────────────────────────────────────────────────────
        console.log('\n' + '='.repeat(60));
        console.log('📊 SEED COMPLETED');
        console.log('='.repeat(60));

        const storesCount = await Store.countDocuments();
        const rolesCount = await Role.countDocuments();
        const usersCount = await User.countDocuments();
        const ingredientsCount = await GlobalIngredient.countDocuments();
        const productsCount = await Product.countDocuments();
        const stockCount = await StockBalance.countDocuments();

        console.log('\n🏪 STORES:');
        console.log(`   Total: ${storesCount} stores`);
        const stores = await Store.find().select('name cnpj');
        stores.forEach(s => console.log(`   - ${s.name} (${s.cnpj})`));

        console.log('\n🔐 ROLES CREATED PER STORE:');
        console.log(`   Total: ${rolesCount} roles`);

        console.log('\n👥 USERS:');
        console.log(`   Total: ${usersCount} users`);
        console.log('   📝 CREDENTIALS:');
        console.log('      Master Admin:        admin@pos.com / admin123');
        console.log('      Gerente Loja:         gerente.demo@pos.com / gerente123');
        console.log('      Operador (read-only): operador.demo@pos.com / operador123');
        console.log('      Gerente Filial:       gerente.filial@pos.com / gerente123');
        console.log('      User Demo (Garçom):   user@pos.com / user123');

        console.log('\n🧀 INGREDIENTS:');
        console.log(`   Total: ${ingredientsCount} global ingredients`);

        console.log('\n🍔 PRODUCTS:');
        console.log(`   Total: ${productsCount} products`);

        console.log('\n📊 STOCK BALANCES:');
        console.log(`   Total: ${stockCount} items`);

        console.log('\n✅ Ready to start the server!\n');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Seed failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

seedDatabase();
