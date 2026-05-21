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

        // Resumo
        console.log('\n' + '='.repeat(60));
        console.log('📊 SEED COMPLETED');
        console.log('='.repeat(60));

        const rolesCount = await Role.countDocuments({ store: store._id });
        const usersCount = await User.countDocuments({ store: store._id });
        const ingredientsCount = await GlobalIngredient.countDocuments();

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
