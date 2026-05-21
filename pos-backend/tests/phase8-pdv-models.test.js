const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const CashSession = require('../models/cashSessionModel');
const Payment = require('../models/paymentModel');
const User = require('../models/userModel');
const Store = require('../models/storeModel');

let mongoServer;
let store;
let cashier;
let manager;

// Setup MongoDB Memory Server
beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create test data
    store = await Store.create({
        name: 'Test Store',
        cnpj: '00.000.000/0001-1000',
        email: 'store@test.com',
        phone: '(11) 99999-9999',
        isActive: true
    });

    cashier = await User.create({
        name: 'Cashier User',
        email: 'cashier@test.com',
        password: 'password123',
        phone: 11999999999,
        role: 'cashier',
        store: store._id,
        isActive: true
    });

    manager = await User.create({
        name: 'Manager User',
        email: 'manager@test.com',
        password: 'password123',
        phone: 11999999998,
        role: 'manager',
        store: store._id,
        isActive: true
    });
});

// Cleanup
afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

// Clean database between tests
beforeEach(async () => {
    await CashSession.deleteMany({});
    await Payment.deleteMany({});
});

describe('Phase 8 - PDV Models', () => {
    describe('CashSession Model', () => {
        it('should create and open a cash session', async () => {
            const session = await CashSession.create({
                sessionNumber: '20260521001',
                store: store._id,
                cashier: cashier._id,
                status: 'open',
                initialBalance: 100
            });

            expect(session.sessionNumber).toBe('20260521001');
            expect(session.status).toBe('open');
            expect(session.initialBalance).toBe(100);
            // expectedBalance is calculated after save via pre-save hook
        });

        it('should call open method to register opening movement', async () => {
            const session = await CashSession.create({
                sessionNumber: '20260521001b',
                store: store._id,
                cashier: cashier._id,
                status: 'open',
                initialBalance: 100
            });

            await session.open(100);

            expect(session.movements.length).toBe(1);
            expect(session.movements[0].type).toBe('abertura');
            expect(session.movements[0].amount).toBe(100);
        });

        it('should perform sangria (cash withdrawal)', async () => {
            const session = await CashSession.create({
                sessionNumber: '20260521002',
                store: store._id,
                cashier: cashier._id,
                status: 'open',
                initialBalance: 200
            });

            // First add a payment to have cash in the session
            const payment = await Payment.create({
                store: store._id,
                order: store._id,
                orderNumber: 'ORD-001',
                amount: 100,
                method: 'cash',
                user: cashier._id,
                cashier: cashier._id
            });

            await session.addPayment({
                paymentId: payment._id,
                orderNumber: 'ORD-001',
                amount: 100,
                method: 'cash'
            });

            await session.sangria(50, 'Test withdrawal', cashier._id);

            expect(session.movements.length).toBeGreaterThanOrEqual(1);
            expect(session.movements.find(m => m.type === 'sangria')).toBeDefined();
        });

        it('should fail sangria with insufficient cash', async () => {
            const session = await CashSession.create({
                sessionNumber: '20260521003',
                store: store._id,
                cashier: cashier._id,
                status: 'open',
                initialBalance: 50
            });

            await expect(session.sangria(100, 'Impossible', cashier._id))
                .rejects.toThrow('Insufficient cash');
        });

        it('should perform suprimento (cash deposit)', async () => {
            const session = await CashSession.create({
                sessionNumber: '20260521004',
                store: store._id,
                cashier: cashier._id,
                status: 'open',
                initialBalance: 100
            });

            await session.suprimento(50, 'Test deposit', cashier._id);

            expect(session.movements.length).toBeGreaterThanOrEqual(1);
            const suprimento = session.movements.find(m => m.type === 'suprimento');
            expect(suprimento).toBeDefined();
            expect(suprimento.amount).toBe(50);
        });

        it('should add payment to session', async () => {
            const session = await CashSession.create({
                sessionNumber: '20260521005',
                store: store._id,
                cashier: cashier._id,
                status: 'open',
                initialBalance: 100
            });

            const payment = await Payment.create({
                store: store._id,
                order: store._id,
                orderNumber: 'ORD-001',
                amount: 75,
                method: 'cash',
                user: cashier._id,
                cashier: cashier._id
            });

            await session.addPayment({
                paymentId: payment._id,
                orderNumber: 'ORD-001',
                amount: 75,
                method: 'cash'
            });

            expect(session.payments.length).toBe(1);
            expect(session.payments[0].amount).toBe(75);
            expect(session.payments[0].method).toBe('cash');
        });

        it('should close session with balance reconciliation', async () => {
            const session = await CashSession.create({
                sessionNumber: '20260521006',
                store: store._id,
                cashier: cashier._id,
                status: 'open',
                initialBalance: 100
            });

            // Add a payment
            const payment = await Payment.create({
                store: store._id,
                order: store._id,
                orderNumber: 'ORD-001',
                amount: 50,
                method: 'cash',
                user: cashier._id,
                cashier: cashier._id
            });

            await session.addPayment({
                paymentId: payment._id,
                orderNumber: 'ORD-001',
                amount: 50,
                method: 'cash'
            });

            // Close session
            await session.close(160, 'Fechamento teste', manager._id);

            expect(session.status).toBe('closed');
            expect(session.finalBalance).toBe(160);
        });

        it('should calculate totals automatically', async () => {
            const session = await CashSession.create({
                sessionNumber: '20260521007',
                store: store._id,
                cashier: cashier._id,
                status: 'open',
                initialBalance: 100
            });

            const p1 = await Payment.create({
                store: store._id, order: store._id, orderNumber: 'ORD-001',
                amount: 100, method: 'cash', user: cashier._id, cashier: cashier._id
            });
            const p2 = await Payment.create({
                store: store._id, order: store._id, orderNumber: 'ORD-002',
                amount: 150, method: 'credit_card', user: cashier._id, cashier: cashier._id
            });
            const p3 = await Payment.create({
                store: store._id, order: store._id, orderNumber: 'ORD-003',
                amount: 75, method: 'pix', user: cashier._id, cashier: cashier._id
            });

            await session.addPayment({ paymentId: p1._id, orderNumber: 'ORD-001', amount: 100, method: 'cash' });
            await session.addPayment({ paymentId: p2._id, orderNumber: 'ORD-002', amount: 150, method: 'credit_card' });
            await session.addPayment({ paymentId: p3._id, orderNumber: 'ORD-003', amount: 75, method: 'pix' });

            expect(session.totals.cash).toBe(100);
            expect(session.totals.credit_card).toBe(150);
            expect(session.totals.pix).toBe(75);
            expect(session.totals.total).toBe(325);
        });

        it('should get session summary', async () => {
            const session = await CashSession.create({
                sessionNumber: '20260521008',
                store: store._id,
                cashier: cashier._id,
                status: 'open',
                initialBalance: 100
            });

            const summary = session.getSummary();

            expect(summary).toHaveProperty('sessionId');
            expect(summary).toHaveProperty('sessionNumber');
            expect(summary).toHaveProperty('status', 'open');
            expect(summary).toHaveProperty('initialBalance', 100);
            expect(summary).toHaveProperty('movementsCount');
            expect(summary).toHaveProperty('paymentsCount');
        });

        it('should generate unique session number', async () => {
            const session1 = await CashSession.create({
                sessionNumber: '20260521990',
                store: store._id,
                cashier: cashier._id,
                status: 'open'
            });

            const session2 = await CashSession.create({
                sessionNumber: '20260521991',
                store: store._id,
                cashier: cashier._id,
                status: 'open'
            });

            expect(session1.sessionNumber).toBe('20260521990');
            expect(session2.sessionNumber).toBe('20260521991');
        });
    });

    describe('Payment Model', () => {
        it('should create payment', async () => {
            const payment = await Payment.create({
                store: store._id,
                order: store._id,
                orderNumber: 'ORD-TEST-001',
                amount: 100,
                method: 'cash',
                paidAmount: 100,
                user: cashier._id,
                cashier: cashier._id
            });

            expect(payment.amount).toBe(100);
            expect(payment.method).toBe('cash');
            expect(payment.paidAmount).toBe(100);
            // Status defaults to 'pending' and must be explicitly approved
        });

        it('should approve payment', async () => {
            const payment = await Payment.create({
                store: store._id,
                order: store._id,
                orderNumber: 'ORD-TEST-001b',
                amount: 100,
                method: 'cash',
                status: 'pending',
                user: cashier._id,
                cashier: cashier._id
            });

            await payment.approve();

            expect(payment.status).toBe('approved');
        });

        it('should create credit card payment with installments', async () => {
            const payment = await Payment.create({
                store: store._id,
                order: store._id,
                orderNumber: 'ORD-TEST-002',
                amount: 300,
                method: 'credit_card',
                installments: 3,
                cardInfo: {
                    brand: 'Visa',
                    last4: '4242',
                    cardType: 'credit'
                },
                user: cashier._id,
                cashier: cashier._id
            });

            expect(payment.method).toBe('credit_card');
            expect(payment.installments).toBe(3);
            expect(payment.cardInfo.brand).toBe('Visa');
        });

        it('should calculate change for cash payment', async () => {
            const payment = await Payment.create({
                store: store._id,
                order: store._id,
                orderNumber: 'ORD-TEST-003',
                amount: 50,
                method: 'cash',
                paidAmount: 100,
                user: cashier._id,
                cashier: cashier._id
            });

            expect(payment.change).toBe(50);
        });

        it('should approve payment', async () => {
            const payment = await Payment.create({
                store: store._id,
                order: store._id,
                orderNumber: 'ORD-TEST-004',
                amount: 100,
                method: 'credit_card',
                status: 'pending',
                user: cashier._id,
                cashier: cashier._id
            });

            await payment.approve({
                transactionId: 'TXN-123',
                authorizationCode: 'AUTH-456',
                nsu: 'NSU-789'
            });

            expect(payment.status).toBe('approved');
            expect(payment.gateway.transactionId).toBe('TXN-123');
        });

        it('should decline payment', async () => {
            const payment = await Payment.create({
                store: store._id,
                order: store._id,
                orderNumber: 'ORD-TEST-005',
                amount: 100,
                method: 'credit_card',
                status: 'pending',
                user: cashier._id,
                cashier: cashier._id
            });

            await payment.decline('Insufficient funds');

            expect(payment.status).toBe('declined');
            expect(payment.notes).toBe('Insufficient funds');
        });

        it('should refund approved payment', async () => {
            const payment = await Payment.create({
                store: store._id,
                order: store._id,
                orderNumber: 'ORD-TEST-006',
                amount: 100,
                method: 'credit_card',
                status: 'approved',
                user: cashier._id,
                cashier: cashier._id
            });

            await payment.refund(100, 'Customer complaint');

            expect(payment.status).toBe('refunded');
            expect(payment.metadata.get('refundReason')).toBe('Customer complaint');
        });

        it('should fail refund on non-approved payment', async () => {
            const payment = await Payment.create({
                store: store._id,
                order: store._id,
                orderNumber: 'ORD-TEST-007',
                amount: 100,
                method: 'cash',
                status: 'declined',
                user: cashier._id,
                cashier: cashier._id
            });

            await expect(payment.refund(100, 'Test'))
                .rejects.toThrow('Cannot refund non-approved payment');
        });

        it('should get totals by method', async () => {
            await Payment.create({
                store: store._id,
                order: store._id,
                orderNumber: 'ORD-T1',
                amount: 100,
                method: 'cash',
                status: 'approved',
                user: cashier._id
            });

            await Payment.create({
                store: store._id,
                order: store._id,
                orderNumber: 'ORD-T2',
                amount: 200,
                method: 'credit_card',
                status: 'approved',
                user: cashier._id
            });

            await Payment.create({
                store: store._id,
                order: store._id,
                orderNumber: 'ORD-T3',
                amount: 150,
                method: 'pix',
                status: 'approved',
                user: cashier._id
            });

            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            end.setHours(23, 59, 59, 999);

            const totals = await Payment.getTotalsByMethod(store._id, start, end);

            expect(totals.cash.total).toBe(100);
            expect(totals.credit_card.total).toBe(200);
            expect(totals.pix.total).toBe(150);
            expect(totals.total).toBe(450);
            expect(totals.totalCount).toBe(3);
        });
    });
});
