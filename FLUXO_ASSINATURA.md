# FLUXO DE ASSINATURA — PLANOS, LIMITES E BILLING

## VISÃO GERAL

O sistema opera como SaaS multi-tenant. Cada loja tem uma assinatura com plano, limites e ciclo de cobrança. Os limites são aplicados por middleware no backend — se a loja excede o plano, operações são bloqueadas.

---

## 1. MODELOS DE DADOS

### 1.1 Plano (Plan)

```javascript
{
  _id,
  name: String,                  // "Starter", "Professional", "Enterprise"
  slug: String,                  // starter | professional | enterprise
  description: String,
  isActive: Boolean,
  price: Number,                 // Preço mensal (R$)

  // Limites
  limits: {
    maxStores: Number,           // Lojas por conta
    maxProducts: Number,         // Produtos ativos
    maxUsers: Number,            // Usuários
    maxDevices: Number,          // Dispositivos simultâneos
    maxOrdersPerMonth: Number,   // Pedidos/mês
    maxStorage: Number,          // Armazenamento (MB)
    maxStoresPerUser: Number,    // Lojas que um user pode acessar
    hasKds: Boolean,             // Acesso ao módulo KDS
    hasReports: Boolean,         // Relatórios avançados
    hasMultiStore: Boolean,      // Multi-loja
    hasDelivery: Boolean,        // Módulo delivery
    hasFiscal: Boolean,          // Emissão fiscal
    hasSplitPayment: Boolean     // Split de pagamento
  },

  features: [String],            // Lista de features ativas
  // [ "pdv", "kds", "inventory", "reports", "delivery", "fiscal", "split" ]

  trialDays: Number,             // Dias de trial (default: 14)
  sortOrder: Number              // Ordem de exibição
}
```

### 1.2 Assinatura (Subscription)

```javascript
{
  _id, store,
  plan: ObjectId,
  status: String,                 // active | trialing | past_due | canceled | expired
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  trialEndsAt: Date,
  canceledAt: Date,

  usage: {
    currentOrdersMonth: Number,
    currentStorage: Number
  },

  billing: {
    cycle: String,                // monthly | yearly
    nextBillingDate: Date,
    lastBillingDate: Date,
    paymentMethod: String,        // credit_card | pix | boleto
    gateway: String,              // mercadopago | cash
    gatewaySubscriptionId: String,
    price: Number,                // Preço atual (pode diferir do plano se promoção)
    discount: Number,             // Desconto (%)
  },

  history: [{
    action: String,               // plan_changed | renewed | canceled | payment_received
    date: Date,
    details: String,
    operatorId: ObjectId
  }],

  createdAt, updatedAt
}
```

---

## 2. PLANOS PADRÃO

| Feature | Starter | Professional | Enterprise |
|---------|:-------:|:------------:|:----------:|
| Preço (R$/mês) | R$ 79 | R$ 149 | R$ 299 |
| Lojas | 1 | 3 | Ilimitado |
| Produtos | 50 | 200 | Ilimitado |
| Usuários | 3 | 10 | Ilimitado |
| Dispositivos | 2 | 5 | 20 |
| Pedidos/mês | 500 | 3.000 | Ilimitado |
| KDS | ❌ | ✅ | ✅ |
| Relatórios | ❌ | ✅ | ✅ |
| Multi-loja | ❌ | ✅ | ✅ |
| Delivery | ❌ | ❌ | ✅ |
| Fiscal (NFC-e) | ❌ | ✅ | ✅ |
| Split pagamento | ❌ | ❌ | ✅ |
| Trial grátis | 14 dias | 14 dias | — |

---

## 3. FLUXO DE ASSINATURA

### 3.1 Trial

```
  LOJA NOVA (registro)
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  1. Subscription criada:                │
  │     status = 'trialing'                 │
  │     trialEndsAt = now + 14 dias         │
  │     plan = Starter                      │
  │                                         │
  │  2. Durante trial:                      │
  │     Todos os limites aplicados          │
  │     (Starter: 1 loja, 50 produtos, etc) │
  │                                         │
  │  3. Banner no dashboard:                │
  │     "🔔 Trial termina em 5 dias.        │
  │      Escolha seu plano."               │
  │                                         │
  │  4. Ao expirar:                         │
  │     Se não converteu:                   │
  │       status = 'expired'                │
  │       Acesso bloqueado                  │
  │     Se converteu:                       │
  │       status = 'active'                 │
  └─────────────────────────────────────────┘
```

### 3.2 Upgrade / Downgrade

```
  ADMIN → ASSINATURA → "Mudar Plano"
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  MODAL:                                  │
  │  Plano atual: Starter (R$ 79/mês)       │
  │  Novo plano: Professional (R$ 149/mês)  │
  │                                          │
  │  UPGRADE (Starter → Pro):               │
  │  • Imediato                              │
  │  • Custo proporcional ao restante do mês │
  │  • Features adicionais liberadas na hora │
  │                                          │
  │  DOWNGRADE (Pro → Starter):             │
  │  • Apenas no final do ciclo              │
  │  • Limites mais restritivos aplicados    │
  │    no próximo período                    │
  │  • Se exceder limite novo, avisar:       │
  │    "Você tem 120 produtos. O plano       │
  │     Starter permite 50. Reduza antes     │
  │     de fazer downgrade."                 │
  └─────────────────────────────────────────┘
```

### 3.3 Bloqueio por exceder limite

```
  MIDDLEWARE DE LIMITES:
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  Ao criar recurso (produto, user, etc): │
  │                                         │
  │  1. Conta recursos atuais               │
  │  2. Compara com subscription.limits     │
  │  3. Se >= limite:                       │
  │     Responde 403:                       │
  │     {                                    │
  │       error: "LIMIT_EXCEEDED",          │
  │       message: "Limite de 50 produtos   │
  │                 atingido. Faça upgrade   │
  │                 para adicionar mais.",   │
  │       currentUsage: 50,                 │
  │       maxLimit: 50,                     │
  │       suggestedPlan: "Professional"     │
  │     }                                    │
  │  4. Se < limite: permite operação       │
  └─────────────────────────────────────────┘
```

---

## 4. REGRAS DE NEGÓCIO

| # | Regra |
|---|-------|
| 1 | Upgrade de plano é IMEDIATO (pró-rata) |
| 2 | Downgrade só no PRÓXIMO ciclo |
| 3 | Trial expirado → acesso bloqueado (dashboard + PDV) |
| 4 | Exceder limite → bloqueio apenas na criação (não afeta dados existentes) |
| 5 | Bloqueio por falta de pagamento (past_due) → acesso somente leitura |
| 6 | Cancelamento → dados mantidos por 30 dias (recovery window) |
| 7 | Após 30 dias → dados deletados (soft-delete mantido 90 dias) |
| 8 | Notificação automática 7 dias antes do trial expirar |
| 9 | Notificação 3 dias antes do pagamento |
| 10 | Notificação ao bloquear por exceder limite |

---

## 5. ENDPOINTS

```javascript
// Assinatura
GET    /api/subscription/:storeId         // Detalhes
PATCH  /api/subscription/:storeId/plan    // Mudar plano
PATCH  /api/subscription/:storeId/cancel  // Cancelar
PATCH  /api/subscription/:storeId/reactivate  // Reativar

// Planos
GET    /api/plans                         // Listar planos disponíveis

// Pagamento
POST   /api/subscription/:storeId/payment // Processar pagamento
GET    /api/subscription/:storeId/invoice // Última fatura

// Admin
GET    /api/admin/subscriptions           // Todas as assinaturas (master)
GET    /api/admin/subscriptions/expiring  // Expirando em N dias
```
