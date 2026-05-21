# Phase 8 Implementation - Mobile & PDV APIs

## Overview

This phase implements the Point of Sale (PDV) APIs for mobile and desktop POS terminals. The PDV system provides complete cash session management, payment processing, and real-time tracking of all monetary movements.

### Key Features

- **Cash Session Management**: Open, track, and close cash sessions with balance reconciliation
- **Payment Processing**: Multiple payment methods (cash, credit/debit cards, PIX, voucher)
- **Sangria & Suprimento**: Cash withdrawal and deposit operations during session
- **Payment Refunds**: Secure refund process with manager approval
- **Daily Reports**: Payment extracts and PDV summaries
- **Real-time Integration**: WebSocket events for payment confirmation

---

## Files Created/Modified

### Created Files

| File | Description |
|------|-------------|
| `models/paymentModel.js` | Enhanced payment model with gateway integration |
| `models/cashSessionModel.js` | Cash session lifecycle and movement tracking |
| `controllers/pdvController.js` | PDV business logic (10 endpoints) |
| `routes/pdvRoutes.js` | PDV API routes |
| `docs/PHASE8_IMPLEMENTATION.md` | This documentation |

### Modified Files

| File | Modification |
|------|-------------|
| `app.js` | Added `/api/pdv` route registration |
| `services/websocketService.js` | Payment events already integrated (Phase 3) |

---

## Data Models

### Payment Model (`models/paymentModel.js`)

```javascript
const paymentSchema = {
    paymentId: String (UUID),
    store: ObjectId -> Store,
    order: ObjectId -> Order,
    orderNumber: String,
    amount: Number,
    currency: String (default: 'BRL'),
    method: ['cash', 'credit_card', 'debit_card', 'pix', 'boleto', 'voucher', 'gift_card'],
    status: ['pending', 'approved', 'declined', 'refunded', 'cancelled'],
    installments: Number (1-12),
    cardInfo: { brand, last4, cardType },
    pixInfo: { qrCode, txid, expiresAt },
    voucherInfo: { provider, cardNumber },
    change: Number,
    paidAmount: Number,
    gateway: { provider, transactionId, authorizationCode, nsu },
    user: ObjectId -> User,
    cashier: ObjectId -> User,
    session: ObjectId -> CashSession
}
```

**Key Methods:**
- `approve(gatewayData)` - Approve payment with gateway info
- `decline(reason)` - Decline payment
- `refund(amount, reason)` - Refund approved payment

**Static Methods:**
- `getStorePayments(storeId, options)` - Query payments by store
- `getTotalsByMethod(storeId, startDate, endDate)` - Aggregate totals by payment method

---

### CashSession Model (`models/cashSessionModel.js`)

```javascript
const cashSessionSchema = {
    sessionId: String (UUID),
    sessionNumber: String (sequential daily),
    store: ObjectId -> Store,
    cashier: ObjectId -> User,
    device: ObjectId -> Device,
    status: ['open', 'closed', 'suspended'],
    openedAt: Date,
    closedAt: Date,
    closedBy: ObjectId -> User,
    initialBalance: Number,
    finalBalance: Number,
    expectedBalance: Number,
    difference: Number,
    movements: [{
        type: ['sangria', 'suprimento', 'abertura', 'fechamento', 'pagamento', 'cancelamento'],
        amount: Number,
        method: String,
        description: String,
        user: ObjectId,
        createdAt: Date,
        metadata: Mixed
    }],
    payments: [{
        payment: ObjectId -> Payment,
        orderNumber: String,
        amount: Number,
        method: String,
        createdAt: Date
    }],
    totals: {
        cash: Number,
        credit_card: Number,
        debit_card: Number,
        pix: Number,
        voucher: Number,
        total: Number,
        refunds: Number,
        cancellations: Number
    },
    observations: { opening, closing },
    signed: { cashier, manager }
}
```

**Pre-save Hook:** Automatically recalculates `totals` and `expectedBalance` when movements or payments change.

**Key Methods:**
- `open(initialBalance)` - Open session with initial float
- `sangria(amount, description, userId)` - Withdraw cash
- `suprimento(amount, description, userId)` - Deposit cash
- `addPayment(paymentData)` - Register payment
- `close(finalBalance, observations, userId)` - Close and reconcile
- `getSummary()` - Get session summary

**Static Methods:**
- `getActiveSession(storeId, cashierId)` - Find open session
- `generateSessionNumber()` - Generate daily sequential number (YYYYMMDD###)

---

## API Endpoints

### Session Management

#### Open Cash Session
```http
POST /api/pdv/session/open
Authorization: Bearer <token>
Roles: cashier, manager, admin

Request Body:
{
    "initialBalance": 100.00,
    "deviceId": "uuid",
    "observations": "Fundo de troco padrão"
}

Response (201):
{
    "success": true,
    "message": "Cash session opened successfully!",
    "data": {
        "sessionId": "uuid",
        "sessionNumber": "20260521001",
        "cashier": "user-id",
        "status": "open",
        "openedAt": "2026-05-21T08:00:00.000Z",
        "initialBalance": 100,
        "expectedBalance": 100,
        "totals": { cash: 100, credit_card: 0, ... },
        "movementsCount": 1,
        "paymentsCount": 0
    }
}
```

#### Get Active Session
```http
GET /api/pdv/session/active
Authorization: Bearer <token>
Roles: cashier, manager, admin

Response (200):
{
    "success": true,
    "data": { ...session summary... } | null
}
```

#### Close Cash Session
```http
POST /api/pdv/session/close
Authorization: Bearer <token>
Roles: manager, admin

Request Body:
{
    "finalBalance": 1250.50,
    "observations": "Sem quebra de caixa"
}

Response (200):
{
    "success": true,
    "message": "Cash session closed successfully!",
    "data": {
        ...session summary...,
        "finalBalance": 1250.50,
        "difference": 12.30,  // Positive = surplus, Negative = shortage
        "duration": 480  // minutes
    }
}
```

---

### Cash Movements

#### Perform Sangria (Cash Withdrawal)
```http
POST /api/pdv/sangria
Authorization: Bearer <token>
Roles: manager, admin

Request Body:
{
    "amount": 500.00,
    "description": "Retirada para fornecedor"
}

Response (200):
{
    "success": true,
    "message": "Sangria registered successfully!",
    "data": { ...updated session summary... }
}
```

#### Perform Suprimento (Cash Deposit)
```http
POST /api/pdv/suprimento
Authorization: Bearer <token>
Roles: manager, admin

Request Body:
{
    "amount": 200.00,
    "description": "Troco adicional"
}

Response (200):
{
    "success": true,
    "message": "Suprimento registered successfully!",
    "data": { ...updated session summary... }
}
```

---

### Payment Processing

#### Process Payment
```http
POST /api/pdv/payment
Authorization: Bearer <token>
Roles: cashier, manager, admin

Request Body:
{
    "orderId": "order-uuid",
    "method": "credit_card",
    "amount": 150.00,
    "paidAmount": 150.00,
    "installments": 3,
    "cardInfo": {
        "brand": "Visa",
        "last4": "4242",
        "cardType": "credit"
    }
}

Response (200):
{
    "success": true,
    "message": "Payment processed successfully!",
    "data": {
        "paymentId": "uuid",
        "orderNumber": "ORD-12345",
        "amount": 150,
        "method": "credit_card",
        "status": "approved",
        "installments": 3,
        "cardInfo": { ... }
    }
}
```

**Notes:**
- Automatically links payment to active cash session
- Updates order status to 'paid'
- Emits WebSocket event `order:status-changed`

#### Refund Payment
```http
POST /api/pdv/payment/:paymentId/refund
Authorization: Bearer <token>
Roles: manager, admin

Request Body:
{
    "reason": "Produto com defeito",
    "amount": 150.00  // Optional, defaults to full amount
}

Response (200):
{
    "success": true,
    "message": "Payment refunded successfully!",
    "data": { ...payment with status: 'refunded' ... }
}
```

---

### Reports

#### Get Session History
```http
GET /api/pdv/sessions?status=closed&limit=30&startDate=2026-05-01&endDate=2026-05-21
Authorization: Bearer <token>
Roles: manager, admin

Response (200):
{
    "success": true,
    "count": 15,
    "data": [ ...sessions... ]
}
```

#### Get Daily Payments Report
```http
GET /api/pdv/daily-payments?date=2026-05-21
Authorization: Bearer <token>
Roles: cashier, manager, admin

Response (200):
{
    "success": true,
    "data": {
        "date": "2026-05-21",
        "totals": {
            "cash": { "total": 1500, "count": 25 },
            "credit_card": { "total": 3200, "count": 18 },
            "debit_card": { "total": 800, "count": 10 },
            "pix": { "total": 450, "count": 5 },
            "voucher": { "total": 200, "count": 2 },
            "total": 6150,
            "totalCount": 60
        },
        "payments": [ ...individual payments... ],
        "summary": {
            "totalRevenue": 6150,
            "totalTransactions": 60,
            "byMethod": { ... }
        }
    }
}
```

#### Get PDV Summary
```http
GET /api/pdv/summary
Authorization: Bearer <token>
Roles: cashier, manager, admin

Response (200):
{
    "success": true,
    "data": {
        "session": { ...active session or null ... },
        "orders": {
            "pending": 5,
            "today": 42
        },
        "payments": {
            "today": { ...totals by method... }
        },
        "timestamp": "2026-05-21T14:30:00.000Z"
    }
}
```

---

## Implementation Details

### Multi-tenancy Pattern

All PDV endpoints follow the store isolation pattern:

```javascript
const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;
```

This ensures:
- Regular users only access their own store
- Master admins can specify a store context
- Data isolation is maintained at query level

---

### Session Number Generation

Session numbers are generated daily with format `YYYYMMDD###`:

```javascript
const prefix = today.toISOString().split('T')[0].replace(/-/g, ''); // 20260521
const lastSession = await CashSession.findOne({ sessionNumber: new RegExp(`^${prefix}`) })
    .sort({ sessionNumber: -1 });
const sequence = lastSession ? parseInt(lastSession.sessionNumber.slice(-3)) + 1 : 1;
return `${prefix}${String(sequence).padStart(3, '0')}`; // 20260521001
```

---

### Automatic Total Calculation

The `cashSessionModel` uses a pre-save hook to automatically calculate totals:

```javascript
cashSessionSchema.pre('save', async function(next) {
    if (this.isModified('movements') || this.isModified('payments')) {
        // Recalculate totals from payments
        this.payments.forEach(p => {
            totals[p.method] += p.amount;
            totals.total += p.amount;
        });
        
        // Adjust for sangrias (withdrawals)
        this.movements.forEach(m => {
            if (m.type === 'sangria') {
                totals[m.method] -= m.amount;
                totals.total -= m.amount;
            }
        });
        
        this.totals = totals;
        this.expectedBalance = this.initialBalance + totals.total;
    }
    next();
});
```

---

### WebSocket Integration

Payment processing emits real-time events:

```javascript
const io = req.app.get('io');
ws.emitOrderStatusChanged(io, storeRef, order, order.orderStatus);
```

Frontend clients subscribed to `store:{storeId}` receive instant updates.

---

## Security Considerations

### Role-based Access

| Endpoint | Allowed Roles |
|----------|--------------|
| session/open | cashier, manager, admin |
| session/active | cashier, manager, admin |
| session/close | manager, admin |
| sangria | manager, admin |
| suprimento | manager, admin |
| payment | cashier, manager, admin |
| payment/refund | manager, admin |
| sessions | manager, admin |
| daily-payments | cashier, manager, admin |
| summary | cashier, manager, admin |

---

### Validation Rules

- **Sangria**: Cannot exceed available cash (`totals.cash`)
- **Refund**: Only approved payments can be refunded
- **Amount**: Must be positive (> 0)
- **Session Close**: Requires final balance

---

## Testing Guide

### 1. Open Session
```bash
curl -X POST http://localhost:3333/api/pdv/session/open \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"initialBalance": 100, "observations": "Abertura padrão"}'
```

### 2. Process Payment
```bash
curl -X POST http://localhost:3333/api/pdv/payment \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"orderId": "order-uuid", "method": "cash", "amount": 50, "paidAmount": 100}'
```

### 3. Perform Sangria
```bash
curl -X POST http://localhost:3333/api/pdv/sangria \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 200, "description": "Retirada teste"}'
```

### 4. Close Session
```bash
curl -X POST http://localhost:3333/api/pdv/session/close \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"finalBalance": 350, "observations": "Fechamento sem quebra"}'
```

### 5. Get Daily Report
```bash
curl -X GET "http://localhost:3333/api/pdv/daily-payments?date=2026-05-21" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Troubleshooting

### "No active cash session found"
- User must open a session before processing payments
- Check if session was opened by the same cashier
- Master admins can access sessions from any store with `storeId` header

### "Insufficient cash for sangria"
- Sangria can only withdraw from cash payments
- Card/PIX payments don't count as physical cash
- Check `totals.cash` in session summary

### "Cannot refund non-approved payment"
- Only payments with status 'approved' can be refunded
- Check payment status before attempting refund

### Session Number Conflict
- Session numbers are unique per day
- System auto-increments from last session
- Manual conflicts are prevented by unique index

---

## Frontend Integration Example

### React Hook for PDV Session

```javascript
function useCashSession() {
    const [session, setSession] = useState(null);
    
    const openSession = async (initialBalance) => {
        const res = await api.post('/pdv/session/open', { initialBalance });
        setSession(res.data.data);
    };
    
    const processPayment = async (paymentData) => {
        const res = await api.post('/pdv/payment', paymentData);
        // Refresh session to get updated totals
        const sessionRes = await api.get('/pdv/session/active');
        setSession(sessionRes.data.data);
    };
    
    const closeSession = async (finalBalance, observations) => {
        const res = await api.post('/pdv/session/close', { finalBalance, observations });
        setSession(null);
        return res.data.data; // Returns closed session with difference
    };
    
    return { session, openSession, processPayment, closeSession };
}
```

---

## Next Steps (Future Phases)

- **Phase 9**: Delivery integrations (iFood, Uber Eats, Rappi)
- **Fiscal Integration**: NFC-e, SAT CF-e for Brazilian compliance
- **Offline Mode**: Local-first PDV with sync capability
- **Multi-device Support**: Sync across multiple PDV terminals

---

## Summary

Phase 8 delivers a complete PDV backend with:
- ✅ Cash session lifecycle management
- ✅ Multiple payment methods with gateway support
- ✅ Sangria and suprimento operations
- ✅ Automatic balance reconciliation
- ✅ Payment refunds with audit trail
- ✅ Daily reports and summaries
- ✅ WebSocket integration for real-time updates
- ✅ Role-based access control

The PDV APIs are production-ready and follow all established patterns from previous phases.
