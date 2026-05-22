/**
 * Script de Migração - Single para Multi-Loja 🔄
 *
 * Migrar dados existentes para a nova arquitetura multi-tenant.
 *
 * Uso: node scripts/migrate-all.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Store = require('../models/storeModel');
const User = require('../models/userModel');
const Order = require('../models/orderModel');
const Table = require('../models/tableModel');
const Payment = require('../models/paymentModel');

const migrateAll = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB Connected');

        // 1. Criar loja principal
        console.log('\n📦 Creating main store...');
        const store = await Store.create({
            name: 'Loja Principal',
            cnpj: 'MIGRATED-' + Date.now(),
            email: 'contato@empresa.com.br',
            phone: '(11) 99999-9999',
            address: {
                street: 'Rua Principal',
                number: '1000',
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
        console.log('✅ Store created:', store.name, `(${store._id})`);

        // 2. Migrar usuários
        console.log('\n👤 Migrating users...');
        const users = await User.find();

        if (users.length === 0) {
            console.log('⚠️  No users to migrate');
        } else {
            for (let i = 0; i < users.length; i++) {
                users[i].store = store._id;
                users[i].isMasterAdmin = (i === 0); // Primeiro usuário é Master Admin
                users[i].role = users[i].role || 'Admin';
                await users[i].save();
            }
            console.log(`✅ Migrated ${users.length} users`);
            console.log(`   - Master Admin: ${users[0].email}`);
        }

        // 3. Migrar orders
        console.log('\n📋 Migrating orders...');
        const orderResult = await Order.updateMany(
            { store: { $exists: false } },
            { $set: { store: store._id } }
        );
        console.log(`✅ Updated ${orderResult.modifiedCount} orders`);

        // 4. Migrar tables
        console.log('\n🪑 Migrating tables...');
        const tableResult = await Table.updateMany(
            { store: { $exists: false } },
            { $set: { store: store._id } }
        );
        console.log(`✅ Updated ${tableResult.modifiedCount} tables`);

        // 5. Migrar payments
        console.log('\n💳 Migrating payments...');
        const paymentResult = await Payment.updateMany(
            { store: { $exists: false } },
            { $set: { store: store._id } }
        );
        console.log(`✅ Updated ${paymentResult.modifiedCount} payments`);

        // Resumo
        console.log('\n' + '='.repeat(60));
        console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY');
        console.log('='.repeat(60));
        console.log(`\n📦 Store ID: ${store._id}`);
        console.log(`📦 Store Name: ${store.name}`);
        console.log(`📦 CNPJ: ${store.cnpj}`);
        console.log(`\n👥 Total Users: ${users.length}`);
        if (users.length > 0) {
            console.log(`👑 Master Admin: ${users[0].email} (first user)`);
        }
        console.log(`\n📋 Orders migrated: ${orderResult.modifiedCount}`);
        console.log(`🪑 Tables migrated: ${tableResult.modifiedCount}`);
        console.log(`💳 Payments migrated: ${paymentResult.modifiedCount}`);

        console.log('\n📝 NEXT STEPS:');
        console.log('   1. Update your .env file with MONGODB_URI');
        console.log('   2. Run: npm run db:seed (to create sample data)');
        console.log('   3. Start server: npm run dev');
        console.log('   4. Login with admin@pos.com / admin123');
        console.log('   5. Approve pending devices at: /api/device/pending');

        console.log('\n✅ You can now start the server!\n');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
};

migrateAll();
