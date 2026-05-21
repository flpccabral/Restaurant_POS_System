/**
 * Script de Limpeza do Banco de Dados 🧹
 *
 * Este script remove TODAS as coleções do banco de dados.
 * Use apenas em ambiente de desenvolvimento!
 *
 * Uso: node scripts/migration-cleanup.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const cleanupDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB Connected');

        const collections = await mongoose.connection.db.collections();

        if (collections.length === 0) {
            console.log('📭 Database is already empty!');
            process.exit(0);
        }

        console.log(`📋 Found ${collections.length} collections to drop...\n`);

        for (const collection of collections) {
            await collection.drop();
            console.log(`🗑️  Dropped: ${collection.collectionName}`);
        }

        console.log('\n✅ Database cleaned successfully!');
        console.log('📝 Next step: Run the seed script to populate with sample data.');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
        process.exit(1);
    }
};

cleanupDatabase();
