# Changelog — Restaurant POS System

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

> **Como adicionar uma entrada:** Coloque a mudança na seção `[Unreleased]` com a categoria correta (Added, Changed, Deprecated, Removed, Fixed, Security). Ao criar uma release, renomeie `[Unreleased]` para `[versão] — YYYY-MM-DD` e crie um novo `[Unreleased]` vazio.

---

## [Unreleased]

### Security

- **PENDENTE:** Rotacionar credenciais do MongoDB Atlas e JWT_SECRET expostos em `.env` commitado (P0-01)
- **PENDENTE:** Adicionar rate limiting em `/api/user/login` e `/api/user/register` (P0-02)
- **PENDENTE:** Adicionar `storeIsolation` em `pdvRoutes.js` (P0-03)
- **PENDENTE:** Implementar autenticação de handshake Socket.io (P0-04)
- **PENDENTE:** Restringir `/api/subscription/seed` a masterAdmin (P1-01)

### Added

- `docs/adr/` — Architecture Decision Records: ADR-0001 a ADR-0005
- `CONTRIBUTING.md` — Guia de contribuição completo com tour da arquitetura, fluxos, convenções e variáveis de ambiente
- `pos-backend/docs/runbook.md` — Runbook operacional com diagnóstico, backup e resposta a incidentes
- `.github/workflows/ci.yml` — Pipeline CI (GitHub Actions) com testes, build e verificação de segredos
- `pos-backend/scripts/verify.sh` — Script de verificação local unificado
- `SECURITY.md` — Política de reporte de vulnerabilidades

---

## [0.9.0] — 2026-06-15 (Piloto Controlado — Fase 9)

> **Reconstituído:** Esta versão foi inferida a partir do estado atual do repositório e da documentação de fase. Não há tag Git correspondente.

### Added

- **Fase 9.1C:** Baixa de estoque transacional com MongoDB sessions em `orderCheckoutService.js`
- **Fase 9.1D:** Enriquecimento de metadados de produto no resultado de checkout (sellableType, sku, variation)
- **Fase 9.3C:** Mapeamento de `orderType` para formato KDS (`dine_in` → `dine-in`)
- `services/stockReversalService.js` — Reversão de movimentos de estoque com MongoDB session
- `services/interStoreTransferService.js` — Transferência inter-loja com transação atômica
- `scripts/pilot-seed.js` — Seed de dados para 5 lojas do piloto (PILOT_Hamburgueria, PILOT_Pizzaria, PILOT_Arabe, PILOT_Bar, PILOT_Central)
- `PILOT_CHECKLIST.md`, `PILOT_GUIDE.md`, `PILOT_ROADMAP.md`, `PILOT_METRICS.md`, `PILOT_ROLLBACK_PLAN.md`

### Changed

- `orderController.js` — KDS sync com lógica de filtro de produtos que não precisam de preparo (`industrialized_resale`, `stock_item_direct`)

---

## [0.8.0] — 2026-06-01 (Fase 8 — Mobile PDV & Audit Log)

> **Reconstituído** a partir da documentação de fase.

### Added

- `models/cashSessionModel.js` — Sessão de caixa com abertura, fechamento, movimentos e reconciliação
- `controllers/pdvController.js` — PDV completo: abertura/fechamento de sessão, processamento de pagamento
- `models/operationalAuditLogModel.js` — Registro de auditoria para 9 tipos de ação operacional
- `services/auditService.js` — Fire-and-forget audit logging (ADR-0005)
- `routes/auditRoute.js` e `GET /api/audit/daily-report`
- `tests/phase8-pdv-models.test.js` — Único arquivo de teste Jest existente

---

## [0.7.0] — 2026-05-20 (Fase 7 — Kitchen Display System)

> **Reconstituído** a partir da documentação de fase.

### Added

- `models/kdsOrderModel.js`, `models/kdsConfigModel.js`
- `routes/kdsRoutes.js`, `controllers/kdsController.js`
- Sincronização automática de pedidos para KDS ao criar pedido (fire-and-forget)

---

## [0.6.0] — 2026-05-10 (Fase 6 — Subscription & Billing SaaS)

> **Reconstituído** a partir da documentação de fase.

### Added

- `models/subscriptionModel.js`, `models/planModel.js`
- `controllers/subscriptionController.js`, `routes/subscriptionRoutes.js`
- Sistema de planos (basic, pro, enterprise) com limites de uso

### Known issues

- `subscriptionModel.status` contém `'cancelled'` e `'canceled'` como valores distintos — inconsistência de enum
- Campos `stripeSubscriptionId` e `stripeCustomerId` mapeados no schema mas sem integração Stripe implementada

---

## [0.5.0] — 2026-04-20 (Fase 5 — Dashboard & Observabilidade)

> **Reconstituído** a partir da documentação de fase.

### Added

- `controllers/dashboardController.js` (803 linhas)
- Stock Policies, alertas operacionais, recomendações de reposição
- `routes/observabilityRoute.js` — endpoints de saúde do estoque e alertas
- `services/replenishmentService.js` — geração de recomendações

---

## [0.4.0] — 2026-04-01 (Fase 4 — Purchase Orders & Fornecedores)

> **Reconstituído** a partir da documentação de fase.

### Added

- `models/purchaseOrderModel.js`, `models/supplierModel.js`
- `controllers/purchaseOrderController.js`
- Recebimento de compras com atualização de saldo de estoque

---

## [0.3.0] — 2026-03-15 (Fase 3 — Produção Interna & Subprodutos)

> **Reconstituído** a partir da documentação de fase.

### Added

- `models/productionBatchModel.js`
- `services/productionService.js` com MongoDB session
- `routes/productionRoute.js`

---

## [0.2.0] — 2026-03-01 (Fase 2 — Menu, Receitas & Estoque)

> **Reconstituído** a partir da documentação de fase.

### Added

- `models/productModel.js`, `models/categoryModel.js`, `models/recipeModel.js`
- `models/stockMovementModel.js`, `models/stockBalanceModel.js`, `models/stockLocationModel.js`
- Gestão de ingredientes globais e locais por loja
- Transferências de estoque central para loja

---

## [0.1.0] — 2026-02-15 (Fase 1 — Fundação Multi-Tenant SaaS)

> **Reconstituído** a partir de `PHASE1_FINAL_SUMMARY.md`.

### Added

- Estrutura inicial do monólito Express com multi-tenancy
- `models/userModel.js`, `models/storeModel.js`, `models/roleModel.js`, `models/deviceModel.js`
- `middlewares/tokenVerification.js`, `middlewares/storeIsolation.js`, `middlewares/checkPermission.js`, `middlewares/deviceApproval.js`
- Sistema de roles dinâmicas com permissões por módulo (ADR-0004)
- Device approval com nickname
- Socket.io com room isolation por `store:storeId`
- IDs UUID v4 imutáveis em todos os models principais
