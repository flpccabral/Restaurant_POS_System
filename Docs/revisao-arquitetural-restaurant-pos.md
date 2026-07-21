# Revisão Arquitetural — Restaurant POS System

> **Data da análise:** 2026-07-20  
> **Escopo inspecionado:** pos-backend (Node.js/Express/MongoDB), pos-frontend (React/Vite), pos-admin (Next.js)  
> **Metodologia:** inspeção estática de código, modelos, rotas, middlewares, scripts e testes; sem execução de ambiente.

---

## 1. Resumo Executivo

### Avaliação geral

Sistema multi-tenant SaaS de POS para restaurantes em estágio **piloto operacional** (Fases 1–9 documentadas e parcialmente implementadas). A base técnica é razoável para o porte: monólito Express modularizado por domínio, com boa separação de responsabilidades em controllers/services/models. Porém, acumula dívidas de segurança e de cobertura de testes que precisam ser tratadas antes de expansão.

### Três principais forças

1. **Modelo de multi-tenancy bem definido** — middleware `storeIsolation` e padrão `req.storeId` injetado na cadeia, com isolamento consistente nas rotas principais.
2. **Baixa de estoque transacional (MongoDB sessions)** — `orderCheckoutService` usa sessão MongoDB para atomicidade, com políticas claras de soft/hard error e reversão de estoque (`stockReversalService`).
3. **Trilha de auditoria operacional** — `auditService` + `OperationalAuditLog` registram ações críticas sem lançar exceção, preservando a operação em caso de falha de auditoria.

### Três principais riscos

1. **Segredo JWT hardcoded no `.env` de produção** — `JWT_SECRET=your-super-secret-jwt-key-change-this` comprometido no `.env` real; qualquer atacante com esse valor pode forjar tokens para qualquer loja.
2. **URI do MongoDB Atlas exposta em `.env` versionado** — credenciais do banco em texto plano no repositório (`pos-backend/.env`); fato comprovado pela leitura direta do arquivo.
3. **Cobertura de testes insuficiente** — apenas 1 arquivo de test encontrado em `tests/` (`phase8-pdv-models.test.js`); o jest.config.js aponta para `tests/**/*.test.js` mas os testes das fases 1–7 declarados nos scripts `package.json` não existem no diretório `tests/`, somente scripts manuais em `scripts/`.

### Recomendação de continuidade

**Condicional.** O sistema pode operar em piloto restrito, mas requer correção imediata dos segredos expostos e rotação de credenciais antes de qualquer onboarding de novos clientes ou expansão de acesso.

### Nível de confiança da análise

**Alto** para backend (código-fonte inspecionado integralmente na maior parte dos módulos críticos). **Médio** para frontend/admin (estrutura inspecionada, código interno de componentes não lido). Não foi executado nenhum teste automatizado.

---

## 2. Inventário Técnico

| Área | Componentes encontrados | Evidências | Observações |
|---|---|---|---|
| **Runtime** | Node.js (versão não fixada) | `package.json` sem `engines` | Risco de divergência de versão entre dev e prod |
| **Framework backend** | Express 4.21.2 | `pos-backend/package.json` | Versão estável, sem HTTP/2 |
| **Banco de dados** | MongoDB Atlas (mongoose 8.9.5) | `.env`, `config/config.js` | Replica set não confirmado; transações exigem RS |
| **Autenticação** | JWT (jsonwebtoken 9.0.2) + cookie httpOnly | `tokenVerification.js`, `userController.js` | `expiresIn: '1d'` no token, cookie de 30 dias — assimetria |
| **WebSockets** | Socket.io 4.8.1 | `app.js`, `websocketService.js` | Rooms por `store:${storeId}`, sem autenticação de handshake documentada |
| **Pagamentos** | Razorpay 2.9.5 | `package.json`, `paymentController.js` | Webhooks configurados mas segredo em `.env` como placeholder |
| **Frontend POS** | React 18.3 + Vite 6 + Redux Toolkit + TanStack Query + Tailwind CSS | `pos-frontend/package.json` | SPA em JavaScript (sem TypeScript) |
| **Admin panel** | Next.js 16.2.6 + React 19 + TypeScript + shadcn/ui | `pos-admin/package.json` | TypeScript no admin, ausente no POS frontend |
| **Testes** | Jest 30.4.2 + mongodb-memory-server 11.1.0 + Supertest 7.2.2 | `jest.config.js` | Somente 1 arquivo de teste real encontrado |
| **Scripts operacionais** | 40 scripts em `pos-backend/scripts/` | Diretório `scripts/` | Sem automação de execução — rodam manualmente |
| **CI/CD** | Não encontrado | Ausência de `.github/`, `Dockerfile`, `docker-compose.yml` | Risco operacional alto |
| **Variáveis de ambiente** | `PORT`, `MONGODB_URI`, `JWT_SECRET`, `RAZORPAY_*`, `CORS_ORIGINS` | `.env.example`, `config/config.js` | `.env` real commitado com credenciais reais |
| **Autenticação/autorização** | Sistema de Roles dinâmico + fallback string legacy + `isMasterAdmin` | `roleModel.js`, `checkPermission.js` | Dualidade string/ObjectId no campo `role` é fonte de bugs |
| **Auditoria** | `OperationalAuditLog` + `auditService` | `operationalAuditLogModel.js`, `auditService.js` | Cobre apenas 9 tipos de ação; não cobre login, exclusões de usuário, mudanças de plano |
| **Observabilidade** | Logs em `console.log/error` apenas | `app.js`, `orderController.js` | Sem structured logging, sem tracing, sem métricas |
| **Migrações** | Scripts manuais em `scripts/` | `migrate-all.js`, `migrate-phase9-1c-data.js` | Sem versioning de migration (ex: migrate-mongo, Liquibase) |
| **Modelos de dados** | 28 models Mongoose | Diretório `models/` | Schemas bem definidos com índices compostos |
| **Multi-tenancy** | Middleware `storeIsolation` + helper `getStoreFilter` | `storeIsolation.js` | Aplicado em rotas principais; PDV usa `checkRole` sem `storeIsolation` |
| **Modelos SaaS** | `Plan`, `Subscription`, `SessionLog` | `planModel.js`, `subscriptionModel.js` | Integração com Stripe mapeada no schema, mas não implementada (campos `stripeSubscriptionId` sem uso real) |

---

## 3. Grafo de Dependências

```
pos-backend/app.js  ⚠️ (módulo central — registra todas as rotas)
│
├── config/config.js ❌ (fallback JWT_SECRET hardcoded)
├── config/database.js
├── middlewares/
│   ├── tokenVerification.js ⚠️ (chamado em quase todas as rotas — SPOF de auth)
│   ├── checkPermission.js ⚠️ (dualidade string/ObjectId em role; DB query por request)
│   ├── storeIsolation.js   (injeção de req.storeId — bem isolado)
│   ├── deviceApproval.js   (chamado dentro de userController no login)
│   └── globalErrorHandler.js
│
├── routes/* → controllers/* → services/* → models/*
│
├── services/
│   ├── orderCheckoutService.js ⚠️ (649 linhas; ponto central de baixa — SPOF operacional)
│   ├── websocketService.js     (wrapper de io.emit — sem estado)
│   ├── stockReversalService.js (usa MongoDB session ✅)
│   ├── interStoreTransferService.js (usa MongoDB session ✅)
│   ├── recipeService.js
│   ├── auditService.js
│   └── ...
│
└── models/ (28 modelos Mongoose)
    ├── userModel.js  ⚠️ (campo role: Mixed — string ou ObjectId)
    ├── orderModel.js ⚠️ (campo orderStatus com inconsistência de casing: 'In Progress' vs 'completed')
    ├── stockMovementModel.js ❌ (createMovement não é atômico por si só — depende de session externa)
    └── subscriptionModel.js ⚠️ (updateUsage faz 4 queries sem transação)

pos-frontend/src/
├── App.jsx → pages/ → components/
├── redux/ (Redux Toolkit — state global)
├── https/  🔁 (nomenclatura de diretório inesperada; provável camada de API)
└── hooks/

pos-admin/src/
├── app/ (App Router Next.js)
├── components/ (shadcn/ui)
├── services/ (API layer)
└── contexts/

Ciclos de importação identificados: ❌ nenhum circular confirmado nas inspeções
Hotspots de acoplamento ⚠️: orderCheckoutService (referência direta a 5+ modelos sem abstração de repositório)
```

**Legenda:** ⚠️ hotspot · ❌ ponto único de falha ou defeito · 🔁 ciclo potencial

---

## 4. Análise de Padrões

| Padrão | Onde é usado | Avaliação | Evidência | Observações |
|---|---|---:|---|---|
| Layered Architecture (Route → Controller → Service → Model) | Todo o backend | ✅ | `app.js`, `orderController.js`, `orderCheckoutService.js` | Bem aplicado na maioria dos módulos |
| Multi-tenancy por middleware (Store Isolation) | `storeIsolation.js`, rotas principais | ✅ | `storeIsolation.js` L13–157 | PDV (`pdvRoutes.js`) não aplica `storeIsolation` — potencial bypass |
| Repository (parcial) | `stockMovementModel.statics.createMovement` | ⚠️ | `stockMovementModel.js` L154–207 | Padrão aplicado somente em alguns modelos; maioria usa `Model.find()` direto no controller |
| Service Layer | `services/` | ✅ | `orderCheckoutService.js`, `recipeService.js` | Bem separado; controllers delegam orquestração |
| Strategy (stockImpactRule) | `orderCheckoutService.js` switch-case | ⚠️ | `orderCheckoutService.js` L161–300 | Strategy implementado via switch, não via polimorfismo — difícil de estender |
| Audit Log | `auditService.js` + `OperationalAuditLog` | ⚠️ | `auditService.js` L31–38 | Cobre somente 9 tipos de evento de estoque; login, cancelamentos e mudanças de plano fora do escopo |
| Event-driven (WebSocket) | `websocketService.js`, `app.js` | ⚠️ | `app.js` L24–63 | Relay de `order:status` feito cliente-a-cliente sem autenticação de socket |
| Fallback (soft error em baixa de estoque) | `orderCheckoutService.js` | ✅ | `orderCheckoutService.js` L14–20 (comentário documental) | Política bem documentada: hard vs soft errors |
| Transaction (MongoDB session) | `stockReversalService`, `transferService`, `pdvController`, `orderController` | ✅ | Grep `startSession` (13 ocorrências) | Exige replica set no MongoDB; não verificado se Atlas está configurado como RS |
| Legacy Role Compatibility | `userModel.js` (campo Mixed), `checkPermission.js`, `userController.js` | ❌ | `userModel.js` L46–50, `checkPermission.js` L202–212 | Dualidade string/ObjectId cria ramificações condicionais em vários lugares; risk de bypass de permissão |
| Dependency Injection (parcial) | `app.set('io', io)` → `req.app.get('io')` | ⚠️ | `app.js` L21, `websocketService.js` L7 | Não é DI formal; io passado via Express app — acoplamento implícito |
| CQRS | Ausente | — | — | Necessita inspeção adicional para dashboard analytics (queries de leitura pesada misturadas) |

---

## 5. Fluxos do Sistema

### Fluxo de criação de pedido (escrita principal)

```
[POS Frontend]
    │  POST /api/order  (Bearer token / cookie)
    ▼
[isVerifiedUser] → verifica JWT → carrega User do DB
    │
[storeIsolation] → valida store do usuário → injeta req.storeId
    │
[checkPermission('orders','create')] → carrega Role do DB → verifica bit
    │
[orderController.addOrder]
    ├─ valida campos obrigatórios (name, phone, guests, items, table)
    ├─ cria Order no DB (orderStatus: 'In Progress')
    ├─ syncOrderToKds() → cria KDSOrder (fire-and-forget) ⚠️
    ├─ ws.emitOrderCreated(io, order) → Socket.io room store:storeId
    └─ responde 201

[POSTERIOR — chamada separada pelo POS]
    POST /api/order/:id/process-stock-deduction
    └─ orderController.processOrderStockDeduction
         └─ mongoose.startSession()
              └─ orderCheckoutService.processOrderStockDeduction(session)
                   ├─ resolveStoreLocation() → StockLocation tipo STORE
                   ├─ para cada item: findRecipeForItem → simulateItemConsumption
                   ├─ executeDeduction → StockMovement.createMovement (atomic)
                   └─ atualiza Order com COGS e status

Pontos críticos:
  ⚠️ Criação do pedido e baixa de estoque são chamadas separadas — janela de inconsistência
  ⚠️ syncOrderToKds é fire-and-forget (falhas silenciosas)
  ⚠️ 3 queries ao DB na cadeia de middlewares antes de chegar ao controller (User, Role, Store)
```

### Fluxo de pagamento (PDV)

```
[POS Frontend]
    │  POST /api/pdv/payment
    ▼
[isVerifiedUser] → [checkRole(['cashier','manager','admin'])]  ⚠️ (sem storeIsolation!)
    │
[pdvController.processPayment]
    ├─ valida sessão de caixa ativa (CashSession)
    ├─ mongoose.startSession() ← MongoDB transaction ✅
    │   ├─ cria Payment
    │   ├─ atualiza Order (paymentStatus, closeStatus)
    │   ├─ atualiza Table (status)
    │   ├─ processOrderStockDeduction dentro da transação
    │   └─ commit
    ├─ ws.emitOrderPaid(io, ...)
    └─ responde 200

Bypasses identificados:
  ❌ pdvRoutes.js não usa storeIsolation — req.storeId pode ser null
  ❌ storeRef = req.user.store (raw ObjectId) — isolamento implícito, não garantido pelo middleware
```

### Fluxo de falha (estoque insuficiente)

```
executeDeduction → StockMovement.createMovement
    → lança Error("Insufficient stock. Available: X, Requested: Y")
        → capturado em orderCheckoutService (hard error)
            → session.abortTransaction()
                → Order.status = 'failed' (salvo fora da sessão)
                    → OperationalAlert.create() (alerta crítico)

Risco: Order salvo como 'failed' mas a operação continua — cliente pode não ser notificado em tempo real ⚠️
```

### Fluxo de autenticação

```
POST /api/user/login
    ├─ User.findOne({email}).populate('store')
    ├─ bcrypt.compare(password, hash)
    ├─ user.lastLoginAt = new Date() → user.save() ← ⚠️ aciona pre('save') que rehasha password se `isModified`
    ├─ jwt.sign({ _id, storeId, isMasterAdmin }, secret, { expiresIn: '1d' })
    ├─ res.cookie('accessToken', token, { httpOnly: true, sameSite: 'lax'|'none', secure: prod })
    └─ registerDeviceOnLogin(req, res, callback)

Risco: cookie sameSite='lax' em desenvolvimento permite envio cross-site em contextos de navegação top-level
Risco: expiresIn='1d' no JWT vs maxAge=30 dias no cookie — token pode ter expirado mas cookie persiste
```

---

## 6. Matriz de Contratos e Esquemas

| Contrato ou esquema | Definição | Aplicação em runtime | Testes | Lacunas |
|---|---|---|---|---|
| `userModel` (email, phone, password, role) | Mongoose schema com validators | Pré-save hook, validators do Mongoose | Parcial (setup.js cria usuário de teste) | Email não é único globalmente — índice único composto `{store, email}` permite mesmo email em lojas diferentes |
| `orderModel` (orderStatus enum) | `['In Progress', 'Preparing', 'Ready', 'completed', 'cancelled']` | Mongoose enum validator | Não testado | Inconsistência de casing ('In Progress' maiúsculo vs 'completed' minúsculo); `normalize-order-statuses.js` existe como script corretivo |
| `stockMovementModel` (tipos de movimento) | Enum de 12 tipos | Mongoose enum + pre('validate') | Não encontrado | `direct_sale_deduction` presente no enum mas não aparece no switch de `createMovement` — necessita inspeção adicional |
| `roleModel.permissions` | Schema estruturado por módulo + customPermissions | `hasPermission()`, `hasAnyPermission()` | Não encontrado | Módulos não cobertos pelo schema estruturado (ex: kds, production, subscription) — dependem de `customPermissions` |
| `subscriptionModel.status` | `['trialing','active','past_due','cancelled','canceled',...]` | Enum Mongoose | Não encontrado | Duplicação: 'cancelled' e 'canceled' coexistem no enum — risco de divergência em queries |
| `operationalAuditLogModel.actionType` | Enum de 9 tipos | Mongoose enum | Não encontrado | Enum fixo no model; qualquer novo tipo requer migração do schema |
| JWT payload | `{ _id, storeId, isMasterAdmin }` | `tokenVerification.js` | `generateToken()` em `setup.js` inclui campo extra `store` | Token inclui `storeId` mas `tokenVerification` não o usa para autorizar — lido do banco a cada request |
| `storeModel.subscriptionPlan` | `['basic','pro','enterprise']` (string) | Mongoose enum | Não encontrado | Redundante com `subscriptionModel` — dois pontos de verdade para plano da loja |

---

## 7. Avaliação de Segurança

### Ativos protegidos

- Dados transacionais de pedidos, pagamentos e caixa por loja
- Dados de estoque (receitas, movimentos, saldos)
- Credenciais de usuários (bcrypt) e tokens JWT
- Dados de assinatura SaaS (informações de plano, uso, faturamento)

### Agentes de ameaça

1. Usuário não autenticado externo (Internet)
2. Funcionário de uma loja acessando dados de outra loja (cross-tenant)
3. Atacante com acesso ao repositório Git (credenciais expostas)
4. Usuário interno com role de baixo privilégio tentando escalada

### Fronteiras de confiança

```
[Internet] ─── CORS ──▶ [Express API] ─── mongoose ──▶ [MongoDB Atlas]
                              │
                         [Socket.io]
                              │
              ┌───────────────┴────────────────┐
         [pos-frontend]                  [pos-admin]
         (React SPA)                    (Next.js)
```

### Controles e avaliação

| Controle | Tipo | Severidade de lacuna | Evidência |
|---|---|---|---|
| **JWT_SECRET hardcoded** | ❌ Crítico | Crítica | `.env` L8: `JWT_SECRET=your-super-secret-jwt-key-change-this`; `config.js` L10: fallback ao mesmo valor |
| **URI MongoDB Atlas exposta** | ❌ Crítico | Crítica | `.env` L5: URI completa com usuário e senha em texto plano |
| **Sem helmet (HTTP security headers)** | ❌ Ausente | Alta | Grep por 'helmet' sem resultado; X-Frame-Options, CSP, HSTS ausentes |
| **Sem rate limiting** | ❌ Ausente | Alta | Grep por 'rate limit' sem resultado; `/api/user/login` e `/api/user/register` sem throttle |
| **Cookie sameSite inconsistente** | ⚠️ Parcial | Média | `userController.js` L143: `sameSite: 'lax'` em dev — adequado, mas deve ser verificado |
| **Sem autenticação de handshake Socket.io** | ⚠️ Risco | Média | `app.js` L24: `io.on('connection')` sem verificação de token; qualquer cliente pode entrar em room de loja com `join:store` |
| **`/api/subscription/seed` exposto** | ❌ Deficiente | Alta | `subscriptionRoutes.js` L36: `router.post('/seed', seedPlans)` acessível por qualquer usuário autenticado sem verificação de masterAdmin |
| **`/api/user/register` aberto** | ⚠️ Risco | Média | `userRoute.js` L8: sem autenticação; qualquer pessoa pode criar usuário se souber um `storeId` válido |
| **Dualidade de role string/ObjectId** | ⚠️ Risco | Média | `checkPermission.js` L202–212: se role for string 'Admin', `checkPermission` não valida permissões via módulo — passthrough implícito para legacy |
| **Erro de Mongoose expõe stack em produção** | ⚠️ Risco | Baixa | `globalErrorHandler.js` L29: `errorStack` enviado quando `nodeEnv === 'development'` — correto, mas deve-se garantir que `NODE_ENV=production` em deploy |
| **Webhook Razorpay sem validação de assinatura** | necessita inspeção adicional | Alta | `paymentController.js` inspecionado parcialmente; validação de `razorpay_signature` não confirmada |
| **bcrypt salt rounds = 10** | ✅ Adequado | — | `userModel.js` L98 |
| **httpOnly cookie** | ✅ Adequado | — | `userController.js` L141 |

### Perguntas mandatórias (do prompt)

1. **O que o sistema realmente protege?** Dados financeiros e operacionais de lojas SaaS; informações de estoque e receitas proprietárias.
2. **Contra quais agentes?** Principalmente funcionários cross-tenant e atacantes externos sem autenticação. Internos maliciosos com acesso ao repositório têm capacidade atual de comprometer toda a base.
3. **Controles mandatórios vs cooperativos:** `isVerifiedUser` é mandatório (cadeia quebra sem ele). `storeIsolation` é cooperativo — pode ser omitido acidentalmente em novas rotas (evidenciado em `pdvRoutes.js`).
4. **Processo com acesso ao host pode bypassar?** Sim. Com a URI do MongoDB exposta no `.env`, qualquer processo com acesso ao repositório ou ao servidor pode conectar diretamente ao banco.
5. **Trilha de auditoria:** Apenas registro; não há prevenção nem detecção ativa (sem alertas de anomalia, sem integração com sistema de monitoramento).
6. **Controles aparentes mas sem sustentação:** `checkRole` no PDV não garante isolamento de loja — parece protegido, mas a store é inferida do `req.user.store` sem validação pelo middleware padrão.

---

## 8. Lacunas de Testes

| Caminho crítico | Risco | Cobertura atual | Teste necessário | Prioridade |
|---|---|---|---|---|
| Login com credencial inválida | Média | Ausente | Teste de rejeição: email errado, senha errada, usuário inativo | Alta |
| Criação de pedido cross-tenant | Crítico | Ausente | Usuário da Loja A não pode criar pedido na Loja B | Crítica |
| Baixa de estoque — saldo insuficiente | Alto | Ausente (somente scripts manuais) | Hard error deve abortar transaction e reverter Order | Alta |
| Baixa de estoque — produto sem receita | Médio | Ausente | Soft error: pedido criado, status `no_recipe` | Média |
| Reversão de estoque | Alto | Ausente | `reverseOrderStock` deve reverter exatamente os movimentos do pedido | Alta |
| Permissão: role sem `orders.create` tenta criar pedido | Alto | Ausente | Deve retornar 403 | Alta |
| Registro de usuário sem storeId (masterAdmin path) | Médio | Ausente | Deve criar usuário sem store | Média |
| Webhook Razorpay (assinatura inválida) | Alto | Ausente | Deve rejeitar payload sem assinatura válida | Alta |
| Cancelamento de assinatura e impacto no acesso | Alto | Ausente | Usuário de loja cancelada deve ter acesso bloqueado | Alta |
| Abertura de sessão de caixa duplicada | Médio | Parcial (`phase8-pdv-models.test.js`) | Segundo `openCashSession` para mesmo usuário deve retornar 400 | Média |
| Transferência inter-loja — rollback em falha parcial | Alto | Ausente | Abort de transação deve desfazer movimentos | Alta |
| Ciclo completo de pedido (pedido → pagamento → fechamento de mesa) | Crítico | Ausente | E2E integrado | Crítica |

---

## 9. Scorecard de Prontidão

| Categoria | Nota (1–10) | Justificativa | Principal lacuna |
|---|---:|---|---|
| **Arquitetura** | 6 | Layered architecture coerente; multi-tenancy bem modelado; dívida de dualidade de roles e strategy via switch | Eliminar dualidade string/ObjectId em `role`; refatorar switch de `stockImpactRule` |
| **Segurança** | 3 | Autenticação funcional; JWT httpOnly; porém credenciais expostas, sem helmet, sem rate limiting, bypass de storeIsolation no PDV | Rotação urgente de segredos; helmet + rate limiting; autenticação de socket |
| **Dados** | 7 | Schemas bem definidos com índices compostos; transactions em operações críticas; porém inconsistência de enum (`cancelled`/`canceled`), campo `role` Mixed | Normalizar enums; migrar role para ObjectId obrigatório |
| **Testes** | 2 | 1 arquivo de teste real; scripts manuais extensos mas não automatizados; jest configurado sem cobertura real | Implementar testes de integração para os fluxos críticos; integrar testes no pipeline CI |
| **Observabilidade** | 2 | Somente `console.log` e `console.error`; sem structured logging, sem tracing, sem métricas, sem alertas automatizados | Implementar pino/winston; adicionar health check endpoint; integrar APM |
| **Operação** | 4 | Scripts de seed/migrate/rollback existem; sem Docker, sem CI/CD, sem health check HTTP, sem processo de rollback automatizado | Containerização; pipeline CI/CD; health check em `/health` |
| **Desempenho** | 5 | Índices compostos adequados; aggregation pipelines no dashboard; porém 3 queries ao DB por request autenticado (User, Role, Store) | Cache de Role/Store por sessão; paginação verificada em listagens |
| **Manutenibilidade** | 6 | Boa separação de camadas; controllers grandes (dashboardController: 803 linhas, orderController: 473 linhas); comentários úteis com fases | Quebrar controllers grandes em sub-controllers; padronizar nomenclatura |
| **Documentação** | 7 | Extensa documentação operacional (QUICKSTART, PILOT_GUIDE, WEBSOCKETS, PHASE1_SUMMARY etc.); pode divergir do código real | Verificar paridade entre docs e implementação atual |
| **Prontidão para produção** | 3 | Piloto operacional possível com ajustes; credenciais expostas impedem escala segura | Secrets manager; CI/CD; testes automatizados antes de expandir |

---

## 10. Recomendações Priorizadas

### 1. Rotação e gestão de segredos
- **Problema:** `JWT_SECRET=your-super-secret-jwt-key-change-this` e URI do MongoDB Atlas com credenciais reais estão no `.env` commitado no repositório.
- **Evidência:** `pos-backend/.env` L5 e L8.
- **Mudança proposta:** (a) Revogar imediatamente as credenciais do MongoDB Atlas e gerar novas. (b) Gerar `JWT_SECRET` aleatório de ≥32 bytes (`openssl rand -hex 32`). (c) Adicionar `.env` ao `.gitignore` e fazer `git rm --cached .env`. (d) Adotar variáveis de ambiente via secrets manager (ex: Doppler, AWS SSM, Railway secrets).
- **Arquivos afetados:** `pos-backend/.env`, `pos-backend/.gitignore`, `pos-backend/config/config.js`.
- **Impacto:** Crítico — elimina comprometimento total de credenciais.
- **Esforço:** S
- **Risco da mudança:** Médio (serviços em execução usam a URI antiga; rotação precisa de janela de manutenção).
- **Critério de aceite:** `.env` não versionado; credenciais rotacionadas; aplicação funcional com novas credenciais.

---

### 2. Adicionar `storeIsolation` às rotas do PDV
- **Problema:** `pdvRoutes.js` usa apenas `checkRole` sem `storeIsolation`, deixando `req.storeId` nulo. Os controllers do PDV inferem a store de `req.user.store` diretamente — sem a validação e injeção padrão do middleware.
- **Evidência:** `pdvRoutes.js` L12–75 (nenhuma referência a `storeIsolation`); `pdvController.js` L20: `req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store`.
- **Mudança proposta:** Adicionar `storeIsolation` como middleware em todas as rotas de `pdvRoutes.js`, após `isVerifiedUser` e antes de `checkRole`.
- **Arquivos afetados:** `pos-backend/routes/pdvRoutes.js`.
- **Impacto:** Garante que operações de caixa e pagamento sejam sempre escopadas à loja correta.
- **Esforço:** S
- **Risco:** Baixo.
- **Critério de aceite:** `req.storeId` sempre definido nos controllers PDV; teste automatizado validando cross-tenant bloqueado.

---

### 3. Implementar rate limiting e HTTP security headers
- **Problema:** Endpoints de login e registro sem throttle; sem `helmet` (X-Frame-Options, CSP, HSTS, X-Content-Type-Options ausentes).
- **Evidência:** Grep por 'helmet' e 'rate limit' sem resultado; `userRoute.js` L8–9 sem middleware de throttle.
- **Mudança proposta:** (a) Instalar `helmet` e aplicar em `app.js` antes dos middlewares de rota. (b) Instalar `express-rate-limit` e aplicar limiter de 10 req/min em `/api/user/login` e `/api/user/register`.
- **Arquivos afetados:** `pos-backend/app.js`, `pos-backend/package.json`.
- **Impacto:** Reduz superfície de ataque a brute-force e clickjacking.
- **Esforço:** S
- **Risco:** Baixo.
- **Critério de aceite:** Headers de segurança presentes nas respostas; login bloqueado após 10 tentativas/min por IP.

---

### 4. Autenticar handshake do Socket.io
- **Problema:** Qualquer cliente conectado ao Socket.io pode emitir `join:store` com qualquer `storeId` e receber eventos de outra loja.
- **Evidência:** `app.js` L24–63: nenhuma verificação de token no handler `connection`; `socket.on('join:store')` aceita qualquer valor.
- **Mudança proposta:** Implementar middleware de autenticação Socket.io (`io.use((socket, next) => { ... })`) que valide o JWT enviado em `socket.handshake.auth.token` antes de permitir conexão. Validar que o `storeId` solicitado em `join:store` pertence ao usuário autenticado.
- **Arquivos afetados:** `pos-backend/app.js`.
- **Impacto:** Elimina vazamento de eventos entre lojas.
- **Esforço:** M
- **Risco:** Médio (requer ajuste no cliente frontend para enviar token no handshake).
- **Critério de aceite:** Cliente de Loja A não recebe eventos emitidos para Loja B.

---

### 5. Proteger endpoint `/api/subscription/seed` e restringir `/api/user/register`
- **Problema:** `seedPlans` acessível por qualquer usuário autenticado. `register` acessível por qualquer pessoa sem autenticação.
- **Evidência:** `subscriptionRoutes.js` L36; `userRoute.js` L8.
- **Mudança proposta:** (a) Proteger `/seed` com verificação `isMasterAdmin` (middleware ou inline). (b) Para `register`, exigir autenticação de um masterAdmin para criar usuários em outras lojas; ou implementar fluxo de convite.
- **Arquivos afetados:** `pos-backend/routes/subscriptionRoutes.js`, `pos-backend/routes/userRoute.js`.
- **Impacto:** Elimina criação não autorizada de planos e usuários.
- **Esforço:** S
- **Risco:** Baixo.
- **Critério de aceite:** `/seed` retorna 403 para não-masterAdmin; `/register` sem convite retorna 401.

---

### 6. Implementar CI/CD básico com testes automatizados
- **Problema:** Sem pipeline CI/CD; testes declarados no `package.json` não existem como arquivos `.test.js` no diretório `tests/` (fases 1–7).
- **Evidência:** `jest.config.js` L11 (`testMatch: ['**/tests/**/*.test.js']`); apenas `tests/phase8-pdv-models.test.js` encontrado; scripts `test:phase1` a `test:phase7` no `package.json` referenciam arquivos inexistentes.
- **Mudança proposta:** (a) Criar testes de integração para os 5 fluxos críticos (criação de pedido, pagamento, baixa de estoque, autenticação, isolamento cross-tenant). (b) Configurar GitHub Actions com `npm test` na push/PR. (c) Adicionar passo de lint.
- **Arquivos afetados:** `pos-backend/tests/`, `.github/workflows/`.
- **Impacto:** Previne regressões; aumenta confiança para deploy.
- **Esforço:** L
- **Risco:** Baixo.
- **Critério de aceite:** `npm test` passa no CI; cobertura de branches críticos ≥ 70%.

---

### 7. Normalizar o campo `role` de Mixed para ObjectId obrigatório
- **Problema:** Campo `role` no `userModel` é `Mixed` — aceita string ou ObjectId. Isso cria branches condicionais em `checkPermission.js`, `tokenVerification.js` e `userController.js`, aumentando a complexidade e o risco de bypass de autorização.
- **Evidência:** `userModel.js` L46–50; `checkPermission.js` L202–212 (path legacy de string role); `userController.js` L186–204 (permissões hardcoded para role string 'Admin').
- **Mudança proposta:** Migrar todos os usuários existentes para roles dinâmicas via ObjectId (script de migração já existe como padrão); mudar o tipo do campo para `ObjectId ref 'Role'` com `required: true`; remover todos os branches de string legacy.
- **Arquivos afetados:** `pos-backend/models/userModel.js`, `pos-backend/middlewares/checkPermission.js`, `pos-backend/controllers/userController.js`, + script de migração.
- **Impacto:** Simplifica autorização; elimina classe de bugs.
- **Esforço:** M
- **Risco:** Médio (requer migração de dados antes do deploy).
- **Critério de aceite:** `user.role` sempre ObjectId; testes de permissão cobrindo todos os módulos.

---

### 8. Corrigir inconsistência no enum `subscriptionModel.status`
- **Problema:** O enum contém `'cancelled'` e `'canceled'` como valores distintos, criando risco de divergência em queries e lógica condicional.
- **Evidência:** `subscriptionModel.js` L24: `enum: ['trialing', 'active', 'past_due', 'cancelled', 'canceled', 'expired', 'incomplete']`; método `cancel()` (L219) salva `'canceled'`; código externo pode usar `'cancelled'`.
- **Mudança proposta:** Padronizar para `'canceled'` (conforme o método `cancel()`); escrever script de migração para normalizar registros existentes; remover `'cancelled'` do enum.
- **Arquivos afetados:** `pos-backend/models/subscriptionModel.js`, script de migração.
- **Impacto:** Elimina inconsistência de dados; simplifica queries de status.
- **Esforço:** S
- **Risco:** Baixo (com migration antes do deploy).
- **Critério de aceite:** Enum contém somente `'canceled'`; nenhum registro com `'cancelled'` no banco.

---

### 9. Implementar structured logging e health check
- **Problema:** Todo o logging é via `console.log/error`. Sem endpoint de health check. Sem métricas. Impossível monitorar o sistema em produção de forma confiável.
- **Evidência:** `app.js` L130: `console.log(\`☑️ POS Server is listening on port ${PORT}\`)`.
- **Mudança proposta:** (a) Instalar `pino` e substituir `console.log` por logger estruturado com level (info, warn, error). (b) Adicionar `GET /health` retornando status do servidor e conectividade com o banco. (c) Expor métricas básicas via `prom-client` (opcional, mas recomendado para fase de produção).
- **Arquivos afetados:** `pos-backend/app.js`, todos os controllers/services com `console.log`.
- **Impacto:** Viabiliza monitoramento real em produção; facilita debugging.
- **Esforço:** M
- **Risco:** Baixo.
- **Critério de aceite:** Logs em JSON com campos `level`, `timestamp`, `message`, `storeId`; `/health` retorna 200 quando DB conectado.

---

### 10. Containerizar e documentar processo de deploy
- **Problema:** Ausência de `Dockerfile`, `docker-compose.yml` ou qualquer instrução de infraestrutura. Deploy manual com dependência de configuração local do Node.js e variáveis de ambiente ad-hoc.
- **Evidência:** Listagem do repositório — nenhum arquivo de containerização encontrado.
- **Mudança proposta:** Criar `Dockerfile` multi-stage para `pos-backend`; criar `docker-compose.yml` com backend + MongoDB local para desenvolvimento; documentar variáveis de ambiente necessárias e processo de deploy em `DEPLOYMENT.md`.
- **Arquivos afetados:** `pos-backend/Dockerfile`, `docker-compose.yml`, `DEPLOYMENT.md`.
- **Impacto:** Reprodutibilidade de ambiente; base para CI/CD.
- **Esforço:** M
- **Risco:** Baixo.
- **Critério de aceite:** `docker compose up` sobe o backend; `npm test` passa dentro do container.

---

## Apêndice — Evidências de Divergência Documentação vs Implementação

| Divergência | Documentação | Implementação | Impacto |
|---|---|---|---|
| Scripts de teste fases 1–7 declarados no `package.json` mas arquivos ausentes | `package.json` L10–15 | `tests/` contém somente `phase8-pdv-models.test.js` | Confusão sobre cobertura real; `npm test` passa sem testar esses caminhos |
| `SOCKET_CORS_ORIGIN` em `.env.example` não usado no `config.js` | `.env.example` L16 | `config.js` usa `CORS_ORIGINS` | Variável documentada mas ignorada |
| `storeModel.subscriptionPlan` (string enum) vs `subscriptionModel` (documento completo) | Dois modelos de truth para plano da loja | Ambos existem simultaneamente | Risco de inconsistência entre `store.subscriptionPlan` e `subscription.status` |
| `orderStatus` enum com casing misto | Documentos de fase descrevem status padronizados | `orderModel.js` L50: `'In Progress'` (capitalizado) vs `'completed'` (minúsculo) | Script `normalize-order-statuses.js` existe mas sua execução não é automatizada |
