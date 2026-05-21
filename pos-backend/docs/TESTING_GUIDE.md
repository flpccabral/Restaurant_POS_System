# Testing Guide - Restaurant POS System

## Overview

This guide covers the testing strategy for the Restaurant POS System backend. Tests are organized by phase and focus on unit testing models and integration testing controllers.

## Test Setup

### Dependencies

- **Jest**: Test framework
- **Supertest**: HTTP assertion library
- **MongoDB Memory Server**: In-memory MongoDB for isolated testing

### Configuration

```bash
# Run all tests
npm test

# Run specific phase tests
npm run test:phase8

# Run with coverage
npm test -- --coverage
```

## Test Files

### Phase 8 - PDV Models (Implemented)

**File**: `tests/phase8-pdv-models.test.js`

Tests the core PDV models:

#### CashSession Model Tests
- ✅ Create and open cash session
- ✅ Open method registers opening movement
- ✅ Perform sangria (cash withdrawal)
- ✅ Perform suprimento (cash deposit)
- ✅ Add payment to session
- ✅ Close session with balance reconciliation
- ✅ Calculate totals automatically
- ✅ Get session summary
- ✅ Generate unique session numbers

#### Payment Model Tests
- ✅ Create payment
- ✅ Approve payment
- ✅ Create credit card payment with installments
- ✅ Calculate change for cash payment
- ✅ Approve payment with gateway data
- ✅ Decline payment
- ✅ Refund approved payment
- ✅ Fail refund on non-approved payment
- ✅ Get totals by method (aggregation)

## Running Tests

### Full Test Suite
```bash
npm test
```

### Single Test File
```bash
npm test -- tests/phase8-pdv-models.test.js
```

### With Coverage
```bash
npm test -- --coverage
```

### Watch Mode
```bash
npm run test:watch
```

## Test Results

### Phase 8 - PDV Models
```
PASS tests/phase8-pdv-models.test.js
  Phase 8 - PDV Models
    CashSession Model
      ✓ should create and open a cash session
      ✓ should call open method to register opening movement
      ✓ should perform sangria (cash withdrawal)
      ✓ should fail sangria with insufficient cash
      ✓ should perform suprimento (cash deposit)
      ✓ should add payment to session
      ✓ should close session with balance reconciliation
      ✓ should calculate totals automatically
      ✓ should get session summary
      ✓ should generate unique session number
    Payment Model
      ✓ should create payment
      ✓ should approve payment
      ✓ should create credit card payment with installments
      ✓ should calculate change for cash payment
      ✓ should approve payment
      ✓ should decline payment
      ✓ should refund approved payment
      ✓ should fail refund on non-approved payment
      ✓ should get totals by method

Tests:       19 passed, 19 total
```

## Model Coverage

### CashSession Model
| Method | Tested |
|--------|--------|
| `create()` | ✅ |
| `open()` | ✅ |
| `sangria()` | ✅ |
| `suprimento()` | ✅ |
| `addPayment()` | ✅ |
| `close()` | ✅ |
| `getSummary()` | ✅ |
| `getActiveSession()` (static) | ⏳ |
| `generateSessionNumber()` (static) | ⏳ |

### Payment Model
| Method | Tested |
|--------|--------|
| `create()` | ✅ |
| `approve()` | ✅ |
| `decline()` | ✅ |
| `refund()` | ✅ |
| `getStorePayments()` (static) | ⏳ |
| `getTotalsByMethod()` (static) | ✅ |

## Future Test Additions

### Phase 1-7 Tests (To Implement)

For future phases, follow the same pattern:

1. **Model Tests**: Test schema validation, instance methods, and static methods
2. **Controller Tests**: Test HTTP endpoints with mocked requests
3. **Integration Tests**: Test full workflows across multiple models

### Example Test Structure

```javascript
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Model = require('../models/yourModel');

let mongoServer;
let testStore;
let testUser;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    
    // Create test fixtures
    testStore = await Store.create({...});
    testUser = await User.create({...});
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    // Clean collections
    await Model.deleteMany({});
});

describe('Your Model', () => {
    it('should do something', async () => {
        // Test implementation
    });
});
```

## Troubleshooting

### MongoDB Connection Issues
If you see "Can't call `openUri()` on an active connection":
- Ensure each test file manages its own MongoDB connection
- Don't use setup files that connect globally
- Use `beforeAll` in each test file

### Validation Errors
If tests fail with validation errors:
- Check required fields in the model schema
- Ensure ObjectId references are valid MongoDB ObjectIds
- Use actual model instances for references, not strings

### Token Authentication
For controller tests requiring authentication:
```javascript
const jwt = require('jsonwebtoken');
const token = jwt.sign(
    { _id: user._id, email: user.email, role: user.role, store: store._id },
    'test-secret-key-for-jwt',
    { expiresIn: '1h' }
);
```

## Coverage Goals

| Component | Target Coverage |
|-----------|----------------|
| Models | 80%+ |
| Controllers | 70%+ |
| Routes | 50%+ |
| Overall | 70%+ |

## CI/CD Integration

Add to your CI pipeline:
```yaml
- name: Run Tests
  run: |
    npm ci
    npm test -- --coverage --ci
```
