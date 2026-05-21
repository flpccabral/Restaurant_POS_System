const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Setup MongoDB Memory Server before all tests in this file
beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
});

// Cleanup after all tests
afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

// Clean database between tests
beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        try {
            await collections[key].deleteMany({});
        } catch (err) {
            // Ignore errors
        }
    }
});

// Helper to create test store
const createTestStore = async (overrides = {}) => {
    const Store = require('../models/storeModel');
    return Store.create({
        name: overrides.name || 'Test Store',
        cnpj: overrides.cnpj || `00.000.000/0001-${Math.floor(Math.random() * 9000) + 1000}`,
        email: overrides.email || `store${Date.now()}@test.com`,
        phone: overrides.phone || '(11) 99999-9999',
        isActive: true,
        ...overrides
    });
};

// Helper to create test user
const createTestUser = async (overrides = {}) => {
    const User = require('../models/userModel');
    return User.create({
        name: overrides.name || 'Test User',
        email: overrides.email || `user${Date.now()}@test.com`,
        password: overrides.password || 'password123',
        phone: overrides.phone || 11999999999,
        role: overrides.role || 'admin',
        store: overrides.store || null,
        isActive: true,
        ...overrides
    });
};

// Helper to generate auth token
const generateToken = (user, storeId = null) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
        {
            _id: user._id,
            email: user.email,
            role: user.role,
            store: storeId || user.store,
            isMasterAdmin: user.isMasterAdmin || false
        },
        process.env.JWT_SECRET || 'test-secret-key-for-jwt',
        { expiresIn: '1h' }
    );
};

module.exports = {
    createTestStore,
    createTestUser,
    generateToken
};
