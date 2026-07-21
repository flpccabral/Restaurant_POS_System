---
name: pos-contrato-de-arquitetura
description: >-
  Use quando precisar entender por que o sistema foi construído dessa forma:
  por que multi-tenancy é via middleware e não banco separado, por que transações
  MongoDB são obrigatórias em estoque, por que JWT está em cookie e não localStorage,
  por que roles são documentos dinâmicos, por que auditoria é fire-and-forget.
  Carregue quando estiver tomando uma decisão que pode conflitar com decisões
  arquiteturais existentes, ou quando revisar código que parece desnecessariamente
  complexo — o motivo provavelmente está aqui.
---

# Contrato de Arquitetura — Restaurant POS System

## Quando usar

- Entender por que uma decisão de design foi feita
- Avaliar se uma mudança proposta viola invariantes do sistema
- Revisar código que usa sessões MongoDB, middleware de isolamento, RBAC ou auditoria
- Explicar o sistema para um novo desenvolvedor
- Decidir onde colocar nova lógica de negócio

## Quando não usar

- Procurar como executar um comando específico (→ `pos-execucao-e-operacao`)
- Depurar um erro específico (→ `pos-playbook-de-depuracao`)

---

## Visão geral

**Tipo:** Monólito Node.js/Express com multi-tenancy por middleware  
**Banco:** MongoDB Atlas (Replica Set obrigatório para transações)  
**ORM:** Mongoose  
**Autenticação:** JWT em cookie httpOnly  
**Autorização:** RBAC com roles dinâmicas (ObjectId) + legacy string  
**Tempo real:** Socket.io com rooms por `store:storeId`  
**Frontend:** React/Vite (pos-frontend) na porta 5173  
**Admin:** Next.js/TypeScript (pos-admin) na porta 5174  
**Backend:** Node.js/Express na porta 8000 (configurável via `PORT`)

---

## Invariantes arquiteturais (não violar sem ADR)

### INV-1: Toda operação de loja passa por `storeIsolation`

**Localização:** `pos-backend/middlewares/storeIsolation.js`

`storeIsolation` injeta `req.storeId` (string UUID) e `req.store` (ObjectId) na cadeia. Toda query de controller que acessa dados escopados por loja usa `req.storeId` — nunca lê direto de `req.user.store`.

Helpers disponíveis pós-middleware:
```javascript
const { getStoreFilter, applyStoreToAggregation } = require('../middlewares/storeIsolation');
// getStoreFilter(req) → { store: ObjectId }
// applyStoreToAggregation(pipeline, req) → pipeline com $match de store
```

**Exceção documentada:** Master Admin pode passar `?storeId=<uuid>` para inspecionar outra loja. O middleware valida o UUID antes de aceitar.

**Lacuna conhecida (verificado 2026-07-20):** `pdvRoutes.js` não inclui `storeIsolation` — bug de segurança ativo (P0-03 no roadmap).

### INV-2: Operações de estoque são atômicas ou não acontecem

**Localização:** `pos-backend/services/orderCheckoutService.js`, `stockReversalService.js`, `transferService.js`, `productionService.js`

Qualquer operação que deduze, transfere, reverte ou ajusta saldo de estoque usa `mongoose.startSession()` + `startTransaction()`. A sessão é criada no controller e passada para o service — não dentro do service — para permitir composição de operações.

Política de erros bifurcada:
- **Hard error:** item sem saldo suficiente (quando política for `strict`), localização de estoque da loja ausente → aborta transação → Order não atualizado
- **Soft error:** produto sem receita mapeada, variação sem ingrediente definido → prossegue com flag de aviso → `stockDeductionReason` preenchido no OrderItem

### INV-3: JWT vive em cookie httpOnly

**Localização:** `pos-backend/controllers/userController.js` (emissão), `pos-backend/middlewares/tokenVerification.js` (verificação)

```javascript
// Emissão (userController.js ~L141)
res.cookie('accessToken', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000  // 30 dias
});
```

JWT `expiresIn: '1d'` — o token expira em 1 dia, o cookie persiste por 30 dias. Cliente recebe 401 após 1 dia sem refresh. Endpoint de refresh token não implementado (lacuna conhecida).

`tokenVerification.js` aceita token tanto do cookie quanto do header `Authorization: Bearer <token>` — para suporte a clientes mobile/PDV.

### INV-4: Roles são documentos dinâmicos com permissões por módulo

**Localização:** `pos-backend/models/roleModel.js`, `pos-backend/middlewares/checkPermission.js`

Cada Role tem:
- `name` e `description`
- `permissions`: objeto com módulos (`orders`, `tables`, `products`, `inventory`, `payments`, `users`, `devices`, `reports`, `kds`, `production`, `subscription`) — cada módulo tem flags `create`, `read`, `update`, `delete`
- `customPermissions`: array para permissões adicionais fora do schema fixo
- Métodos: `hasPermission(module, action)`, `hasAnyPermission(checks)`

**Estado transitório:** `userModel.role` é `Mixed` (ObjectId ou String). Suporte a String existe para compatibilidade com usuários criados antes do sistema de roles dinâmicas. A migração P2-01 normalizará todos para ObjectId.

### INV-5: Auditoria não bloqueia operação

**Localização:** `pos-backend/services/auditService.js`

```javascript
const logAudit = async (params) => {
  try {
    return await OperationalAuditLog.create(params);
  } catch (error) {
    console.error('[AuditService] Failed to log audit entry:', error.message);
    return null;  // Nunca propaga o erro
  }
};
```

Em um restaurante em funcionamento, uma falha de auditoria NUNCA deve impedir uma venda ou transferência de estoque.

---

## Componentes e responsabilidades

| Componente | Responsabilidade | Não deve |
|---|---|---|
| `middlewares/storeIsolation.js` | Injetar `req.storeId` e `req.store`; validar escopo de loja | Fazer lógica de negócio |
| `middlewares/checkPermission.js` | Verificar permissão granular por módulo/ação | Executar a ação |
| `middlewares/tokenVerification.js` | Extrair e verificar JWT | Buscar dados do usuário além do ID |
| `middlewares/deviceApproval.js` | Verificar se o dispositivo está aprovado para a loja | Aprovar dispositivos |
| `services/orderCheckoutService.js` | Baixa de estoque transacional com política hard/soft | Criar Orders |
| `services/stockReversalService.js` | Reverter movimentos de estoque com MongoDB session | Criar novos pedidos |
| `services/auditService.js` | Registrar ações operacionais de forma não bloqueante | Lançar exceções |
| `services/websocketService.js` | Emitir eventos Socket.io para rooms de loja | Fazer lógica de negócio |
| `controllers/` | Orquestrar services, responder HTTP | Conter regras de negócio complexas |

---

## Topologia de dados

```
Store (entidade raiz)
  ├── User (role → Role)
  ├── Device (vinculado ao usuário)
  ├── Table
  ├── Order → OrderItem
  │     └── StockMovement (via orderCheckoutService)
  ├── StockLocation → StockBalance → StockMovement
  ├── Product → Recipe → RecipeIngredient → Ingredient
  ├── CashSession → Payment
  ├── ProductionBatch
  ├── PurchaseOrder → Supplier
  ├── KdsOrder (espelho de Order para KDS)
  ├── StockPolicy → StockAlert
  └── Subscription → Plan

GlobalIngredient (compartilhado entre stores)
Role (compartilhado entre stores)
Plan (compartilhado entre stores)
```

---

## Fluxo de um pedido completo

```
1. POST /api/order              → cria Order (status: pending)
2.                              → syncOrderToKds() fire-and-forget
3.                              → io.emit('order:created', storeId)
4. KDS exibe o pedido
5. Cozinha confirma preparo
6. POST /api/order/:id/process-stock-deduction
7.                              → startSession()
8.                              → orderCheckoutService: deduz estoque por receita
9.                              → commitTransaction()
10. POST /api/pdv/payment       → cria Payment + fecha mesa + sessão de caixa
```

---

## O que está fora do escopo arquitetural atual

| Item | Estado |
|---|---|
| Stripe / billing real | Campos no schema (`stripeSubscriptionId`), sem integração de código |
| Gateway de pagamento BR | Razorpay/INR implementado; incompatível com operação BR real |
| Socket.io com autenticação de handshake | Sem autenticação (P0-04 pendente) |
| Refresh token | Sem implementação (cookie 30d, JWT 1d) |
| iFood Scraper (`ifood-scraper/`) | Módulo independente, não integrado ao app principal |
| TypeScript no pos-frontend | Admin usa TS; frontend usa JS |

---

## Skills relacionadas

- `pos-controle-de-mudancas` — regras operacionais de como implementar mudanças
- `pos-seguranca` — detalhes de autenticação, autorização e ameaças
- `pos-estoque-e-checkout` — como funciona o checkout transacional em detalhe
- `pos-dados-e-modelos` — schemas, índices e convenções dos models

## Proveniência e manutenção

- Verificado em: 2026-07-20
- Fontes primárias:
  - `pos-backend/middlewares/storeIsolation.js`
  - `pos-backend/middlewares/checkPermission.js`
  - `pos-backend/services/orderCheckoutService.js`
  - `pos-backend/models/roleModel.js`
  - `pos-backend/models/userModel.js`
  - `pos-backend/app.js`
  - `pos-backend/docs/adr/` (ADR-0001 a ADR-0005)
- Comandos de reverificação:
  - `wc -l pos-backend/services/orderCheckoutService.js`
  - `grep -n "startSession\|startTransaction" pos-backend/services/*.js`
  - `node -e "const r = require('./pos-backend/models/roleModel.js'); console.log(r.schema.paths.permissions ? 'OK' : 'MISSING')"`
- Condições que exigem revisão:
  - Adição de novo grupo de rotas em `app.js`
  - Alteração na assinatura de `storeIsolation.js` ou `checkPermission.js`
  - Conclusão da migração P2-01 (remover suporte a role string)
  - Adição de integração Stripe ou gateway BR
