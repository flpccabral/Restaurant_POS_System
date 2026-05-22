# Auditoria de Módulos — Restaurant POS SaaS

**Data:** 2026-05-21
**Escopo:** 4 módulos do ecossistema POS — Backend, Admin Dashboard, PDV, KDS

---

## 1. Mapeamento Atual por Módulo

### Módulo 1 — Backend Central (pos-backend/)

**Papel:** API Node.js/Express + MongoDB. Regras de negócio, multi-tenancy, estoque, ficha técnica, WebSockets, gestão financeira.

#### Models (24 arquivos)

| Model | Arquivo | Store Isolation | Índices Compostos | Observação |
|-------|---------|----------------|-------------------|------------|
| Store | `models/storeModel.js` | N/A (é o tenant root) | `{isActive: 1}` | Define tenant |
| User | `models/userModel.js` | ✅ `store` (ObjectId ref) | `{store, email}` unique, `{store, isActive}` | Vinculado a uma loja |
| Device | `models/deviceModel.js` | ✅ `store` (ObjectId ref) | `{user, fingerprint}` unique, `{store, isApproved}`, `{user, isCurrent}` | Device fingerprinting |
| Role | `models/roleModel.js` | ✅ `store` (nullable = global) | `{store, name}` unique | Roles globais + por-loja |
| SessionLog | `models/sessionLogModel.js` | ✅ `store` + `user` | `{store, createdAt}`, `{user, createdAt}`, `{action}` | Audit trail |
| Category | `models/categoryModel.js` | ✅ `store` | `{store, name}` unique, `{store, isActive, order}` | OK |
| Attribute | `models/attributeModel.js` | ✅ `store` | `{store, name}` unique | OK |
| Product | `models/productModel.js` | ✅ `store` | `{store, category}`, `{store, isActive, isCurrent}` | OK |
| GlobalIngredient | `models/globalIngredientModel.js` | ❌ Sem store (intencional) | `{category, isActive}` | Compartilhado entre lojas |
| Ingredient (local) | `models/ingredientModel.js` | ✅ `store` | `{store, name}` unique | Estoque local |
| Supplier | `models/supplierModel.js` | ✅ `store` | `{store, name}`, `{store, isActive}` | OK |
| Recipe | `models/recipeModel.js` | ✅ `store` | `{store, sku}` unique, `{store, product}`, `{store, isActive}` | OK |
| StockBalance | `models/stockBalanceModel.js` | ✅ `store` | `{store, ingredient}` unique | OK |
| StockMovement | `models/stockMovementModel.js` | ✅ `store` | `{store, ingredient, createdAt}`, `{store, type, createdAt}` | OK |
| StockAlert | `models/stockAlertModel.js` | ✅ `store` | `{store, status, createdAt}`, `{store, type, status}` | OK |
| PurchaseOrder | `models/purchaseOrderModel.js` | ✅ `store` | `{store, status, createdAt}`, `{store, supplier, createdAt}` | OK |
| Payment | `models/paymentModel.js` | ✅ `store` | `{store, status, createdAt}`, `{order}`, `{method, status}` | OK |
| CashSession | `models/cashSessionModel.js` | ✅ `store` | `{store, cashier, status}`, `{store, openedAt}`, `{sessionNumber}` unique | OK |
| Subscription | `models/subscriptionModel.js` | ✅ `store` | `{store, status}`, `{status, nextBillingDate}` | OK |
| Plan | `models/planModel.js` | ❌ Sem store (intencional) | `{slug, isActive}` | Configuração global do SaaS |
| **Order** | `models/orderModel.js` | ✅ `store` (renomeado de storeId) | `{store, orderDate, orderStatus}` | ✅ Corrigido (Semana 1) |
| **Table** | `models/tableModel.js` | ✅ `store` (adicionado) | `{store, tableNo}` unique, `{store, status}` | ✅ Corrigido (Semana 1) |
| KdsOrder | `models/kdsOrderModel.js` | ✅ `store` | `{store, status, createdAt}`, `{store, table, status}` | OK |
| KdsConfig | `models/kdsConfigModel.js` | ✅ `store` (unique) | `{store, isEnabled}` | Uma config por loja |

#### Controllers (18 arquivos)

| Controller | Store Isolation | WebSocket | Transactions | Permission Check |
|-----------|----------------|-----------|-------------|-----------------|
| storeController | ✅ | ❌ | ❌ | ⚠️ Parcial |
| userController | ✅ | ❌ | ❌ | ⚠️ Login/register bypass |
| productController | ✅ | ✅ emitProductAvailability | ❌ | ✅ |
| categoryController | ✅ | ❌ | ❌ | ✅ |
| attributeController | ✅ | ❌ | ❌ | ✅ |
| orderController | ✅ (corrigido) | ✅ emitOrderCreated/Updated/StatusChanged | ❌ | ✅ (corrigido) |
| paymentController | ❌ | ❌ | ❌ | ❌ |
| roleController | ✅ | ❌ | ❌ | ⚠️ Parcial |
| stockController | ✅ | ✅ emitInventoryUpdated | ❌ | ✅ |
| recipeController | ✅ | ✅ emitRecipeProduced | ❌ | ✅ |
| deviceController | ✅ | ✅ emitDeviceApproved | ❌ | ✅ |
| dashboardController | ✅ resolveStoreId() | ❌ | ❌ | ❌ Sem checkPermission |
| pdvController | ✅ | ✅ | ❌ | ⚠️ Usa checkRole (legado) |
| kdsController | ✅ | ✅ KDS events | ❌ | ❌ Sem checkPermission |
| subscriptionController | ✅ | ❌ | ❌ | ⚠️ Master admin only |
| purchaseOrderController | ✅ | ✅ emitInventoryUpdated | ✅ receiveItems | ❌ |
| supplierController | ✅ | ❌ | ❌ | ❌ |
| globalIngredientController | ❌ Global | ❌ | ❌ | ❌ |

#### Middlewares (5 arquivos)

| Middleware | Função | Status |
|-----------|--------|--------|
| `tokenVerification.js` | Valida JWT do cookie/Bearer, popula `req.user` | ✅ OK |
| `storeIsolation.js` | Injeta `req.storeId`, filtra por loja | ✅ Excelente |
| `checkPermission.js` | RBAC com Role model, master admin bypass | ✅ Excelente |
| `deviceApproval.js` | Device fingerprint + aprovação | ✅ OK |
| `globalErrorHandler.js` | Tratamento centralizado de erros | ✅ OK |

#### Routes (20 arquivos)

| Route | Middlewares | Status |
|-------|-------------|--------|
| orderRoute | `isVerifiedUser` + `storeIsolation` + `checkPermission` | ✅ Protegido |
| tableRoute | `isVerifiedUser` + `storeIsolation` + `checkPermission` | ✅ Protegido |
| productRoute | `isVerifiedUser` + `storeIsolation` + `deviceApproval` + `checkPermission` | ✅ Protegido |
| categoryRoute | `isVerifiedUser` + `storeIsolation` + `deviceApproval` + `checkPermission` | ✅ Protegido |
| attributeRoute | `isVerifiedUser` + `storeIsolation` + `deviceApproval` + `checkPermission` | ✅ Protegido |
| recipeRoute | `isVerifiedUser` + `storeIsolation` + `deviceApproval` + `checkPermission` | ✅ Protegido |
| stockRoute | `isVerifiedUser` + `storeIsolation` + `deviceApproval` + `checkPermission` | ✅ Protegido |
| deviceRoute | `isVerifiedUser` + `checkPermission` + device hooks | ⚠️ Sem storeIsolation |
| roleRoute | `isVerifiedUser` + `storeIsolation` | ⚠️ Parcial |
| storeRoute | `isVerifiedUser` + `storeIsolation` | ⚠️ Sem permission check |
| userRoute | `isVerifiedUser` (parcial) | ⚠️ Parcial |
| supplierRoutes | `isVerifiedUser` apenas | 🔴 Sem storeIsolation, sem permission |
| purchaseOrderRoutes | `isVerifiedUser` apenas | 🔴 Sem storeIsolation, sem permission |
| dashboardRoutes | `isVerifiedUser` apenas | 🔴 Sem storeIsolation, sem permission |
| subscriptionRoutes | `isVerifiedUser` apenas | 🔴 Sem storeIsolation, sem permission |
| kdsRoutes | `isVerifiedUser` apenas | 🔴 Sem storeIsolation, sem permission |
| pdvRoutes | `isVerifiedUser` + `checkRole` | ⚠️ Roles legados, sem storeIsolation |
| paymentRoute | `isVerifiedUser` | 🔴 Sem storeIsolation, sem permission |
| ingredientRoute | `isVerifiedUser` + `deviceApproval` + `checkPermission` | ⚠️ Sem storeIsolation |
| globalIngredientRoute | `isVerifiedUser` + `deviceApproval` + `checkPermission` | ⚠️ Global, sem storeIsolation |

#### Serviços (2 arquivos)

| Serviço | Função | Store Scoping |
|---------|--------|---------------|
| `websocketService.js` | Emite 15 tipos de eventos WS | ✅ Room-based (`store:${storeId}`) |
| `recipeService.js` | Lógica de recipe, custo, dedução estoque | ✅ Via recipe.store |

#### Core

| Arquivo | Notas |
|---------|-------|
| `app.js` | Socket.io Server configurado, CORS OK, `app.set('io')` disponível. Sem rate limiting. |
| `config/config.js` | JWT secret default fraco (`"test-secret-key-for-jwt"`). CORS com localhost:3000 e 5173. |

---

### Módulo 2 — Dashboard Administrativo (pos-admin/)

**Papel:** Next.js 16 App Router. Back-office para donos de restaurante: analytics, CMV, gestão de cardápio, fornecedores, dispositivos, configurações SaaS.

#### Stack

- Next.js 16 + TypeScript
- React Query (@tanstack/react-query) — staleTime: 5min, retry: 1
- Axios com `withCredentials: true` (cookie JWT)
- Tailwind CSS v4 + shadcn/ui
- Socket.io-client instalado **mas nunca utilizado**
- Recharts (disponível, gráficos não implementados)

#### Páginas (16 rotas)

| Página | Rota | WebSocket | Paginação Server-side | Data Normalization | Store Isolation |
|--------|------|-----------|---------------------|-------------------|-----------------|
| Login | `/login` | ❌ | N/A | N/A | ✅ |
| Dashboard | `/` | ❌ | ❌ | ⚠️ Parcial | ✅ |
| Products | `/products` | ❌ | ❌ | ⚠️ Parcial | ✅ |
| Categories | `/categories` | ❌ | ❌ | ✅ | ✅ |
| Inventory | `/inventory` | ❌ | ❌ | ✅ | ✅ |
| Ingredients | `/ingredients` | ❌ | ❌ | ✅ | ✅ |
| Suppliers | `/suppliers` | ❌ | ❌ | ✅ | ✅ |
| Purchase Orders | `/purchase-orders` | ❌ | ❌ | ✅ | ✅ |
| Users | `/users` | ❌ | ❌ | ✅ | ✅ |
| Stores | `/stores` | ❌ | ❌ | ✅ | ✅ |
| Devices | `/devices` | ❌ | ❌ | ✅ | ✅ |
| Roles | `/roles` | ❌ | ❌ | ✅ | ✅ |
| Subscription | `/subscription` | ❌ | ❌ | ⚠️ Parcial | ⚠️ Hardcoded `""` |
| PDV | `/pdv` | ❌ | ❌ | ⚠️ Parcial | ✅ |
| KDS | `/kds` | ❌ | ❌ | ✅ | ✅ |

#### Serviços API (16 arquivos)

| Serviço | Endpoints | ApiResponse<T> | Error Handling |
|---------|-----------|----------------|---------------|
| auth.ts | POST /user/login, POST /user/logout, GET /user | ❌ | ⚠️ Mínimo |
| users.ts | CRUD /user | ✅ | ⚠️ Axios default |
| stores.ts | CRUD /stores | ✅ | ⚠️ Axios default |
| products.ts | CRUD /products | ✅ | ⚠️ Axios default |
| categories.ts | CRUD /categories + toggle-status | ✅ | ⚠️ Axios default |
| inventory.ts | /stock/balance, /stock/in, /stock/out, /stock/adjust, /stock/history | ✅ | ❌ |
| ingredients.ts | CRUD /ingredients | ✅ | ⚠️ Axios default |
| suppliers.ts | CRUD /suppliers | ✅ | ⚠️ Axios default |
| purchase-orders.ts | CRUD + send/confirm/receive/cancel | ✅ | ❌ |
| devices.ts | CRUD + stats + approve | ✅ | ❌ |
| roles.ts | CRUD /roles | ✅ | ⚠️ Axios default |
| subscription.ts | GET/PATCH /subscription/{storeId} | ✅ | ❌ |
| pdv.ts | /pdv/session/*, /pdv/sangria, /pdv/suprimento, /pdv/daily-payments, /pdv/summary | ✅ | ❌ |
| kds.ts | GET/POST /kds/orders/*, /kds/stats/station | ✅ | ❌ |
| dashboard.ts | /dashboard/kpi, /sales, /products/top, /cmv, /variance, /inventory, /users | ❌ | ❌ |
| types.ts | Interface ApiResponse<T> | N/A | N/A |

#### Componentes (8 principais)

| Componente | Uso |
|-----------|-----|
| data-table.tsx | Tabela reutilizável com search/edit/delete. Sem paginação server-side. |
| status-badge.tsx | Badges coloridos por status. |
| confirm-dialog.tsx | Modal de confirmação para deleções. |
| kpi-card.tsx | Card de métricas para dashboard. |
| sidebar.tsx | Navegação lateral com active state. |
| header.tsx | Top bar com user menu. Sem loading states. |

#### Middleware e Providers

| Arquivo | Função |
|---------|--------|
| `middleware.ts` | Auth guard por cookie `accessToken`. Redireciona `/login` se não autenticado. |
| `providers/query-provider.tsx` | React Query client config (staleTime 5min). |

---

### Módulo 3 — PDV Frontend (pos-frontend/)

**Papel:** React SPA (Vite). Interface de caixa/salão: mesas, pedidos, carrinho, pagamentos, sangria/suprimento, fechamento de caixa.

#### Stack

- Vite + React (JSX, não TypeScript)
- Redux Toolkit (cart, user, customer state)
- Axios wrapper (sem withCredentials explícito)
- notistack (toast notifications)
- Tailwind CSS

#### Estrutura de Arquivos (36 arquivos)

| Camada | Arquivos |
|--------|----------|
| Entry | `src/main.jsx`, `src/App.jsx` (router + ProtectedRoutes) |
| Pages | Home, Auth (Login/Register), Menu, Orders, Tables, Dashboard |
| Redux Store | `store.js`, `userSlice.js`, `cartSlice.js`, `customerSlice.js` |
| Services | `https/index.js`, `https/axiosWrapper.js` |
| Components (auth) | Login.jsx, Register.jsx |
| Components (menu) | Bill.jsx, CartInfo.jsx, CustomerInfo.jsx, MenuContainer.jsx |
| Components (orders) | OrderCard.jsx |
| Components (dashboard) | Metrics.jsx, Modal.jsx, RecentOrders.jsx |
| Components (home) | Greetings.jsx, MiniCard.jsx, OrderList.jsx, PopularDishes.jsx |
| Components (tables) | TableCard.jsx |
| Components (invoice) | Invoice.jsx (PDF print) |
| Components (shared) | BackButton.jsx, BottomNav.jsx, Header.jsx, Modal.jsx |
| Utils/Constants | `constants/index.js`, `utils/index.js` |
| Hooks | `useLoadData.js` |

#### Avaliação PDV

| Critério | Status | Detalhe |
|----------|--------|---------|
| WebSocket/Socket.io | ❌ Não utilizado | Apenas HTTP REST via Axios |
| Auth Guard | ✅ `ProtectedRoutes` wrapper | Redireciona para /auth |
| Store Isolation | ❌ **Ausente** | Nenhum filtro de storeId em nenhuma chamada API |
| Error Handling | ⚠️ Inconsistente | notistack em alguns, `console.log` em outros |
| Data Normalization | ❌ Ausente | Sem verificação de null/undefined |
| Paginação | ❌ Ausente | Todos os dados carregados de uma vez |
| Hooks Customizados | ⚠️ Parcial | Apenas `useLoadData.js` (bug: `Navigate` typo) |

---

### Módulo 4 — KDS (Kitchen Display System)

**Papel:** Telas digitais para cozinha/bar, reativas via WebSockets, com SLA timers e controle de status.

#### Status: NÃO é aplicação standalone

O KDS existe **apenas como página dentro do admin dashboard**:

```
pos-admin/src/app/(dashboard)/kds/page.tsx
```

Não há um aplicativo KDS separado dedicado a telas de cozinha.

#### KDS Page Analysis

| Critério | Status | Detalhe |
|----------|--------|---------|
| WebSocket/Socket.io | ❌ **Não utiliza** | Usa HTTP polling via `useQuery` |
| Auth Guard | ✅ Protegido pelo layout do admin |
| Store Isolation | ❌ **Ausente** | `getTickets()` chama `/kds/orders` sem storeId |
| Real-time Updates | ❌ Ausente | Sem Socket.io client |
| SLA/Timer UI | ✅ Mostra tempo decorrido |
| Status Workflow | ✅ pending→accepting→preparing→ready→served |
| Actions por Status | ✅ Botões contextuais por status |

#### KDS Service (pos-admin/src/services/api/kds.ts)

| Método | Endpoint | Store Isolation |
|--------|----------|-----------------|
| getTickets() | GET /kds/orders | ❌ Sem storeId |
| getById() | GET /kds/orders/:id | ✅ Via ID |
| acceptOrder() | POST /kds/orders/:id/accept | ✅ Via ID |
| updateItemStatus() | PATCH /kds/orders/:ticketId/items/:itemId/status | ✅ Via ID |
| markReady() | POST /kds/orders/:id/ready | ✅ Via ID |
| markServed() | POST /kds/orders/:id/served | ✅ Via ID |
| cancelOrder() | POST /kds/orders/:id/cancel | ✅ Via ID |
| getStationStats() | GET /kds/stats/station | ❌ Sem storeId |

#### KDS Backend (Módulo 1)

| Arquivo | Status |
|---------|--------|
| `kdsController.js` | ✅ Usa `storeRef` para isolamento. Emite WS events. ❌ Sem checkPermission nas rotas |
| `kdsRoutes.js` | ⚠️ Apenas `isVerifiedUser`, sem `storeIsolation` middleware (mas o controller faz o filter internamente) |
| `kdsOrderModel.js` | ✅ Tem `store` field + índices compostos |
| `kdsConfigModel.js` | ✅ Tem `store` field unique |

---

## 2. Status de Saúde e Integração entre Módulos

### 2.1 — Socket.io: Backend ↔ Frontend

**Backend (Módulo 1):** ✅ Configurado e funcional
- Socket.io Server configurado em `app.js` com CORS + credentials
- Room-based architecture: `store:${storeId}` para isolamento
- 15 tipos de eventos emitidos: `order:*`, `inventory:*`, `product:availability`, `alert:created`, `recipe:produced`, `device:*`, `kds:*`
- Service centralizado em `websocketService.js`

**Admin Dashboard (Módulo 2):** ❌ Não utiliza WebSockets
- `socket.io-client` está no `package.json` mas **nunca é importado**
- Nenhuma página faz conexão WebSocket
- Todas as páginas usam polling via React Query (refetch manual ou staleTime)
- **Impacto:** Dashboard não recebe atualizações em tempo real de pedidos, estoque, KDS

**PDV (Módulo 3):** ❌ Não utiliza WebSockets
- Não tem `socket.io-client` nas dependências
- Usa apenas HTTP REST via Axios
- **Impacto:** PDV não recebe atualizações de status de cozinha, estoque, ou novos pedidos em tempo real

**KDS (Módulo 4):** ❌ Não utiliza WebSockets
- Como página do admin, herda a falta de WebSocket do Módulo 2
- **Impacto crítico:** KDS deveria ser **100% real-time** mas faz polling manual. Cozinheiros não vêem novos pedidos instantaneamente, timers não atualizam em tempo real.

**Veredito:** A infraestrutura WebSocket do backend está completa, mas **nenhum dos 3 frontends a utiliza**. Esta é a maior lacuna de integração do sistema.

### 2.2 — Isolamento Multi-loja (storeId)

**Backend (Módulo 1):** ✅ Corrigido para pedidos/mesas (Semana 1), mas gaps permanecem

Rotas **sem** `storeIsolation` middleware:

| Rota | Risco |
|------|-------|
| `/api/suppliers/*` | 🔴 Dados de fornecedores de todas as lojas visíveis |
| `/api/purchase-orders/*` | 🔴 Pedidos de compra de todas as lojas visíveis |
| `/api/dashboard/*` | 🔴 Analytics de todas as lojas visíveis |
| `/api/subscription/*` | 🔴 Dados de assinatura de todas as lojas visíveis |
| `/api/kds/*` | 🔴 Pedidos KDS de todas as lojas visíveis |
| `/api/pdv/*` | 🔴 Sessões de caixa de todas as lojas visíveis |
| `/api/payments/*` | 🔴 Pagamentos de todas as lojas visíveis |
| `/api/devices/*` | ⚠️ Listagem de dispositivos sem filtro |

**Importante:** Alguns controllers (kdsController, pdvController) fazem o filtro de store internamente, mas isso não é uma defesa adequada — o middleware deve estar na rota como camada de segurança.

**Admin Dashboard (Módulo 2):** ⚠️ Parcial
- Nenhuma página hard-codeia storeId explicitamente (exceto subscription com `""`)
- Mas depende do backend fazer o filtro — se o backend não filtrar, dados vazam
- `subscription/page.tsx` passa `""` como storeId — potencial bug

**PDV (Módulo 3):** ❌ Ausente
- Zero menção a storeId em qualquer componente, service, ou Redux slice
- Todas as chamadas API são globais

**KDS (Módulo 4):** ❌ Ausente
- `getTickets()` não passa storeId
- Depende do backend filtrar (o que o kdsController faz internamente, mas sem middleware de rota)

### 2.3 — Comunicação entre Módulos

```
┌─────────────────────────────────────────────────────────────────┐
│                    Módulo 1: Backend Central                     │
│  Express + MongoDB + Socket.io Server                           │
│  ├── API REST (18 controllers, 20 routes)                       │
│  ├── WebSocket (15 event types, room-based per store)           │
│  ├── Middlewares: auth, storeIsolation, RBAC, deviceApproval    │
│  └── 24 Models (22 com store isolation, 2 globais intencionais) │
└──────────────┬──────────────────────┬──────────────────┬────────┘
               │ HTTP REST            │ HTTP REST        │ HTTP REST
               │ (no WebSocket)       │ (no WebSocket)   │ (no WebSocket)
               ▼                      ▼                  ▼
┌──────────────────────────┐ ┌─────────────────────┐ ┌──────────────┐
│ Módulo 2: Admin Dashboard│ │ Módulo 3: PDV       │ │ Módulo 4: KDS│
│ (Next.js)                │ │ (Vite + React)      │ │ (no admin)   │
│                          │ │                     │ │              │
│ ✅ 16 pages              │ │ ✅ 36 files         │ │ ❌ Não é app │
│ ✅ React Query           │ │ ✅ Redux Toolkit    │ │    standalone│
│ ❌ Sem WebSocket         │ │ ❌ Sem WebSocket    │ │ ❌ Sem WS    │
│ ⚠️ Store isolation parcial│ │ ❌ Sem store filter │ │ ❌ Sem store │
└──────────────────────────┘ └─────────────────────┘ └──────────────┘
```

---

## 3. Identificação de Gaps por Módulo

### Módulo 1 — Backend Central

| Gap | Prioridade | Impacto |
|-----|-----------|---------|
| Rotas sem `storeIsolation` middleware (suppliers, purchase-orders, dashboard, subscription, kds, pdv, payments) | 🔴 Alta | Vazamento de dados entre tenants |
| Rotas sem `checkPermission` (dashboard, kds, suppliers, purchase-orders, subscription) | 🔴 Alta | Qualquer usuário autenticado pode acessar |
| `globalIngredientController` sem restrição de master admin | 🟡 Alta | Usuário de qualquer loja pode criar/editar ingredientes globais |
| `paymentController` sem store isolation | 🔴 Alta | Pagamentos de todas as lojas acessíveis |
| Sem transações atômicas (exceto purchaseOrder receiveItems) | 🟡 Média | Inconsistência em operações compostas (stock in/out, PDV close) |
| Sem rate limiting | 🟡 Média | Vulnerável a brute force e DDoS |
| Sem validação de input (Zod/Joi) | 🟡 Média | Dados inconsistentes, possível injeção |
| JWT secret default fraco | 🟡 Média | Se não configurado em produção, tokens forjáveis |
| pdvController usa roles legados (string) ao invés de Role model | 🟡 Média | Inconsistência com sistema RBAC |

### Módulo 2 — Admin Dashboard (Next.js)

| Gap | Prioridade | Impacto |
|-----|-----------|---------|
| **Socket.io não utilizado** (dependência instalada, zero uso) | 🔴 Alta | Sem atualizações em tempo real |
| Sem paginação server-side no DataTable | 🟡 Alta | Performance degrada com muitos registros |
| Sem validação de formulários com Zod (apesar da dependência) | 🟡 Média | Dados inválidos podem ser enviados |
| `subscription/page.tsx` passa `""` como storeId | 🟡 Média | Potencial bug em produção |
| Sem gráficos Recharts no dashboard (dependência instalada, não usada) | 🟡 Média | Dashboard mostra apenas números crus |
| Sem hooks customizados (`useAuth`, `useDebounce`, `useSocket`) | 🟢 Baixa | Código duplicado, menos reutilizável |
| Error handling inconsistente nos services | 🟢 Baixa | Alguns serviços sem try/catch |

### Módulo 3 — PDV Frontend (Vite)

| Gap | Prioridade | Impacto |
|-----|-----------|---------|
| **Sem store isolation** em todas as chamadas API | 🔴 Crítica | Acesso a dados de todas as lojas |
| **Sem WebSocket** — sem atualizações em tempo real | 🔴 Alta | Cozinheiros não recebem pedidos, estoque não atualiza |
| Sem `socket.io-client` nas dependências | 🔴 Alta | Infraestrutura para real-time inexistente |
| Error handling inconsistente (`console.log` em produção) | 🟡 Média | Erros silenciosos |
| `useLoadData.js` com bug (`Navigate` typo) | 🟡 Média | Redirecionamento de auth pode falhar |
| Sem paginação server-side | 🟡 Média | Performance com muitos dados |
| Axios sem `withCredentials: true` explícito | 🟡 Média | Cookie JWT pode não ser enviado |
| Sem validação de sessão de caixa aberta antes de operações | 🟡 Média | Operações sem cash session ativa |
| Sem TypeScript (JSX puro) | 🟢 Baixa | Menos type safety |

### Módulo 4 — KDS

| Gap | Prioridade | Impacto |
|-----|-----------|---------|
| **Não é aplicação standalone** — é página dentro do admin | 🔴 Alta | KDS deveria ser app separado dedicado a telas de cozinha |
| **Sem WebSocket** — usa HTTP polling | 🔴 Alta | Cozinheiros não vêem novos pedidos em tempo real |
| Sem store isolation no `getTickets()` | 🟡 Alta | Pode mostrar pedidos de todas as lojas |
| Sem SLA enforcement | 🟡 Média | Sem alertas quando pedidos excedem tempo esperado |
| Sem auto-refresh inteligente | 🟡 Média | Depende de polling manual do React Query |
| Sem som/notificação visual para novos pedidos | 🟡 Média | Cozinheiros podem perder novos pedidos |
| Sem configuração de estações (bar vs cozinha) | 🟢 Baixa | kdsConfigModel existe mas não é usado no frontend |

---

## 4. Conclusão das Correções Anteriores (Semana 1)

### Vulnerabilidades Multi-tenant — Status

| Vulnerabilidade | Status | Detalhes |
|----------------|--------|----------|
| **VULN-001**: orderController sem store isolation | ✅ **RESOLVIDA** | `storeFilter()` helper em todas as 4 funções. `addOrder` injeta store. `getOrderById` usa `findOne` com store filter. `updateOrder` usa `findOneAndUpdate` com store filter. |
| **VULN-002**: tableModel sem campo store | ✅ **RESOLVIDA** | Campo `store` adicionado (ObjectId ref Store, required, indexed). `tableNo` não é mais globalmente unique. Índice composto `{store: 1, tableNo: 1}` criado. |
| **VULN-003**: Inconsistência storeId vs store | ✅ **RESOLVIDA** | Renomeado `storeId` para `store` no orderModel. Índice composto `{store, orderDate, orderStatus}` adicionado. |

### Correções Adicionais Aplicadas

| Correção | Arquivo | Detalhe |
|----------|---------|---------|
| tableController isolado por store | `tableController.js` | `storeFilter()` helper em addTable, getTables, updateTable |
| orderRoute protegido com storeIsolation | `routes/orderRoute.js` | Middleware chain: `isVerifiedUser` → `storeIsolation` → `checkPermission` |
| tableRoute protegido com storeIsolation | `routes/tableRoute.js` | Middleware chain: `isVerifiedUser` → `storeIsolation` → `checkPermission` |
| Bug fix: order.store em WS emit | `orderController.js` | `ws.emitOrderStatusChanged` agora usa `order.store` corretamente |
| Bug fix: error propagation | `tableController.js` | `return error` → `return next(error)` |

### Verificação

Todos os 6 módulos refatorados carregam sem erro:
```
$ node -e "require('./models/orderModel'); require('./models/tableModel'); ... All modules loaded OK
```

### ⚠️ Ação Pendente: Migração de Dados

As mudanças nos models exigem migração no MongoDB existente:

```javascript
// 1. Renomear storeId → store nos pedidos existentes
db.orders.updateMany(
  { storeId: { $exists: true } },
  [{ $set: { store: "$storeId" }, $unset: ["storeId"] }]
)

// 2. Adicionar store às mesas existentes (requer valor real)
db.tables.updateMany(
  { store: { $exists: false } },
  { $set: { store: ObjectId("STORE_ID_AQUI") } }
)
```

---

## 5. Resumo Executivo

| Módulo | Health Score | Principal Gap |
|--------|-------------|---------------|
| **Módulo 1: Backend** | 70% | 7 rotas sem storeIsolation + 5 sem checkPermission |
| **Módulo 2: Admin Dashboard** | 65% | Socket.io instalado mas zero uso; sem paginação server-side |
| **Módulo 3: PDV** | 40% | Zero store isolation, zero WebSocket, sem socket.io-client |
| **Módulo 4: KDS** | 30% | Não é app standalone, zero WebSocket, zero store isolation |

**Próximo passo recomendado:** Aplicar `storeIsolation` + `checkPermission` às rotas do backend que ainda estão desprotegidas (Semana 1, continuação), e implementar Socket.io client nos 3 frontends para habilitar comunicação real-time.

---

*Documento gerado em 2026-05-21. Baseado no estado atual do código em todos os 4 módulos.*
