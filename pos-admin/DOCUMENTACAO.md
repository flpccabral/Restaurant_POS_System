# Painel Administrativo POS

Documentação completa do dashboard administrativo do sistema POS — painel de gestão back-office isolado da interface de loja (PDV).

---

## Arquitetura

```
pos-admin/          → Next.js 16 App Router (port 3000) — Painel administrativo
pos-frontend/       → Vite + React (port 5173)           — Interface de loja/PDV
pos-backend/        → Express + MongoDB (port 8000)      — APIs compartilhadas
```

## Stack Tecnológica

| Tecnologia | Função |
|------------|--------|
| **Next.js 16** (App Router) | Framework principal |
| **TypeScript** | Tipagem estática |
| **Tailwind CSS v4** | Estilização |
| **shadcn/ui** (Base UI) | Componentes de interface acessíveis |
| **React Query** (@tanstack/react-query) | Data fetching, caching e sincronização |
| **Axios** | Cliente HTTP com interceptors |
| **Recharts** | Gráficos (linha, barra) |
| **Sonner** | Notificações toast |
| **react-hook-form + Zod** | Validação de formulários |
| **Socket.io-client** | WebSockets (pronto para uso futuro) |
| **lucide-react** | Ícones |

---

## Estrutura de Arquivos

### Layout e Navegação

| Arquivo | Função |
|---------|--------|
| `src/app/layout.tsx` | Root layout com provedores globais (QueryProvider, Toaster) |
| `src/app/(dashboard)/layout.tsx` | Layout do painel: Sidebar + Header + main content |
| `src/app/(dashboard)/page.tsx` | **Dashboard principal** com KPIs, gráficos e tabelas |
| `src/components/layout/sidebar.tsx` | Barra lateral fixa com 14 módulos de navegação |
| `src/components/layout/header.tsx` | Top bar com identificação e menu do usuário (perfil, sair) |

### Páginas de Módulos

| Página | Rota | Status |
|--------|------|--------|
| **Dashboard** | `/` | ✅ Conectado à API com KPIs, gráficos e tabelas reais |
| **Produtos** | `/products` | ✅ DataTable com listagem, pesquisa, edição e exclusão |
| **Categorias** | `/categories` | 🔲 Stub (Fase 2) |
| **Estoque** | `/inventory` | 🔲 Stub (Fase 3) |
| **Ingredientes** | `/ingredients` | 🔲 Stub (Fase 2) |
| **Fornecedores** | `/suppliers` | 🔲 Stub (Fase 3) |
| **Pedidos de Compra** | `/purchase-orders` | 🔲 Stub (Fase 3) |
| **Usuários** | `/users` | 🔲 Stub (Fase 4) |
| **Lojas** | `/stores` | 🔲 Stub (Fase 4) |
| **Dispositivos** | `/devices` | 🔲 Stub (Fase 4) |
| **Perfis de Acesso** | `/roles` | 🔲 Stub (Fase 4) |
| **Assinatura** | `/subscription` | 🔲 Stub (Fase 5) |
| **PDV / Caixa** | `/pdv` | 🔲 Stub (Fase 5) |
| **Cozinha (KDS)** | `/kds` | 🔲 Stub (Fase 5) |

### Autenticação

| Arquivo | Função |
|---------|--------|
| `src/app/(auth)/login/page.tsx` | Página de login com formulário email/senha |
| `src/middleware.ts` | Middleware Next.js — redireciona para `/login` se não autenticado |

### Camada de Serviços (API)

Todos os serviços usam `axios` configurado com `withCredentials: true` para envio automático de cookies JWT.

| Serviço | Arquivo | Endpoints |
|---------|---------|-----------|
| **Autenticação** | `services/api/auth.ts` | `/user/login`, `/user/logout`, `/user` |
| **Dashboard** | `services/api/dashboard.ts` | `/dashboard/kpi`, `/dashboard/sales`, `/dashboard/products/top`, `/dashboard/inventory`, `/dashboard/users` |
| **Produtos** | `services/api/products.ts` | CRUD completo `/products` |
| **Estoque** | `services/api/inventory.ts` | `getAll`, `getById`, `stockIn`, `stockOut`, `getLowStock` |
| **Ingredientes** | `services/api/ingredients.ts` | CRUD completo `/ingredients` |
| **Fornecedores** | `services/api/suppliers.ts` | CRUD completo `/suppliers` |
| **Pedidos de Compra** | `services/api/purchase-orders.ts` | `getAll`, `getById`, `create`, `updateStatus`, `delete` |
| **Usuários** | `services/api/users.ts` | CRUD + `assignRole` |
| **Lojas** | `services/api/stores.ts` | CRUD completo `/stores` |
| **Dispositivos** | `services/api/devices.ts` | `getAll`, `approve`, `revoke`, `delete` |
| **Perfis** | `services/api/roles.ts` | CRUD completo `/roles` |
| **Assinatura** | `services/api/subscription.ts` | `getDetails`, `updatePlan` |
| **PDV** | `services/api/pdv.ts` | `openSession`, `getActiveSession`, `closeSession`, `getHistory` |
| **KDS** | `services/api/kds.ts` | `getTickets`, `updateItemStatus`, `markComplete` |

### Componentes Reutilizáveis

| Componente | Arquivo | Função |
|------------|---------|--------|
| **DataTable** | `components/data-table.tsx` | Tabela com pesquisa, ordenação, paginação, ações (editar/excluir) e loading skeleton |
| **KpiCard** | `components/kpi-card.tsx` | Card de métrica com título, valor, ícone e indicador de tendência |
| **StatusBadge** | `components/status-badge.tsx` | Badge colorido para status (active, inactive, pending, approved, etc.) |
| **ConfirmDialog** | `components/confirm-dialog.tsx` | Modal de confirmação (padrão e destrutivo) para ações sensíveis |

### Componentes shadcn/ui

`button`, `input`, `table`, `dialog`, `dropdown-menu`, `badge`, `card`, `select`, `label`, `sheet`, `avatar`, `separator`, `skeleton`, `sonner`, `alert`

### Configuração e Utilitários

| Arquivo | Função |
|---------|--------|
| `src/lib/api.ts` | Instância Axios com interceptors (redirecionamento 401) |
| `src/lib/utils.ts` | Utilitário `cn()` (clsx + tailwind-merge) |
| `src/types/index.ts` | Tipagens TypeScript (User, Product, Store, Order, InventoryItem, etc.) |
| `src/providers/query-provider.tsx` | React Query Provider com config global |
| `.env.local` | `NEXT_PUBLIC_API_URL=http://localhost:8000/api` |
| `middleware.ts` | Auth guard — valida cookie `accessToken` e protege rotas |

---

## Autenticação

### Fluxo

1. Usuário acessa `http://localhost:3000`
2. `middleware.ts` verifica cookie `accessToken`
3. Sem cookie → redireciona para `/login`
4. Login: POST `/api/user/login` com email + senha
5. Backend responde com cookie `httpOnly` `accessToken` (30 dias)
6. Axios envia cookie automaticamente via `withCredentials: true`
7. Todas as requisições subsequentes são autenticadas
8. Erro 401 → interceptor redireciona para `/login`

### Credenciais de Acesso

| Campo | Valor |
|-------|-------|
| **Email** | `admin@pos.com` |
| **Senha** | `admin123` |

---

## Dashboard Principal

### KPIs (primeira linha)

| Card | Métrica | Fonte |
|------|---------|-------|
| Faturamento | Receita total do período + margem | `/dashboard/kpi` |
| Pedidos | Total de pedidos + pendentes | `/dashboard/kpi` |
| Produtos Ativos | Quantidade de produtos ativos | `/dashboard/kpi` |
| Alertas de Estoque | Itens abaixo do mínimo | `/dashboard/kpi` |

### Cards Secundários

| Card | Métricas |
|------|----------|
| Valor em Estoque | Valor total, itens sem estoque, abaixo do mínimo |
| Custos | CMV, margem bruta, lucro bruto |
| Impostos | Total arrecadado, receita líquida |

### Gráficos

| Gráfico | Tipo | Dados |
|---------|------|-------|
| Tendência de Faturamento | LineChart (Recharts) | Receita por período via `/dashboard/sales` |
| Produtos Mais Vendidos | BarChart (Recharts) | Top 5 produtos por receita via `/dashboard/products/top` |

### Tabelas

| Tabela | Colunas |
|--------|---------|
| Produtos Mais Vendidos | Produto, Quantidade, Faturamento |
| Estoque por Categoria | Categoria, Itens, Valor |

### Filtro de Período

Seletor com opções: Hoje, Últimos 7 dias, Últimos 30 dias, Esta semana, Este mês

---

## Módulos Implementados

### Dashboard (`/`)

Página principal com métricas em tempo real conectadas às APIs do backend. Inclui 4 KPI cards, 3 cards secundários, 2 gráficos interativos e 2 tabelas de detalhe.

### Produtos (`/products`)

- DataTable com listagem de produtos da API
- Pesquisa por nome
- Colunas: Nome, Categoria, Preço (R$), Status (Ativo/Inativo)
- Botões de editar e excluir por linha
- Dialog de confirmação para exclusão

---

## Módulos Planejados

### Fase 2 — Catálogo
- **Categorias**: CRUD com modal form
- **Ingredientes**: CRUD com unidades de medida

### Fase 3 — Estoque & Fornecedores
- **Estoque**: Tabela de estoque, entradas/saídas, alertas
- **Fornecedores**: CRUD com dados de contato
- **Pedidos de Compra**: Listar/criar, vincular supplier + items

### Fase 4 — Administração
- **Usuários**: CRUD com atribuição de roles
- **Lojas**: CRUD multi-loja
- **Dispositivos**: Listar/aprovar/revogar
- **Perfis de Acesso**: CRUD com seleção de permissões

### Fase 5 — Módulos Especiais
- **Assinatura**: Plano atual, histórico de pagamentos
- **PDV/Caixa**: Sessões abertas, fechamentos, histórico
- **Cozinha (KDS)**: Painel em tempo real via WebSocket

---

## Alterações no Backend

### CORS (`pos-backend/config/config.js`)

Adicionado `http://localhost:3000` às origens permitidas:

```javascript
corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:3000").split(",")
```

### Cookie (`pos-backend/controllers/userController.js`)

Cookie agora é `lax` + não-secure em desenvolvimento:

```javascript
sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
secure: config.nodeEnv === 'production'
```

### app.js

Middleware CORS atualizado para usar `config.corsOrigins`.

---

## Comandos

```bash
# Iniciar admin dashboard
cd pos-admin && npm run dev

# Build de produção
npm run build

# Iniciar backend (porta 8000)
cd pos-backend && npm run dev
```

---

## Servidores

| Serviço | URL | Status |
|---------|-----|--------|
| Backend API | http://localhost:8000 | Express + MongoDB |
| Admin Dashboard | http://localhost:3000 | Next.js 16 |
| Frontend Loja | http://localhost:5173 | Vite + React |
