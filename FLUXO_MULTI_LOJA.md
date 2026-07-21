# FLUXO MULTI-LOJA — TENANT ISOLATION, CLONAGEM E OPERAÇÕES CROSS-STORE

## VISÃO GERAL

O sistema é multi-tenant. Cada loja (Store) é um tenant isolado: dados de uma loja nunca vazam para outra. O isolamento é garantido por middleware (storeIsolation) no backend e pelo prefixo `storeId` em TODAS as queries MongoDB.

```
  ┌───────────────────────────────────────────────┐
  │              PLATAFORMA POS                   │
  │                                               │
  │  ┌─────────────────┐  ┌─────────────────┐    │
  │  │   LOJA A        │  │   LOJA B        │    │
  │  │  (Restro Sabor) │  │  (Restro Center)│    │
  │  ├─────────────────┤  ├─────────────────┤    │
  │  │ Produtos: 45   │  │ Produtos: 120   │    │
  │  │ Pedidos: 1.200 │  │ Pedidos: 3.500  │    │
  │  │ Usuários: 5    │  │ Usuários: 12    │    │
  │  │ Estoque: 2.500 │  │ Estoque: 8.000  │    │
  │  └─────────────────┘  └─────────────────┘    │
  └───────────────────────────────────────────────┘
```

---

## 1. MODELO STORE

```javascript
{
  _id,
  name: String,                    // Nome fantasia
  slug: String,                    // Identificador único (para URL pública)
  cnpj: String,                    // CNPJ
  ie: String,                      // Inscrição Estadual
  phone: String,
  email: String,

  address: {
    street, number, complement,
    neighborhood, city, state, zipCode,
    coordinates: { lat, lng }
  },

  // Configurações
  settings: {
    taxRate: Number,               // Taxa de serviço (%) — default: 0
    timezone: String,              // America/Sao_Paulo
    currency: String,              // BRL
    defaultPrinter: ObjectId,      // Impressora padrão
    serviceChargeEnabled: Boolean,
    serviceChargeRate: Number      // % gorjeta (default: 10)
  },

  // Fiscal
  fiscal: {
    cnpj, ie, im, cnae, crt,
    environment, nfceSeries,
    csc, cscId
  },

  isActive: Boolean,
  logo: String,                    // URL da logo
  openingHours: {
    monday:    { lunch: {open, close}, dinner: {open, close} },
    tuesday:   { ... },
    ...
  },
  createdAt, updatedAt
}
```

---

## 2. ISOLAMENTO DE LOJA

### 2.1 Como funciona

```
  REQUISIÇÃO:
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  1. tokenVerification.js                │
  │     Extrai { userId, storeId, role }    │
  │     do JWT                              │
  │                                         │
  │  2. storeIsolation.js                   │
  │     Se masterAdmin:                     │
  │       storeId = req.query.storeId       │
  │       OU body.storeId                   │
  │       (admin pode ver qualquer loja)    │
  │     Se não:                             │
  │       storeId = req.user.store          │
  │       (forçado ao usuário)              │
  │                                         │
  │  3. storeInjection: req.storeId         │
  │                                         │
  │  4. Toda query MongoDB:                 │
  │     Model.find({ store: storeId, ... }) │
  └─────────────────────────────────────────┘
```

### 2.2 Índices compostos

Toda coleção com `storeId` deve ter índice composto:

```javascript
// Exemplos de índices
orderSchema.index({ store: 1, orderDate: 1, orderStatus: 1 });
tableSchema.index({ store: 1, tableNo: 1 }, { unique: true });
productSchema.index({ store: 1, category: 1 });
userSchema.index({ store: 1, email: 1 }, { unique: true });
```

### 2.3 StoreContext no frontend

```
  ADMIN DASHBOARD — StoreContextSelector:
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  [Restro Sabor ▼]  🔍  👤 Admin        │
  │                                         │
  │  Se masterAdmin:                        │
  │    Dropdown com todas as lojas          │
  │    Trocar loja → recarrega dados        │
  │                                         │
  │  Se não:                                │
  │    Exibe nome da loja fixo              │
  │    (sem dropdown)                       │
  └─────────────────────────────────────────┘
```

No PDV (pos-frontend), a loja é fixa (não há seletor):
- `user.store` define a loja
- Todas as chamadas API usam `storeId` do usuário logado

---

## 3. CLONAGEM DE CONFIGURAÇÃO

### 3.1 Quando clonar

Quando uma nova loja é criada, ela pode herdar configurações de uma loja existente (modelo):

```
  ADMIN: "Criar nova loja baseada na Restro Sabor"
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  CLONAGEM:                              │
  │                                         │
  │  ✅ Categorias                          │
  │  ✅ Atributos                           │
  │  ✅ Ingredientes globais                │
  │  ✅ Produtos (com variações)            │
  │  ✅ Fichas técnicas (recipes)           │
  │  ✅ Políticas de estoque                │
  │  ✅ Roles e permissões                  │
  │  ✅ KDS Config                          │
  │  ❌ Estoque (zerado)                    │
  │  ❌ Pedidos (histórico não clona)       │
  │  ❌ Usuários (criar novos)              │
  │  ❌ Fornecedores (criar novos)          │
  └─────────────────────────────────────────┘
```

### 3.2 Processo de clonagem

```javascript
// POST /api/store/:id/clone
{
  newStoreName: "Restro Center",
  newStoreSlug: "restro-center",
  cloneConfig: {
    categories: true,
    attributes: true,
    products: true,
    recipes: true,
    stockPolicies: true,
    roles: true,
    kdsConfig: true
  }
}
```

---

## 4. OPERAÇÕES CROSS-STORE

### 4.1 Transferências de estoque

```
  LOJA A (excesso tomate) → LOJA B (falta tomate)
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  BACKEND:                                │
  │  1. StockBalance[LojaA].tomate -= 10kg  │
  │  2. StockMovement[LojaA].create({        │
  │       type: 'transfer_out',             │
  │       referenceStore: LojaB._id })       │
  │  3. StockBalance[LojaB].tomate += 10kg  │
  │  4. StockMovement[LojaB].create({        │
  │       type: 'transfer_in',              │
  │       referenceStore: LojaA._id })       │
  │  5. Emite WS para AMBAS lojas           │
  └─────────────────────────────────────────┘
```

### 4.2 Dashboard cross-store (Master Admin)

Master Admin vê dados consolidados:

```
  ┌─────────────────────────────────────────────┐
  │  DASHBOARD GLOBAL (Master Admin)            │
  ├─────────────────────────────────────────────┤
  │  ┌────────┬────────┬────────┬────────┐     │
  │  │ LOJAS  │ RECEITA│ PEDIDOS│ ESTOQUE│     │
  │  ├────────┼────────┼────────┼────────┤     │
  │  │ Restro  │ R$ 4.4K│  1.200 │  R$ 45K│     │
  │  │ Sabor   │        │        │        │     │
  │  │ Restro  │ R$ 12K │  3.500 │  R$ 80K│     │
  │  │ Center  │        │        │        │     │
  │  ├────────┼────────┼────────┼────────┤     │
  │  │ TOTAL  │ R$ 16K │  4.700 │ R$ 125K│     │
  │  └────────┴────────┴────────┴────────┘     │
  └─────────────────────────────────────────────┘
```

---

## 5. REGRAS DE NEGÓCIO

| # | Regra |
|---|-------|
| 1 | Nenhum dado de uma loja pode ser visível em outra (sem storeId na query) |
| 2 | Todo modelo com dados por loja TEM campo store (ObjectId, required) |
| 3 | Toda rota que retorna dados por loja TEM middleware storeIsolation |
| 4 | MasterAdmin pode ver TODAS as lojas (passa storeId como parâmetro) |
| 5 | Slug da loja é único globalmente (usado em URLs públicas) |
| 6 | Clonagem NUNCA copia dados transacionais (pedidos, estoque) |
| 7 | Transferência de estoque cross-store registra em ambas as lojas |
| 8 | Usuário pertence a UMA loja (não pode acessar outra sem ser MasterAdmin) |

---

## 6. ENDPOINTS

```javascript
// Lojas
GET    /api/store                         // Listar (da própria loja)
GET    /api/store/:id                     // Detalhe
POST   /api/store                         // Criar
PUT    /api/store/:id                     // Atualizar
DELETE /api/store/:id                     // Desativar

// Clonagem
POST   /api/store/:id/clone              // Clonar loja

// Admin (MasterAdmin)
GET    /api/admin/stores                  // Todas as lojas
GET    /api/admin/stats                   // Estatísticas globais
```
