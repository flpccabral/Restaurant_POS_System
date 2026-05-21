# Fase 6: Subscription & Billing (SaaS)

## Visão Geral

A Fase 6 implementou o sistema completo de gestão de assinaturas e faturamento, habilitando o modelo de negócio SaaS multi-loja com:

1. **Planos de Assinatura** - Basic, Pro, Enterprise com limites configuráveis
2. **Período de Trial** - 7-30 dias grátis para teste
3. **Gestão de Limites** - Controle de lojas, usuários, dispositivos, pedidos e produtos
4. **Upgrade/Downgrade** - Mudança de plano com regras de negócio
5. **Cancelamento e Reativação** - Fluxo completo de churn
6. **Estatísticas de Receita** - MRR (Monthly Recurring Revenue) e métricas SaaS
7. **Preparado para Stripe** - Integração com gateway de pagamento

---

## Arquitetura

### Modelo de Dados

```
┌─────────────┐         ┌───────────────────┐
│    Plan     │◄────────│   Subscription    │
│             │         │                   │
│ - slug      │         │ - store           │
│ - price     │         │ - plan            │
│ - limits    │         │ - status          │
│ - features  │         │ - trialEnd        │
└─────────────┘         │ - price           │
                        │ - invoices[]      │
                        │ - usage{}         │
                        └───────────────────┘
                                 │
                                 │
                                 ▼
                        ┌───────────────────┐
                        │      Store        │
                        │                   │
                        │ - subscriptionPlan│
                        └───────────────────┘
```

### Ciclo de Vida da Assinatura

```
┌──────────┐    ┌─────────┐    ┌──────────┐    ┌──────────┐
│  TRIAL   │───►│ ACTIVE  │───►│ PAST_DUE │───►│ CANCELED │
└──────────┘    └─────────┘    └──────────┘    └──────────┘
     │                │                                 │
     │                │                                 │
     ▼                ▼                                 ▼
  Expirar         Cancelar                         Reativar
```

---

## Modelos de Dados

### Plan (Plano)

```javascript
// models/planModel.js
const planSchema = {
    planId: String,           // ID único (basic, pro, enterprise)
    name: String,             // Nome exibido
    slug: String,             // Slug para API
    description: String,
    price: Number,            // Preço em centavos
    billingCycle: String,     // monthly, quarterly, yearly
    discountPercent: Number,  // Desconto para anual
    limits: {
        stores: Number,       // Nº de lojas (0 = ilimitado)
        users: Number,        // Nº de usuários
        devices: Number,      // Nº de dispositivos
        orders: Number,       // Nº de pedidos (0 = ilimitado)
        products: Number      // Nº de produtos (0 = ilimitado)
    },
    features: [{
        name: String,
        description: String,
        included: Boolean
    }],
    trialDays: Number,        // Dias de trial
    isPopular: Boolean,       // Destaque no pricing
    isActive: Boolean
};
```

### Subscription (Assinatura)

```javascript
// models/subscriptionModel.js
const subscriptionSchema = {
    subscriptionId: String,   // ID único
    store: ObjectId,          // Loja assinante
    plan: ObjectId,           // Plano assinado
    status: String,           // trialing, active, past_due, canceled, expired
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    trialStart: Date,
    trialEnd: Date,
    canceledAt: Date,         // Soft delete
    cancelReason: String,
    cancelFeedback: String,
    billingCycle: String,
    price: Number,            // Preço pago
    discountPercent: Number,
    paymentMethod: String,    // credit_card, pix, boleto
    stripeSubscriptionId: String,
    stripeCustomerId: String,
    lastPayment: {
        date: Date,
        amount: Number,
        status: String,
        invoiceId: String
    },
    nextBillingDate: Date,
    invoices: [{
        invoiceId: String,
        date: Date,
        amount: Number,
        status: String,
        dueDate: Date,
        paidDate: Date
    }],
    usage: {
        stores: Number,
        users: Number,
        devices: Number,
        orders: Number,
        products: Number
    },
    autoRenew: Boolean
};
```

---

## Endpoints

### Planos

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | `/api/subscription` | Listar planos disponíveis | Público |
| GET | `/api/subscription/:id` | Obter plano por ID | Público |

### Assinatura

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | `/api/subscription/subscription/current` | Assinatura atual | Auth |
| POST | `/api/subscription/subscription` | Criar assinatura (trial) | Auth |
| PUT | `/api/subscription/subscription` | Upgrade/Downgrade | Auth |
| POST | `/api/subscription/subscription/cancel` | Cancelar assinatura | Auth |
| POST | `/api/subscription/subscription/reactivate` | Reativar assinatura | Auth |
| GET | `/api/subscription/subscription/usage` | Verificar limites | Auth |
| GET | `/api/subscription/subscription/invoices` | Histórico de faturas | Auth |

### Admin

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | `/api/subscription/stats` | Estatísticas gerais | Master Admin |
| POST | `/api/subscription/seed` | Criar planos iniciais | Master Admin |

---

## Implementação do Controller

### Listar Planos

```javascript
const getPlans = async (req, res, next) => {
    try {
        const { billingCycle } = req.query;
        const filter = { isActive: true };

        if (billingCycle && ['monthly', 'quarterly', 'yearly'].includes(billingCycle)) {
            filter.billingCycle = billingCycle;
        }

        const plans = await Plan.find(filter).sort({ price: 1 });

        res.status(200).json({
            success: true,
            count: plans.length,
            data: plans.map(plan => ({
                ...plan.toObject(),
                formattedPrice: plan.formattedPrice,
                discountedPrice: plan.discountedPrice,
                isPopular: plan.isPopular
            }))
        });
    } catch (error) {
        next(error);
    }
};
```

### Criar Assinatura com Trial

```javascript
const createSubscription = async (req, res, next) => {
    try {
        const { planId, paymentMethod } = req.body;

        if (!planId) {
            throw createHttpError(400, "Plan ID is required!");
        }

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        // Verificar assinatura existente
        const existing = await Subscription.findOne({
            store: storeRef,
            status: { $in: ['active', 'trialing'] }
        });

        if (existing) {
            throw createHttpError(400, "Store already has an active subscription!");
        }

        // Verificar plano
        const plan = await Plan.findById(planId);

        if (!plan || !plan.isActive) {
            throw createHttpError(404, "Plan not found or inactive!");
        }

        // Criar com trial
        const trialDays = plan.trialDays || 7;
        const subscription = await Subscription.createWithTrial(storeRef, planId, trialDays);

        // Atualizar usage inicial
        await subscription.updateUsage();

        res.status(201).json({
            success: true,
            message: `Subscription created with ${trialDays} days trial!`,
            data: subscription
        });
    } catch (error) {
        next(error);
    }
};
```

### Verificar Limites de Uso

```javascript
const checkUsageLimits = async (req, res, next) => {
    try {
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const subscription = await Subscription.findOne({ store: storeRef });

        if (!subscription) {
            throw createHttpError(404, "Subscription not found!");
        }

        // Atualizar usage atual
        await subscription.updateUsage();

        // Verificar limites contra o plano
        const limitsCheck = await subscription.checkLimits();

        res.status(200).json({
            success: true,
            data: {
                usage: subscription.usage,
                limitsCheck,
                isActive: subscription.isActive
            }
        });
    } catch (error) {
        next(error);
    }
};
```

### Upgrade/Downgrade de Plano

```javascript
const updateSubscription = async (req, res, next) => {
    try {
        const { planId } = req.body;

        if (!planId) {
            throw createHttpError(400, "Plan ID is required!");
        }

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const subscription = await Subscription.findOne({ store: storeRef });

        if (!subscription) {
            throw createHttpError(404, "Subscription not found!");
        }

        const newPlan = await Plan.findById(planId);

        if (!newPlan) {
            throw createHttpError(404, "Plan not found!");
        }

        const isUpgrade = newPlan.price > subscription.price;
        const isDowngrade = newPlan.price < subscription.price;

        // Atualizar plano
        subscription.plan = planId;
        subscription.price = newPlan.price;
        subscription.discountPercent = newPlan.discountPercent;

        if (isUpgrade) {
            // Upgrade imediato
            subscription.status = 'active';
            subscription.trialEnd = null;
        }
        // Downgrade aplica no próximo ciclo

        await subscription.save();

        res.status(200).json({
            success: true,
            message: `Subscription ${isUpgrade ? 'upgraded' : isDowngrade ? 'downgraded' : 'updated'}!`,
            data: subscription
        });
    } catch (error) {
        next(error);
    }
};
```

### Estatísticas SaaS (Admin)

```javascript
const getSubscriptionStats = async (req, res, next) => {
    try {
        if (!req.user.isMasterAdmin) {
            throw createHttpError(403, "Only master admin can access subscription stats!");
        }

        // Total por status
        const statusCount = await Subscription.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Total por plano
        const planCount = await Subscription.aggregate([
            { $match: { status: { $in: ['active', 'trialing'] } } },
            {
                $lookup: {
                    from: 'plans',
                    localField: 'plan',
                    foreignField: '_id',
                    as: 'planInfo'
                }
            },
            { $unwind: '$planInfo' },
            { $group: { _id: '$planInfo.name', count: { $sum: 1 }, revenue: { $sum: '$price' } } }
        ]);

        // MRR (Monthly Recurring Revenue)
        const mrrResult = await Subscription.aggregate([
            { $match: { status: { $in: ['active', 'trialing'] } } },
            { $group: { _id: null, mrr: { $sum: '$price' } } }
        ]);

        // Trials ativos e expirando
        const activeTrials = await Subscription.countDocuments({
            status: 'trialing',
            trialEnd: { $gt: new Date() }
        });

        const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        const trialsExpiring = await Subscription.countDocuments({
            status: 'trialing',
            trialEnd: { $lte: threeDaysFromNow, $gt: new Date() }
        });

        // Formatar resposta
        const statusMap = {};
        statusCount.forEach(s => { statusMap[s._id] = s.count; });
        const mrr = mrrResult[0]?.mrr || 0;

        res.status(200).json({
            success: true,
            data: {
                subscriptions: {
                    total: Object.values(statusMap).reduce((a, b) => a + b, 0),
                    byStatus: statusMap
                },
                plans: planCount.map(p => ({ name: p._id, count: p.count, revenue: p.revenue })),
                revenue: { mrr, mrrFormatted: (mrr / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
                trials: { active: activeTrials, expiringSoon: trialsExpiring }
            }
        });
    } catch (error) {
        next(error);
    }
};
```

---

## Planos Pré-configurados

### Basic (R$ 99/mês)

| Recurso | Limite |
|---------|--------|
| Lojas | 1 |
| Usuários | 5 |
| Dispositivos | 3 |
| Pedidos/mês | 500 |
| Produtos | 100 |
| Trial | 7 dias |

**Features incluídas:**
- Multi-tenancy
- Gestão de estoque
- Fichas técnicas
- Relatórios básicos

### Pro (R$ 199/mês) - Mais Popular

| Recurso | Limite |
|---------|--------|
| Lojas | 3 |
| Usuários | 15 |
| Dispositivos | 10 |
| Pedidos/mês | Ilimitado |
| Produtos | Ilimitado |
| Trial | 14 dias |

**Features incluídas (tudo do Basic +):**
- Relatórios completos
- WebSockets (tempo real)
- API completa
- Suporte prioritário

### Enterprise (R$ 399/mês)

| Recurso | Limite |
|---------|--------|
| Lojas | Ilimitado |
| Usuários | Ilimitado |
| Dispositivos | Ilimitado |
| Pedidos/mês | Ilimitado |
| Produtos | Ilimitado |
| Trial | 30 dias |

**Features incluídas (tudo do Pro +):**
- Relatórios avançados
- Integrações customizadas
- Suporte dedicado

---

## Arquivos Criados

### Novos Modelos

| Arquivo | Descrição |
|---------|-----------|
| `models/planModel.js` | Schema de planos |
| `models/subscriptionModel.js` | Schema de assinaturas |

### Novos Controllers

| Arquivo | Descrição |
|---------|-----------|
| `controllers/subscriptionController.js` | Gestão de assinaturas e planos |

### Novas Rotas

| Arquivo | Descrição |
|---------|-----------|
| `routes/subscriptionRoutes.js` | Rotas de subscription |

### Arquivos Modificados

| Arquivo | Modificação |
|---------|-------------|
| `app.js` | Registro das rotas de subscription |

---

## Exemplos de Uso

### 1. Seed de Planos (Admin)

```bash
curl -X POST http://localhost:8000/api/subscription/seed \
  -H "Authorization: Bearer <master_admin_token>"
```

### 2. Listar Planos

```bash
curl http://localhost:8000/api/subscription \
  -H "Authorization: Bearer <token>"
```

**Resposta:**
```json
{
    "success": true,
    "count": 3,
    "data": [
        {
            "planId": "basic",
            "name": "Basic",
            "slug": "basic",
            "description": "Para pequenos negócios",
            "price": 9900,
            "formattedPrice": "R$ 99,00",
            "billingCycle": "monthly",
            "discountPercent": 10,
            "trialDays": 7,
            "isPopular": false,
            "limits": {
                "stores": 1,
                "users": 5,
                "devices": 3,
                "orders": 500,
                "products": 100
            },
            "features": [...]
        },
        {
            "planId": "pro",
            "name": "Pro",
            "price": 19900,
            "formattedPrice": "R$ 199,00",
            "isPopular": true,
            ...
        },
        {
            "planId": "enterprise",
            "name": "Enterprise",
            "price": 39900,
            "formattedPrice": "R$ 399,00",
            ...
        }
    ]
}
```

### 3. Criar Assinatura (Trial)

```bash
curl -X POST http://localhost:8000/api/subscription/subscription \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"planId": "pro"}'
```

**Resposta:**
```json
{
    "success": true,
    "message": "Subscription created with 14 days trial!",
    "data": {
        "subscriptionId": "sub_1716307200000_abc123",
        "store": "65f1234567890abcdef12340",
        "plan": {
            "_id": "65f1234567890abcdef12350",
            "name": "Pro",
            "slug": "pro"
        },
        "status": "trialing",
        "currentPeriodStart": "2026-05-21T00:00:00.000Z",
        "currentPeriodEnd": "2026-06-20T00:00:00.000Z",
        "trialStart": "2026-05-21T00:00:00.000Z",
        "trialEnd": "2026-06-04T00:00:00.000Z",
        "price": 19900,
        "usage": {
            "stores": 1,
            "users": 3,
            "devices": 2,
            "orders": 45,
            "products": 28
        }
    }
}
```

### 4. Verificar Assinatura Atual

```bash
curl http://localhost:8000/api/subscription/subscription/current \
  -H "Authorization: Bearer <token>"
```

### 5. Verificar Limites de Uso

```bash
curl http://localhost:8000/api/subscription/subscription/usage \
  -H "Authorization: Bearer <token>"
```

**Resposta:**
```json
{
    "success": true,
    "data": {
        "usage": {
            "stores": 1,
            "users": 12,
            "devices": 8,
            "orders": 1250,
            "products": 89
        },
        "limitsCheck": {
            "allowed": true,
            "violations": []
        },
        "isActive": true
    }
}
```

### 6. Upgrade de Plano

```bash
curl -X PUT http://localhost:8000/api/subscription/subscription \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"planId": "enterprise"}'
```

### 7. Cancelar Assinatura

```bash
curl -X POST http://localhost:8000/api/subscription/subscription/cancel \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "too_expensive",
    "feedback": "Preço não cabe no orçamento atual"
  }'
```

### 8. Estatísticas SaaS (Admin)

```bash
curl http://localhost:8000/api/subscription/stats \
  -H "Authorization: Bearer <master_admin_token>"
```

**Resposta:**
```json
{
    "success": true,
    "data": {
        "subscriptions": {
            "total": 127,
            "byStatus": {
                "active": 98,
                "trialing": 15,
                "past_due": 8,
                "canceled": 6
            }
        },
        "plans": [
            { "name": "Basic", "count": 45, "revenue": 445500 },
            { "name": "Pro", "count": 67, "revenue": 1333300 },
            { "name": "Enterprise", "count": 15, "revenue": 598500 }
        ],
        "revenue": {
            "mrr": 2377300,
            "mrrFormatted": "R$ 23.773,00"
        },
        "trials": {
            "active": 15,
            "expiringSoon": 5
        }
    }
}
```

---

## Métricas SaaS

### MRR (Monthly Recurring Revenue)

Receita mensal recorrente é a métrica principal de um SaaS.

```javascript
// Cálculo: soma de todas as assinaturas ativas/trialing
MRR = Σ (price de cada assinatura ativa)
```

### Churn Rate

Taxa de cancelamento de assinaturas.

```javascript
// Cálculo mensal
Churn Rate = (Assinaturas canceladas no mês) / (Total no início do mês) × 100
```

### Trial Conversion

Taxa de conversão de trials para pagos.

```javascript
Trial Conversion = (Novos pagos) / (Trials expirados) × 100
```

---

## Integração com Stripe (Preparação)

O sistema está preparado para integração com Stripe:

```javascript
// Campos reservados no modelo
subscriptionSchema: {
    stripeSubscriptionId: String,
    stripeCustomerId: String,
    stripeInvoiceId: String
}

// Planos têm IDs do Stripe
planSchema: {
    stripeProductId: String,
    stripePriceId: String
}
```

### Exemplo de Integração Futura

```javascript
// services/stripeService.js (futuro)
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const createCustomer = async (email, name) => {
    return stripe.customers.create({ email, name });
};

const createSubscription = async (customerId, priceId) => {
    return stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        trial_period_days: 14
    });
};

const cancelSubscription = async (stripeSubscriptionId) => {
    return stripe.subscriptions.cancel(stripeSubscriptionId);
};
```

---

## Webhooks (Futuro)

Para sincronização com Stripe:

```javascript
// routes/webhooks.js (futuro)
router.post('/webhooks/stripe', async (req, res) => {
    const event = req.body;

    switch (event.type) {
        case 'customer.subscription.created':
            // Atualizar assinatura no DB
            break;
        case 'customer.subscription.updated':
            // Atualizar plano/status
            break;
        case 'customer.subscription.deleted':
            // Marcar como cancelada
            break;
        case 'invoice.payment_succeeded':
            // Registrar pagamento
            break;
        case 'invoice.payment_failed':
            // Marcar como past_due
            break;
    }

    res.json({ received: true });
});
```

---

## Troubleshooting

### Problema: Erro ao criar assinatura

**Causa**: Loja já tem assinatura ativa

**Solução**: Cancelar assinatura existente primeiro ou usar endpoint de update

### Problema: Limits check falha

**Causa**: Uso excedeu limites do plano

**Solução**: Fazer upgrade de plano ou reduzir uso (ex: deletar usuários inativos)

### Problema: Trial não funciona

**Causa**: Plano com trialDays = 0

**Solução**: Verificar configuração do plano

### Problema: Stats não retorna dados

**Causa**: Usuário não é master admin

**Solução**: Usar token de master admin

---

## Próximos Passos

1. **Integração Stripe** - Implementar pagamentos reais
2. **Webhooks** - Sincronização automática
3. **Dunning** - Gestão de inadimplência
4. **Notas Fiscais** - Integração com emissão de NF-e
5. **Relatórios de Receita** - Cohort analysis, LTV, CAC

---

## Referências

- [PHASE5_IMPLEMENTATION.md](./PHASE5_IMPLEMENTATION.md) - Dashboard
- [PHASE1_IMPLEMENTATION.md](./PHASE1_IMPLEMENTATION.md) - Multi-tenancy

---

*Documentação criada em: 2026-05-21*
