# Implementao Completa — Admin Dashboard POS (Next.js)

## ndice

- [Viso Geral](#viso-geral)
- [Arquitetura do Sistema](#arquitetura-do-sistema)
- [Backend — Changes & Adies](#backend--changes--adies)
  - [Order Model Fix](#order-model-fix)
  - [Dashboard Controller (7 Endpoints)](#dashboard-controller-7-endpoints)
  - [CORS Configuration](#cors-configuration)
  - [Cookie Auth Fix](#cookie-auth-fix)
- [Frontend — Projeto pos-admin/](#frontend--projeto-pos-admin)
  - [Stack Tecnolgica](#stack-tecnolgica)
  - [Autenticao](#autenticacao)
  - [Estrutura de Arquivos](#estrutura-de-arquivos)
  - [Componentes de UI](#componentes-de-ui)
  - [Camada de Servios](#camada-de-servios)
  - [Types TypeScript](#types-typescript)
- [API Response Formats](#api-response-formats)
- [Erros e Correes](#erros-e-correes)
- [Comandos de Desenvolvimento](#comandos-de-desenvolvimento)

---

## Viso Geral

Painel administrativo Next.js (pos-admin/) separado do frontend de loja (pos-frontend/), comunicando com o backend Express/MongoDB (pos-backend/) via API REST + cookies JWT httpOnly.

- **pos-admin/** — Next.js 16 App Router, TypeScript, Tailwind v4, shadcn/ui, React Query (port 3000)
- **pos-frontend/** — Vite + React (PDV/loja, port 5173)
- **pos-backend/** — Express + MongoDB (APIs compartilhadas, port 8000)

---

## Arquitetura do Sistema

```
Browser (localhost:3000)
  └── pos-admin/ (Next.js App Router)
       ├── middleware.ts → protege rotas via cookie accessToken
       ├── lib/api.ts → axios com withCredentials: true
       ├── services/api/* → endpoints organizados por mdulo
       └── app/(dashboard)/ → pginas protegidas

Backend (localhost:8000)
  ├── dashboardController.js → 7 endpoints com aggregation pipelines
  ├── userController.js → auth com cookie httpOnly
  ├── CORS → permite localhost:3000 + localhost:5173
  └── MongoDB → multi-tenancy via storeId
```

---

## Backend — Changes & Adies

### Order Model Fix

**Arquivo:** `pos-backend/models/orderModel.js`

**Problema:** O modelo `Order` no tinha campo `storeId` (essencial para multi-tenancy) e o array `items` no tinha schema definido.

**Correes aplicadas:**

```javascript
// Adicionado campo storeId
storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true }

// Definido orderItemSchema com estrutura prpria
const orderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    status: { type: String, default: "pending" }
}, { _id: true });

// Corrigido typo: requried → required
// Corrigido: Date.now() → Date.now (referncia, no chamada)
```

---

### Dashboard Controller (7 Endpoints)

**Arquivo:** `pos-backend/controllers/dashboardController.js` (803 linhas)

**Funes auxiliares:**

| Funo | Descrio |
|---|---|
| `resolveStoreId(req)` | Resolve storeId do `req.user.store` ou `req.query.storeId` (master admin) |
| `getDateRange(period)` | Converte perodo em `{ start, end }` — suporta: today, yesterday, 7days, 30days, this_week, this_month, last_month |
| `classifyCMV(percent)` | Classificao: <25% excelente, 25-35% dentro_da_media, 35-45% atencao, >45% critico |
| `respond(res, data, period, storeId)` | Padroniza resposta JSON com `success`, `data`, `metadata` |

#### A) `GET /api/dashboard/kpi` — KPIs Gerais

- **Aggregation:** Orders `$match` por storeId + perodo + status != cancelled → `$group` com `totalRevenue` (bills.totalWithTax), `totalTax`, `orderCount`
- **Mtricas adicionais:** `activeAlerts` (StockAlert count), `activeProducts` (Product count), `taxRate` (Store settings)
- **Retorno:**
```json
{
  "revenue": { "gross": 15000, "net": 14250, "tax": 750 },
  "orders": { "count": 45, "avgTicket": 316.67 },
  "operational": { "activeAlerts": 3, "activeProducts": 28 },
  "store": { "taxRate": 5, "currency": "BRL" }
}
```

#### B) `GET /api/dashboard/sales` — Tendncia de Vendas

- **Aggregation:** Orders `$match` → `$group` por data (day/week/month/hour) → `$sort`
- **Suporta agrupamento por:** `hour`, `day`, `week`, `month` (query param `groupBy`)
- **Formatao para Recharts:** `[{ date: "DD/MM", revenue, netRevenue, orders, tax, avgTicket }]`
- **Query:** `?period=7days&groupBy=day`

#### C) `GET /api/dashboard/products/top` — Top Produtos

- **Aggregation:** Orders `$match` → `$unwind: "$items"` → `$group` por product → `$sort` por revenue → `$limit`
- **Campos:** `productId`, `productName`, `totalQuantity`, `totalRevenue`, `timesOrdered`, `avgPrice`
- **Query:** `?limit=5&period=7days`

#### D) `GET /api/dashboard/cmv` — CMV (Custo de Mercadoria Vendida)

- **Mtodo primrio:** StockMovements com `$lookup` StockBalances para `lastPurchasePrice` → calcula custo por quantidade × preo unitrio
- **Fallback:** PurchaseOrders recebidos (se no h StockMovements)
- **Indicadores:** CMV %, margem bruta, classificao por benchmarks
- **Query:** `?period=30days`

#### E) `GET /api/dashboard/variance` — Anlise de Desvio

- **Consumo Real:** StockMovements (`recipe_deduction`, `waste`, `out`) agrupados por ingrediente
- **Consumo Terico:** Recipes × Orders → calcula ingredientes necessrios baseado nas vendas
- **Desvio:** `(real - teorico) / teorico * 100` com flags: normal (≤5%), atencao (≤15%), critico (>15%)
- **Query:** `?period=7days`

#### F) `GET /api/dashboard/inventory` — Anlise de Estoque

- **Fonte:** StockBalances populados com ingrediente
- **Mtricas:** `totalValue`, `outOfStock`, `belowMinimum`, `categoryBreakdown`
- **Movimentos:** Agregao dos ltimos 7 dias por tipo

#### G) `GET /api/dashboard/users` — Estatsticas de Usurios

- **Agregaes:** Users por role, Devices por status (approved/pending)
- **Dispositivos ativos:** count com `lastActiveAt` nos ltimos 30 minutos

---

### CORS Configuration

**Arquivo:** `pos-backend/config/config.js`
```javascript
corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:3000").split(",")
```

**Arquivo:** `pos-backend/app.js` — CORS middleware usa `config.corsOrigins`

---

### Cookie Auth Fix

**Arquivo:** `pos-backend/controllers/userController.js`

**Problema:** Cookie com `secure: true` e `sameSite: 'none'` no localhost dev impedia envio do cookie.

**Correo:**
```javascript
sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
secure: config.nodeEnv === 'production'
```

---

## Frontend — Projeto pos-admin/

### Stack Tecnolgica

| Tecnologia | Uso |
|---|---|
| Next.js 16 App Router | Framework principal |
| TypeScript | Tipagem esttica |
| Tailwind CSS v4 | Estilizao |
| shadcn/ui (base-ui) | Componentes UI reutilizveis |
| React Query (@tanstack/react-query) | Data fetching + caching (staleTime: 5min) |
| Axios | HTTP client com interceptors |
| Recharts | Grficos (LineChart, BarChart) |
| Lucide React | cone |

### Autenticao

**Fluxo:**
1. User acessa `/login` → middleware redireciona se j autenticado
2. Login envia `POST /api/user/login` com email/senha
3. Backend responde com cookie `httpOnly` `accessToken`
4. Axios envia cookie automaticamente via `withCredentials: true`
5. Middleware Next.js (`middleware.ts`) valida presena do cookie em todas as rotas protegidas

**Arquivo:** `pos-admin/src/middleware.ts`
```typescript
export function middleware(request: NextRequest) {
  const token = request.cookies.get("accessToken");
  const isLoginPage = request.nextUrl.pathname === "/login";
  if (token && isLoginPage) return NextResponse.redirect(new URL("/", request.url));
  if (!token && !isLoginPage) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}
// matcher: exclui api, _next/static, _next/image, favicon.ico
```

**Arquivo:** `pos-admin/src/lib/api.ts`
```typescript
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
  withCredentials: true,
});
// Interceptor: 401 → redirect /login (client-side only)
```

### Estrutura de Arquivos

```
pos-admin/
├── src/
│   ├── app/
│   │   ├── layout.tsx                          → Root layout (QueryProvider + Toaster)
│   │   ├── (auth)/login/page.tsx               → Login (email/senha)
│   │   └── (dashboard)/
│   │       ├── layout.tsx                       → Sidebar + Header + main
│   │       ├── page.tsx                         → Dashboard KPIs (7 queries)
│   │       ├── products/page.tsx                → CRUD Produtos (DataTable)
│   │       ├── categories/page.tsx              → Stub
│   │       ├── inventory/page.tsx               → Stub
│   │       ├── ingredients/page.tsx             → Stub
│   │       ├── suppliers/page.tsx               → Stub
│   │       ├── purchase-orders/page.tsx         → Stub
│   │       ├── users/page.tsx                   → Stub
│   │       ├── stores/page.tsx                  → Stub
│   │       ├── devices/page.tsx                 → Stub
│   │       ├── roles/page.tsx                   → Stub
│   │       ├── subscription/page.tsx            → Stub
│   │       ├── pdv/page.tsx                     → Stub
│   │       └── kds/page.tsx                     → Stub
│   ├── components/
│   │   ├── ui/                                  → 15 shadcn/ui components
│   │   ├── layout/
│   │   │   ├── sidebar.tsx                      → 14 itens de navegao (portugus)
│   │   │   └── header.tsx                       → Top bar com user dropdown
│   │   ├── data-table.tsx                       → Tabela reutilizvel (search/pagination/actions)
│   │   ├── kpi-card.tsx                         → Card de mtrica com trend
│   │   ├── status-badge.tsx                     → Badge colorido por status
│   │   └── confirm-dialog.tsx                   → Modal de confirmao
│   ├── services/api/
│   │   ├── auth.ts                              → login, logout, getUser
│   │   ├── dashboard.ts                         → getKPIs, getSalesReport, getTopProducts, getCMV, getVariance, getInventory, getUserStats
│   │   ├── products.ts                          → CRUD produtos
│   │   ├── inventory.ts                         → CRUD estoque
│   │   ├── ingredients.ts                       → CRUD ingredientes
│   │   ├── suppliers.ts                         → CRUD fornecedores
│   │   ├── purchase-orders.ts                   → CRUD pedidos de compra
│   │   ├── users.ts                             → CRUD usurios
│   │   ├── stores.ts                            → CRUD lojas
│   │   ├── devices.ts                           → CRUD dispositivos
│   │   ├── roles.ts                             → CRUD roles/permisses
│   │   ├── subscription.ts                      → Assinatura
│   │   ├── pdv.ts                               → Caixa/PDV
│   │   └── kds.ts                               → Kitchen Display
│   ├── lib/
│   │   ├── api.ts                               → Axios instance configurada
│   │   └── utils.ts                             → Helpers (cn, formatters)
│   ├── types/
│   │   └── index.ts                             → Interfaces TypeScript (13 tipos)
│   ├── hooks/                                   → (fases futuras)
│   └── providers/
│       └── query-provider.tsx                   → React Query provider
├── middleware.ts                                 → Auth guard
├── .env.local                                   → NEXT_PUBLIC_API_URL=http://localhost:8000/api
├── next.config.js
├── tailwind.config.ts
├── package.json
└── AGENTS.md                                    → Notas Next.js v16
```

### Componentes de UI

**15 shadcn/ui components em `src/components/ui/`:**
button, input, table, dialog, dropdown-menu, badge, card, select, label, sheet, avatar, separator, skeleton, sonner, alert

**Componentes customizados:**

| Componente | Props | Uso |
|---|---|---|
| `KpiCard` | title, value, icon, trend?, color? | Cards de mtrica no dashboard |
| `StatusBadge` | status, variant? | Exibio colorida de status |
| `DataTable` | columns, data, loading?, searchKey?, onCreate?, onEdit?, onDelete? | Tabelas CRUD reutilizveis |
| `ConfirmDialog` | open, onOpenChange, title, description, onConfirm, variant? | Modal de confirmao (default/destructive) |

### Camada de Servios

**Arquivo:** `src/services/api/dashboard.ts`
```typescript
export const dashboardService = {
  getKPIs: (period = "today") => api.get(`/dashboard/kpi?period=${period}`),
  getSalesReport: (period = "7days", groupBy = "day") =>
    api.get(`/dashboard/sales?period=${period}&groupBy=${groupBy}`),
  getTopProducts: (limit = 5, period = "7days") =>
    api.get(`/dashboard/products/top?limit=${limit}&period=${period}`),
  getCMV: (period = "30days") => api.get(`/dashboard/cmv?period=${period}`),
  getVariance: (period = "7days") => api.get(`/dashboard/variance?period=${period}`),
  getInventoryAnalytics: () => api.get("/dashboard/inventory"),
  getUserStats: () => api.get("/dashboard/users"),
};
```

**Arquivo:** `src/services/api/auth.ts`
```typescript
export const authService = {
  login: (credentials) => api.post("/user/login", credentials),  // /user, no /auth
  logout: () => api.post("/user/logout"),
  getUser: () => api.get("/user"),
};
```

Total: **14 arquivos de servios** cobrindo todos os mdulos.

### Types TypeScript

**Arquivo:** `src/types/index.ts` — 13 interfaces + 23 permissoes tipadas:

`User`, `Role`, `Store`, `Subscription`, `Product`, `ProductVariation`, `Category`, `Ingredient`, `InventoryItem`, `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`, `Device`, `Order`, `OrderItem`, `CashSession`, `KdsTicket`, `KdsItem`

Permission type union: `orders:*`, `products:*`, `inventory:*`, `users:*`, `stores:*`, `roles:*`, `devices:*`

---

## API Response Formats

### KPIs (`GET /dashboard/kpi`)
```json
{
  "success": true,
  "data": {
    "revenue": { "gross": 15000, "net": 14250, "tax": 750 },
    "orders": { "count": 45, "avgTicket": 316.67 },
    "operational": { "activeAlerts": 3, "activeProducts": 28 },
    "store": { "taxRate": 5, "currency": "BRL" }
  },
  "metadata": { "period": "today", "storeId": "..." }
}
```

### Sales Report (`GET /dashboard/sales`)
```json
{
  "success": true,
  "data": {
    "sales": [
      { "date": "21/05", "revenue": 3500, "netRevenue": 3325, "orders": 12, "tax": 175, "avgTicket": 291.67 }
    ],
    "summary": { "totalRevenue": 3500, "totalOrders": 12, "avgDailyRevenue": 3500 },
    "groupBy": "day"
  }
}
```

### Top Products (`GET /dashboard/products/top`)
```json
{
  "success": true,
  "data": {
    "products": [
      { "productId": "...", "productName": "Picanha", "totalQuantity": 25, "totalRevenue": 2500, "timesOrdered": 15, "avgPrice": 100 }
    ],
    "limit": 5
  }
}
```

### CMV (`GET /dashboard/cmv`)
```json
{
  "success": true,
  "data": {
    "cmv": { "total": 4500, "percent": 31.58, "method": "stock_movements" },
    "revenue": { "gross": 15000, "net": 14250, "tax": 750 },
    "margin": { "gross": 68.42, "amount": 9750 },
    "classification": { "level": "dentro_da_media", "color": "green" },
    "benchmarks": { "excelente": "< 25%", "dentro_da_media": "25% - 35%", "atencao": "35% - 45%", "critico": "> 45%" }
  }
}
```

### Inventory (`GET /dashboard/inventory`)
```json
{
  "success": true,
  "data": {
    "stockItems": 45,
    "totalValue": 12500.50,
    "outOfStock": 2,
    "belowMinimum": 5,
    "categoryBreakdown": { "Carnes": { "count": 12, "value": 5000 }, "Bebidas": { "count": 15, "value": 3500 } },
    "movements": { "period": "7days", "data": { "in": { "count": 8, "totalQuantity": 150 }, "out": { "count": 25, "totalQuantity": 80 } } }
  }
}
```

---

## Erros e Correes

| Erro | Causa | Soluo |
|---|---|---|
| `EADDRINUSE port 8000` | Processo j rodando | `kill` do processo existente |
| `CashRegister icon not found` | cone no existe no lucide-react | Trocado para `Receipt` |
| `<button> inside <button>` hydration error | `DropdownMenuTrigger` dentro de `Button` | Removido wrapper Button, estilos aplicados direto no trigger |
| Dashboard mostra template Next.js | `app/page.tsx` padro sobrescrevia | Deletado template padro |
| CORS blocked | localhost:3000 no estava nas origins | Adicionado a `corsOrigins` no config |
| Login 401 Invalid Credentials | Senha double-hashed via update manual | Recriado user via `model.create()` (pre-save hook) |
| `404 /api/auth/login` | Backend usa `/user/login`, no `/auth/login` | Atualizado `authService` para `/user/*` |
| Cookie no enviado em dev | `secure: true` bloqueia localhost | `sameSite: 'lax'`, `secure: false` em dev |
| `$arrayElemAt takes 2 arguments` | Sintaxe incorreta na aggregation | Trocado para `$first` |
| `Cannot read 'total' of undefined` | Frontend lia `kpis.costs.total`, API retorna `cmv.cmv.total` | Adicionada query `cmv`, atualizado page.tsx |
| `period` vs `date` no LineChart | Backend retorna campo `date`, frontend usava `period` | Corrigido `dataKey="date"` |

---

## Comandos de Desenvolvimento

```bash
# Backend (terminal 1)
cd pos-backend && npm start

# Admin Dashboard (terminal 2)
cd pos-admin && npm run dev

# Frontend PDV (terminal 3) - j existente
cd pos-frontend && npm run dev
```

**URLs:**
- Admin: `http://localhost:3000`
- PDV: `http://localhost:5173`
- API: `http://localhost:8000/api`

**Env varivel:**
```
pos-admin/.env.local:
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

---

## Prximas Fases (Pendentes)

| Fase | Mdulos | Esforo |
|---|---|---|
| Fase 2 | Products CRUD, Categories, Ingredients | 3-4 dias |
| Fase 3 | Inventory, Suppliers, Purchase Orders | 3-4 dias |
| Fase 4 | Users, Stores, Devices, Roles | 3-4 dias |
| Fase 5 | Subscription, PDV/Cash, KDS | 3-4 dias |
| Fase 6 | WebSocket real-time, react-hook-form + zod, mobile responsive | 2 dias |

### Padro para Implementao CRUD

**Service:**
```typescript
// services/api/products.ts
export const productsService = {
  getAll: (storeId: string) => api.get(`/products?storeId=${storeId}`),
  getById: (id: string) => api.get(`/products/${id}`),
  create: (data: ProductInput) => api.post("/products", data),
  update: (id: string, data: ProductInput) => api.put(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
};
```

**Hook React Query:**
```typescript
export function useProducts(storeId: string) {
  return useQuery({
    queryKey: ["products", storeId],
    queryFn: () => productsService.getAll(storeId),
  });
}
```

**DataTable:**
```tsx
<DataTable
  columns={columns}
  data={data}
  loading={isLoading}
  searchKey="name"
  onCreate={() => router.push("/products/new")}
  onEdit={(id) => router.push(`/products/${id}/edit`)}
  onDelete={handleDelete}
/>
```

---

## Atualização: CRUD Completo (Fases 2-5)

### Páginas CRUD Implementadas

| Módulo | Rota | Funcionalidades |
|---|---|---|
| Produtos | `/products` | List, Create, Edit, Delete com modal form + categorias |
| Categorias | `/categories` | List, Create, Edit, Delete com modal form |
| Ingredientes | `/ingredients` | List, Create, Edit, Delete com selects (categoria/unidade) |
| Estoque | `/inventory` | Balanço, Entrada/Saída com modais, alertas, cards resumo |
| Fornecedores | `/suppliers` | List, Create, Edit, Delete com endereço/contato |
| Pedidos de Compra | `/purchase-orders` | List, Create, Status workflow (pending→confirmed→received) |
| Usuários | `/users` | List, Create, Edit, Delete com seleção de role |
| Lojas | `/stores` | List, Create, Edit, Delete com endereço/taxa |
| Dispositivos | `/devices` | List, Aprovar, Revogar com stats |
| Perfis de Acesso | `/roles` | List, Create, Edit, Delete com matriz de permissões |
| Assinatura | `/subscription` | Visualizar plano, limites de uso, troca de plano |
| PDV/Caixa | `/pdv` | Abrir/Fechar caixa, histórico, resumo de vendas |
| KDS/Cozinha | `/kds` | Tickets em tempo real, aceitar/preparar/pronto/entregue |

### Padrão de Implementação

Cada página CRUD segue o padrão:
1. **Listagem**: `useQuery` + `DataTable` com search e colunas customizáveis
2. **Create/Edit**: `Dialog` modal com form + `useMutation` para salvar
3. **Delete**: `ConfirmDialog` com `useMutation` destrutiva
4. **Feedback**: `toast` para sucesso/erro
5. **Cache**: `queryClient.invalidateQueries` após mutação

### Componentes Atualizados

- **DataTable**: Adicionado suporte a `onSearchField` para busca customizada
- **StatusBadge**: Adicionado prop `label` para texto customizado
- **Types**: Expandidos com campos faltantes (Ingredient, Supplier, Store, Device, Role, User)
- **Services**: Todos atualizados com `ApiResponse<T>` wrapper para tipagem correta
