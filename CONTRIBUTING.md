# Guia de Contribuição — Restaurant POS System

Este documento orienta qualquer desenvolvedor competente em Node.js a preparar o ambiente, entender a arquitetura, implementar mudanças com segurança e validar alterações antes de submeter.

---

## Primeiros 15 Minutos

### Pré-requisitos

| Ferramenta | Versão mínima | Verificação |
|---|---|---|
| Node.js | 18 LTS | `node --version` |
| npm | 9+ | `npm --version` |
| MongoDB | Atlas (RS) ou local ≥ 6.0 | `mongosh --version` |
| Git | qualquer | `git --version` |

> **Atenção:** Transações MongoDB (`startSession`) requerem Replica Set. Em desenvolvimento local, use `mongod --replSet rs0` ou MongoDB Atlas (camada M0 gratuita já inclui RS).

### Clone e Setup

```bash
# 1. Clone o repositório
git clone https://github.com/<seu-fork>/Restaurant_POS_System.git
cd Restaurant_POS_System

# 2. Backend — instalar dependências
cd pos-backend
npm install

# 3. Copiar e preencher variáveis de ambiente (NUNCA commitar .env real)
cp .env.example .env
# Editar .env com suas credenciais (ver tabela de variáveis abaixo)

# 4. Popular banco de dados com dados iniciais
npm run db:seed

# 5. Executar testes automatizados
npm test

# 6. Iniciar servidor de desenvolvimento (auto-reload)
npm run dev
# → http://localhost:8000

# 7. Validar que o servidor está rodando
curl http://localhost:8000/
# Esperado: {"message":"Hello from POS Server!"}

# 8. Testar login
curl -X POST http://localhost:8000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pos.com","password":"admin123"}'
# Esperado: 200 OK com cookie accessToken
```

### Frontend POS (pos-frontend)

```bash
cd pos-frontend
npm install
cp .env.example .env  # se existir
npm run dev
# → http://localhost:5173
```

### Painel Admin (pos-admin)

```bash
cd pos-admin
npm install
cp .env.example .env  # se existir
npm run dev
# → http://localhost:5174
```

---

## Referência de Variáveis de Ambiente (pos-backend)

| Variável | Obrigatória | Padrão | Valores válidos | Arquivo onde é lida | Finalidade | Sensível |
|---|:---:|---|---|---|---|:---:|
| `PORT` | Não | `3000` | Número inteiro 1024–65535 | `config/config.js` | Porta HTTP do servidor | Não |
| `NODE_ENV` | Não | `development` | `development`, `production`, `test` | `config/config.js`, `app.js` | Controla modo de execução, segurança de cookie, stack em erros | Não |
| `MONGODB_URI` | **Sim** | `mongodb://localhost:27017/pos-db` | String URI MongoDB válida | `config/config.js` | Conexão com o banco de dados | **Sim** |
| `JWT_SECRET` | **Sim** | `test-secret-key-for-jwt` | String aleatória ≥ 32 bytes | `config/config.js` | Assinar e verificar tokens JWT | **Sim** |
| `RAZORPAY_KEY_ID` | Não | — | String fornecida pelo Razorpay | `config/config.js` | Autenticação com a API Razorpay | **Sim** |
| `RAZORPAY_KEY_SECRET` | Não | — | String fornecida pelo Razorpay | `config/config.js` | Autenticação com a API Razorpay | **Sim** |
| `RAZORPAY_WEBHOOK_SECRET` | Não | — | String fornecida pelo Razorpay | `config/config.js` | Validar assinatura HMAC do webhook | **Sim** |
| `CORS_ORIGINS` | Não | `http://localhost:5173,http://localhost:5174,http://localhost:3000` | Lista de origens separadas por vírgula | `config/config.js` | Origens permitidas pelo CORS | Não |
| `TZ` | Não | `America/Sao_Paulo` | Timezone IANA | `config/config.js` | Fixar fuso horário do processo Node | Não |

> **`SOCKET_CORS_ORIGIN`** aparece no `.env.example` mas **não é lida pelo código** — o backend usa `CORS_ORIGINS` para ambos HTTP e Socket.io. Esta variável pode ser removida com segurança do `.env`.

> Gere um JWT_SECRET seguro com: `openssl rand -hex 32`

---

## Tour da Arquitetura

```
pos-backend/
├── app.js                  # Ponto de entrada: Express + Socket.io + rotas
├── config/
│   ├── config.js           # Lê variáveis de ambiente e exporta configuração imutável
│   └── database.js         # Conecta ao MongoDB via Mongoose
├── middlewares/
│   ├── tokenVerification.js  # Extrai e valida JWT do cookie/Authorization
│   ├── storeIsolation.js     # Injeta req.storeId — NÚCLEO do multi-tenancy (ADR-0001)
│   ├── checkPermission.js    # Verifica permissões por módulo/ação (ADR-0004)
│   ├── deviceApproval.js     # Verifica se o dispositivo do usuário está aprovado
│   └── globalErrorHandler.js # Converte erros em respostas JSON padronizadas
├── models/                 # Schemas Mongoose (28 models)
│   ├── userModel.js          # Usuário — campo role: Mixed (transitório, ver ADR-0004)
│   ├── storeModel.js         # Loja — entidade raiz do multi-tenancy
│   ├── roleModel.js          # Role dinâmica com permissões por módulo
│   ├── orderModel.js         # Pedido (mesa, status, items, COGS)
│   ├── stockMovementModel.js # Movimento de estoque (deduction, transfer, purchase...)
│   ├── stockBalanceModel.js  # Saldo atual por ingrediente/localização
│   └── ...
├── controllers/            # Lógica de negócio, orquestração de services
├── services/
│   ├── orderCheckoutService.js # Baixa de estoque transacional (ADR-0002) — 649 linhas
│   ├── stockReversalService.js # Reversão de movimentos de estoque
│   ├── auditService.js         # Registro de auditoria fire-and-forget (ADR-0005)
│   └── websocketService.js     # Helpers para emitir eventos Socket.io
├── routes/                 # 23 arquivos de rota — um por domínio
├── scripts/                # Scripts operacionais (seed, migrate, test manual)
│   ├── seed.js             # Popular banco com dados iniciais
│   ├── migrate-all.js      # Executar todas as migrações
│   └── pilot-seed.js       # Dados para piloto controlado (5 lojas PILOT_*)
├── tests/                  # Testes Jest (apenas phase8-pdv-models.test.js existe)
├── docs/
│   ├── adr/                # Architecture Decision Records (ADR-0001 a ADR-0005)
│   └── runbook.md          # Operação, diagnóstico, backup e resposta a incidentes
└── ifood-scraper/          # Módulo independente (não integrado ao app principal)
```

### Cadeia de middlewares para rotas protegidas

```
Request
  → isVerifiedUser         (tokenVerification.js) — valida JWT
  → storeIsolation         (storeIsolation.js)    — injeta req.storeId
  → checkPermission(m, a)  (checkPermission.js)   — verifica permissão
  → Controller
```

> **Atenção:** `pdvRoutes.js` usa `checkRole` em vez de `storeIsolation`. Isso é uma lacuna de segurança conhecida — ver ADR-0001 e P0-03 no roadmap.

---

## Fluxos Principais

### 1. Inicialização do servidor

```
app.js
  → config.js (lê .env)
  → database.js (connectDB → mongoose.connect)
  → Registro de middlewares CORS, json, cookieParser
  → Registro de 23 grupos de rotas
  → globalErrorHandler
  → server.listen(PORT) [apenas se NODE_ENV !== 'test']
```

### 2. Criar um pedido (escrita principal)

```
POST /api/order
  → isVerifiedUser → storeIsolation → checkPermission('orders','create')
  → orderController.addOrder
      → Order.create()
      → syncOrderToKds() [fire-and-forget]
      → io.to(store:storeId).emit('order:created')
  → 201 Created

POST /api/order/:id/process-stock-deduction  [chamada posterior]
  → isVerifiedUser → storeIsolation
  → orderController.processOrderStockDeduction
      → mongoose.startSession()
      → orderCheckoutService.processOrderStockDeduction({session})
          → StockMovement.createMovement() por ingrediente
      → session.commit() ou session.abort()
```

### 3. Processamento de pagamento (PDV)

```
POST /api/pdv/payment
  → isVerifiedUser → checkRole(['cashier','manager','admin'])
  → pdvController.processPayment
      → mongoose.startSession()
          → Payment.create()
          → Order.findByIdAndUpdate (status)
          → Table.findByIdAndUpdate (status)
          → orderCheckoutService.processOrderStockDeduction({session})
      → session.commit()
      → io.to(store:storeId).emit('order:paid')
```

### 4. Tratamento de erro

Todos os erros de negócio são criados com `http-errors`:
```javascript
throw createHttpError(404, "Order not found");
// Capturado pelo globalErrorHandler → { success: false, message: "..." }
```

Erros de Mongoose (validação, casting) são detectados pelo `globalErrorHandler` e formatados consistentemente.

---

## Como Implementar Mudanças Comuns

### Novo endpoint REST

1. **Criar ou adicionar ao controller**: `controllers/<dominio>Controller.js`
2. **Registrar a rota**: `routes/<dominio>Route.js` com a cadeia correta de middlewares
3. **Registrar em `app.js`**: `app.use("/api/<dominio>", require("./routes/<dominio>Route"))`
4. **Adicionar ao modelo se necessário**: `models/<dominio>Model.js`
5. **Testes obrigatórios**: `tests/<dominio>.test.js` cobrindo sucesso, erro 401, erro 403 e 404
6. **Verificar isolamento**: Se a rota acessa dados de loja, incluir `storeIsolation` na cadeia — ver ADR-0001

Contrato a preservar:
- Respostas de sucesso: `{ success: true, data: ... }`
- Respostas de erro: `{ success: false, message: "..." }`
- Rotas autenticadas: sempre iniciam com `isVerifiedUser`

Riscos comuns:
- Esquecer `storeIsolation` em rotas que acessam dados de loja
- Usar `Model.find()` sem filtro de store
- Não verificar `req.user.isMasterAdmin` antes de operações globais

### Nova entidade (model)

1. Criar `models/<Nome>Model.js` com UUID via `uuidv4` como campo ID legível, `{ timestamps: true }` e índices compostos relevantes
2. Incluir campo `store: { type: ObjectId, ref: 'Store', required: true, index: true }` se a entidade é escopada por loja
3. Criar controller e rotas conforme item anterior
4. Criar script de seed em `scripts/seed-<nome>.js` se necessário

### Nova operação de estoque

1. Verificar se `stockMovementModel.js` já contém o `type` necessário no enum
2. Se não, adicionar ao enum e criar um script de migração para dados existentes
3. Implementar a operação em `services/` usando MongoDB session (ADR-0002)
4. Registrar via `auditService.logAudit()` ao final da operação (ADR-0005)
5. Emitir evento WebSocket se a operação deve notificar clientes conectados

### Nova migração de dados

1. Criar `scripts/migrate-<descricao>.js` com suporte a `--dry-run`
2. Testar com `--dry-run` antes de executar em produção
3. Documentar em `docs/runbook.md` na seção de Migração

### Novo teste

1. Criar `tests/<descricao>.test.js`
2. Usar `mongodb-memory-server` — nunca conectar ao banco real em testes
3. Importar `{ app }` de `../app.js` e usar `supertest` para requisições HTTP
4. Usar a função `generateToken()` de `tests/setup.js` para autenticar
5. Executar com `npm test` antes de abrir PR

---

## Convenções

### Nomenclatura

| Elemento | Convenção | Exemplo |
|---|---|---|
| Arquivos de model | camelCase + "Model" | `orderModel.js` |
| Arquivos de controller | camelCase + "Controller" | `orderController.js` |
| Arquivos de rota | camelCase + "Route/Routes" | `orderRoute.js`, `pdvRoutes.js` |
| Arquivos de service | camelCase + "Service" | `auditService.js` |
| Variáveis de ambiente | SCREAMING_SNAKE_CASE | `MONGODB_URI` |
| Campos de model | camelCase | `storeId`, `createdAt` |
| Enums | camelCase ou snake_case consistente | `'in_progress'`, `'stockout'` |

### Tratamento de erros

- Erros de negócio: `throw createHttpError(statusCode, "mensagem")` — capturado pelo `globalErrorHandler`
- Erros de operação assíncrona: sempre envoltos em `try/catch` com `next(error)`
- Erros em operações fire-and-forget (audit, websocket): capturados localmente com `console.error`, nunca relançados

### Commits

Seguir o padrão: `<tipo>: <descrição concisa>`

| Tipo | Quando usar |
|---|---|
| `feat:` | Nova funcionalidade |
| `fix:` | Correção de bug |
| `security:` | Correção de segurança |
| `refactor:` | Refatoração sem mudança de comportamento |
| `test:` | Adição ou correção de testes |
| `docs:` | Documentação |
| `chore:` | Scripts, deps, configuração |
| `migration:` | Scripts de migração de dados |

### Branches

- `main` — produção estável
- `dev` — integração de features
- `feature/<descricao>` — nova funcionalidade
- `fix/<descricao>` — correção de bug
- `security/<descricao>` — correção de segurança (PR diretamente para main)

---

## Scripts Disponíveis (pos-backend)

```bash
npm run dev                        # Servidor com auto-reload (nodemon)
npm start                          # Servidor de produção
npm test                           # Todos os testes com cobertura
npm run test:watch                 # Testes em modo watch

npm run db:seed                    # Popular banco com dados iniciais
npm run db:clean                   # Limpar banco (CUIDADO: remove tudo)
npm run db:reset                   # db:clean + db:seed
npm run db:migrate                 # Executar todas as migrações

# Migrações específicas
npm run db:migrate:store-isolation:dry   # Simular migração de isolamento de loja
npm run db:migrate:store-isolation       # Executar migração de isolamento de loja
```
