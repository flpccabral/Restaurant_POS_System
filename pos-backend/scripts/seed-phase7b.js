/**
 * Seed script for Phase 7B Runtime Checkpoint
 *
 * Creates:
 * - Hamburgueria and Bar stores (with operationType)
 * - Locations for each store
 * - Central warehouse
 * - Ingredients with compatibleOperations
 * - Stock balances for central and stores
 * - Stock policies
 * - Test user
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const config = require('../config/config');

const Store = require('../models/storeModel');
const User = require('../models/userModel');
const Role = require('../models/roleModel');
const GlobalIngredient = require('../models/globalIngredientModel');
const StockLocation = require('../models/stockLocationModel');
const StockBalance = require('../models/stockBalanceModel');
const StockPolicy = require('../models/stockPolicyModel');
const StockMovement = require('../models/stockMovementModel');
const OperationalAlert = require('../models/operationalAlertModel');
const ProductionBatch = require('../models/productionBatchModel');

// Clean previous Phase 7B test data
async function cleanTestData() {
    console.log('\n--- Cleaning previous Phase 7B test data ---');
    const stores = await Store.find({ name: { $regex: /PHASE7B/ } });
    const storeIds = stores.map(s => s._id);

    for (const sid of storeIds) {
        await StockBalance.deleteMany({ store: sid });
        await StockPolicy.deleteMany({ store: sid });
        await OperationalAlert.deleteMany({ store: sid });
        await StockMovement.deleteMany({ store: sid });
        await ProductionBatch.deleteMany({ store: sid });
    }

    await Store.deleteMany({ name: { $regex: /PHASE7B/ } });
    await StockLocation.deleteMany({ name: { $regex: /PHASE7B/ } });
    await GlobalIngredient.deleteMany({ name: { $regex: /PHASE7B/ } });
    await StockPolicy.deleteMany({ 'metadata.test_phase7b': true });
    await OperationalAlert.deleteMany({ 'metadata.test_phase7b': true });
    await StockBalance.deleteMany({ 'metadata.test_phase7b': true });
    await StockMovement.deleteMany({ 'metadata.test_phase7b': true });
    await User.deleteMany({ email: 'test@phase7b.com' });

    console.log('  Cleanup done');
}

async function seed() {
    try {
        await mongoose.connect(config.databaseURI);
        console.log('MongoDB connected');

        await cleanTestData();

        // ========== CREATE STORES ==========
        console.log('\n--- Creating stores ---');

        const hamburgueriaStore = await Store.create({
            name: 'PHASE7B Hamburgueria',
            phone: '1111111111',
            email: 'hamburgueria@phase7b.com',
            cnpj: '11.111.111/0001-77',
            operationType: 'hamburgueria',
            isActive: true
        });
        console.log(`  Hamburgueria: ${hamburgueriaStore._id} (opType=${hamburgueriaStore.operationType})`);

        const barStore = await Store.create({
            name: 'PHASE7B Bar',
            phone: '2222222222',
            email: 'bar@phase7b.com',
            cnpj: '22.222.222/0001-77',
            operationType: 'bar',
            isActive: true
        });
        console.log(`  Bar: ${barStore._id} (opType=${barStore.operationType})`);

        // ========== CREATE LOCATIONS ==========
        console.log('\n--- Creating locations ---');

        const hamburgueriaLocation = await StockLocation.getOrCreateStoreLocation(hamburgueriaStore._id, hamburgueriaStore.name);
        console.log(`  Hamburgueria location: ${hamburgueriaLocation._id}`);

        const barLocation = await StockLocation.getOrCreateStoreLocation(barStore._id, barStore.name);
        console.log(`  Bar location: ${barLocation._id}`);

        let centralLocation = await StockLocation.findOne({ type: 'CENTRAL_WAREHOUSE', store: null });
        if (!centralLocation) {
            centralLocation = await StockLocation.create({
                name: 'Central Warehouse PHASE7B',
                type: 'CENTRAL_WAREHOUSE',
                store: null,
                description: 'Central warehouse for Phase 7B testing',
                isActive: true
            });
        }
        console.log(`  Central location: ${centralLocation._id}`);

        // ========== CREATE INGREDIENTS ==========
        console.log('\n--- Creating ingredients ---');

        const pao = await GlobalIngredient.create({
            name: 'Pao de hamburguer PHASE7B',
            category: 'carboidrato',
            baseUnit: 'unidade',
            averageCost: 0.50,
            itemType: 'raw_material',
            productionState: 'raw',
            isByproduct: false,
            compatibleOperations: ['geral', 'hamburgueria'],
            isActive: true
        });
        console.log(`  Pao: ${pao._id} (compat=${JSON.stringify(pao.compatibleOperations)})`);

        const carne = await GlobalIngredient.create({
            name: 'Carne bovina PHASE7B',
            category: 'proteina',
            baseUnit: 'kg',
            averageCost: 45.00,
            itemType: 'raw_material',
            productionState: 'raw',
            isByproduct: false,
            compatibleOperations: ['geral', 'hamburgueria'],
            isActive: true
        });
        console.log(`  Carne: ${carne._id} (compat=${JSON.stringify(carne.compatibleOperations)})`);

        const cerveja = await GlobalIngredient.create({
            name: 'Cerveja PHASE7B',
            category: 'bebida',
            baseUnit: 'unidade',
            averageCost: 6.00,
            itemType: 'raw_material',
            productionState: 'raw',
            isByproduct: false,
            compatibleOperations: ['geral', 'bar'],
            isActive: true
        });
        console.log(`  Cerveja: ${cerveja._id} (compat=${JSON.stringify(cerveja.compatibleOperations)})`);

        // Create an ingredient that NO store has (for purchase_needed scenario)
        const tempero = await GlobalIngredient.create({
            name: 'Tempero especial PHASE7B',
            category: 'tempero',
            baseUnit: 'kg',
            averageCost: 30.00,
            itemType: 'raw_material',
            productionState: 'raw',
            isByproduct: false,
            compatibleOperations: ['geral'],
            isActive: true
        });
        console.log(`  Tempero: ${tempero._id} (for purchase scenario)`);

        // ========== CREATE STOCK BALANCES ==========
        console.log('\n--- Creating stock balances ---');

        // Central warehouse: Pao (50un), Carne (20kg), Cerveja (100un)
        const centralPao = await StockBalance.create({
            store: null,
            location: centralLocation._id,
            ingredient: pao._id,
            balance: 50,
            reserved: 0,
            unit: 'unidade',
            metadata: { test_phase7b: true }
        });
        console.log(`  Central -> Pao: 50unidade`);

        const centralCarne = await StockBalance.create({
            store: null,
            location: centralLocation._id,
            ingredient: carne._id,
            balance: 20,
            reserved: 0,
            unit: 'kg',
            metadata: { test_phase7b: true }
        });
        console.log(`  Central -> Carne: 20kg`);

        const centralCerveja = await StockBalance.create({
            store: null,
            location: centralLocation._id,
            ingredient: cerveja._id,
            balance: 100,
            reserved: 0,
            unit: 'unidade',
            metadata: { test_phase7b: true }
        });
        console.log(`  Central -> Cerveja: 100un`);

        // Hamburgueria: Pao(2unidade - low), Carne(0.5kg - critical)
        const hambPao = await StockBalance.create({
            store: hamburgueriaStore._id,
            location: hamburgueriaLocation._id,
            ingredient: pao._id,
            balance: 2,
            reserved: 0,
            unit: 'unidade',
            metadata: { test_phase7b: true }
        });
        console.log(`  Hamburgueria -> Pao: 2unidade`);

        const hambCarne = await StockBalance.create({
            store: hamburgueriaStore._id,
            location: hamburgueriaLocation._id,
            ingredient: carne._id,
            balance: 0.5,
            reserved: 0,
            unit: 'kg',
            metadata: { test_phase7b: true }
        });
        console.log(`  Hamburgueria -> Carne: 0.5kg`);

        // Hamburgueria Cerveja: 0un (stockout - but cerveja is only compatible with bar/geral, not hamburgueria)
        // So no policy for cerveja at hamburgueria

        // Bar: Cerveja(10unidade), Carne(8kg)
        const barCerveja = await StockBalance.create({
            store: barStore._id,
            location: barLocation._id,
            ingredient: cerveja._id,
            balance: 10,
            reserved: 0,
            unit: 'unidade',
            metadata: { test_phase7b: true }
        });
        console.log(`  Bar -> Cerveja: 10un`);

        const barCarne = await StockBalance.create({
            store: barStore._id,
            location: barLocation._id,
            ingredient: carne._id,
            balance: 8,
            reserved: 0,
            unit: 'kg',
            metadata: { test_phase7b: true }
        });
        console.log(`  Bar -> Carne: 8kg`);

        // Central: tempero 0kg (for purchase_needed scenario)
        await StockBalance.create({
            store: null,
            location: centralLocation._id,
            ingredient: tempero._id,
            balance: 0,
            reserved: 0,
            unit: 'kg',
            metadata: { test_phase7b: true }
        });
        console.log(`  Central -> Tempero: 0kg`);

        // ========== CREATE STOCK POLICIES ==========
        console.log('\n--- Creating stock policies ---');

        // Hamburgueria policies
        const policyPao = await StockPolicy.create({
            store: hamburgueriaStore._id,
            location: hamburgueriaLocation._id,
            ingredient: pao._id,
            minQuantity: 5,
            reorderPoint: 10,
            idealQuantity: 20,
            maxQuantity: 30,
            unit: 'unidade',
            priority: 'high',
            metadata: { test_phase7b: true }
        });
        console.log(`  Hamburgueria -> Pao policy: min=5, reorder=10, ideal=20, max=30`);

        const policyCarne = await StockPolicy.create({
            store: hamburgueriaStore._id,
            location: hamburgueriaLocation._id,
            ingredient: carne._id,
            minQuantity: 1,
            reorderPoint: 5,
            idealQuantity: 10,
            maxQuantity: 15,
            unit: 'kg',
            priority: 'high',
            metadata: { test_phase7b: true }
        });
        console.log(`  Hamburgueria -> Carne policy: min=1, reorder=5, ideal=10, max=15`);

        // Bar policies
        const policyCerveja = await StockPolicy.create({
            store: barStore._id,
            location: barLocation._id,
            ingredient: cerveja._id,
            minQuantity: 5,
            reorderPoint: 10,
            idealQuantity: 20,
            maxQuantity: 40,
            unit: 'unidade',
            priority: 'medium',
            metadata: { test_phase7b: true }
        });
        console.log(`  Bar -> Cerveja policy: min=5, reorder=10, ideal=20, max=40`);

        // ========== CREATE TEST USER ==========
        console.log('\n--- Creating test user ---');

        const existingRole = await Role.findOne({ isActive: true });
        // NOTE: User model has pre-save hook that hashes password, use plain text
        const testUser = await User.create({
            name: 'Phase 7B Test User',
            email: 'test@phase7b.com',
            phone: 1999999999,
            password: 'password123',
            role: existingRole ? existingRole._id : 'admin',
            store: hamburgueriaStore._id,
            isMasterAdmin: true,
            isActive: true
        });
        console.log(`  Test user: test@phase7b.com / password123`);
        console.log(`  User role: ${existingRole ? existingRole.name : 'admin'}`);

        // ========== OUTPUT SUMMARY ==========
        console.log('\n' + '='.repeat(60));
        console.log('PHASE 7B SEED COMPLETED');
        console.log('='.repeat(60));
        console.log('\n--- IDs for testing ---');
        console.log(`HAMBURGUERIA_STORE_ID=${hamburgueriaStore._id}`);
        console.log(`BAR_STORE_ID=${barStore._id}`);
        console.log(`HAMBURGUERIA_LOCATION_ID=${hamburgueriaLocation._id}`);
        console.log(`BAR_LOCATION_ID=${barLocation._id}`);
        console.log(`CENTRAL_LOCATION_ID=${centralLocation._id}`);
        console.log(`PAO_INGREDIENT_ID=${pao._id}`);
        console.log(`CARNE_INGREDIENT_ID=${carne._id}`);
        console.log(`CERVEJA_INGREDIENT_ID=${cerveja._id}`);
        console.log(`TEMPERO_INGREDIENT_ID=${tempero._id}`);
        console.log(`TEST_USER_EMAIL=test@phase7b.com`);
        console.log(`TEST_USER_PASSWORD=password123`);
        console.log('');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Seed failed:', error.message);
        console.error(error.stack);
        await mongoose.disconnect();
        process.exit(1);
    }
}

seed();
