# FLUXO DE USUÁRIOS E PERMISSÕES — RBAC, CARGOS, DISPOSITIVOS E GARÇONS

## VISÃO GERAL

O sistema POS usa RBAC (Role-Based Access Control) com dois níveis: cargos legados (string: "Admin", "Caixa", "Garçom") e permissões granulares via modelo Role. Cada usuário pertence a uma loja, tem um cargo e um conjunto de permissões que definem o que pode ver e fazer.

---

## 1. MODELOS DE DADOS

### 1.1 Usuário (User)

```javascript
{
  _id, store,
  name: String,
  email: String,               // Único por loja
  phone: String,
  password: String,             // bcrypt hash
  role: Mixed,                  // String (legado) OU ObjectId (Role model)
  rolePermissions: Object,      // { inventory: { read: true, adjust: false } }
  isMasterAdmin: Boolean,       // Bypass total de permissões
  isActive: Boolean,
  deviceLimit: Number,          // Máx. dispositivos simultâneos (ex: 2)
  config: {
    commissionRate: Number,     // % de comissão (garçons)
    station: String             // Estação KDS padrão
  },
  lastLoginAt: Date,
  createdAt, updatedAt
}
```

### 1.2 Cargo (Role)

```javascript
{
  _id, store,                   // null = global (qualquer loja)
  name: String,                 // "Gerente", "Caixa", "Cozinheiro"
  description: String,
  isActive: Boolean,
  permissions: {
    // Módulo: { ação: true/false }
    inventory: {
      read: Boolean,            // Ver estoque
      adjust: Boolean,          // Ajustar manualmente
      transfer: Boolean         // Transferir entre lojas
    },
    orders: {
      read: Boolean,
      create: Boolean,
      cancel: Boolean,
      updateStatus: Boolean
    },
    products: {
      read: Boolean,
      create: Boolean,
      update: Boolean,
      delete: Boolean
    },
    users: {
      read: Boolean,
      create: Boolean,
      update: Boolean,
      delete: Boolean
    },
    financial: {
      read: Boolean,
      closeCash: Boolean,
      refund: Boolean
    },
    kds: {
      read: Boolean,
      updateStatus: Boolean
    },
    reports: {
      read: Boolean,
      export: Boolean
    },
    settings: {
      read: Boolean,
      update: Boolean
    }
  }
}
```

### 1.3 Dispositivo (Device)

```javascript
{
  _id, storeId,
  user: ObjectId,
  fingerprint: String,          // Hash único do dispositivo
  name: String,                 // "PDV Balcão", "Tablet Garçom 1"
  type: String,                 // desktop | tablet | mobile | kds
  platform: String,             // Windows | macOS | iOS | Android
  browser: String,              // Chrome | Safari | Firefox
  ipAddress: String,
  isApproved: Boolean,
  isCurrent: Boolean,           // Dispositivo atual da sessão
  approvedAt: Date,
  approvedBy: ObjectId,
  lastUsedAt: Date,
  createdAt
}
```

### 1.4 Log de Sessão (SessionLog)

```javascript
{
  _id, storeId, user,
  action: String,               // login | logout | device_approved |
                                // device_revoked | password_changed |
                                // role_changed | user_created |
                                // cash_open | cash_close | sangria |
                                // supply | order_cancelled | nfce_issued
  details: String,              // Descrição textual
  ipAddress: String,
  deviceFingerprint: String,
  createdAt: Date
}
```

---

## 2. HIERARQUIA DE CARGOS

### 2.1 Cargos padrão

```
  ┌──────────────────────────────────────────────────────────────┐
  │                    MASTER ADMIN                              │
  │  (cross-tenant, acesso total a todas as lojas)               │
  └──────────────────────────────────────────────────────────────┘
                                 │
  ┌──────────────────────────────────────────────────────────────┐
  │                    ADMIN / GERENTE                           │
  │  (acesso total na própria loja)                              │
  │  Pode: criar/editar/excluir qualquer coisa                   │
  │  Pode: fechar caixa de qualquer operador                     │
  │  Pode: aprovar diferenças > R$ 50                            │
  └──────────────────────────────────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
  ┌──────┴──────┐       ┌───────┴───────┐       ┌───────┴──────┐
  │   CAIXA     │       │   GARÇOM      │       │  COZINHEIRO  │
  │             │       │               │       │              │
  │ Abre/fecha  │       │ Lança pedidos │       │ Vê KDS       │
  │   caixa     │       │ Fecha mesa    │       │ Atualiza     │
  │ Recebe      │       │ Vê suas       │       │   status     │
  │   pagamento │       │   comissões   │       │              │
  │ Sangria/    │       │               │       │              │
  │   suprimento│       │               │       │              │
  └─────────────┘       └───────────────┘       └──────────────┘
```

### 2.2 Matriz de permissões (padrão)

| Módulo | Ação | Admin | Caixa | Garçom | Cozinheiro |
|--------|------|:-----:|:-----:|:------:|:----------:|
| **Inventory** | read | ✅ | ✅ | ❌ | ❌ |
| | adjust | ✅ | ❌ | ❌ | ❌ |
| | transfer | ✅ | ❌ | ❌ | ❌ |
| **Orders** | read | ✅ | ✅ | ✅ | ✅ (KDS) |
| | create | ✅ | ✅ | ✅ | ❌ |
| | cancel | ✅ | ✅ | ❌ | ❌ |
| | updateStatus | ✅ | ✅ | ❌ | ✅ (KDS) |
| **Products** | read | ✅ | ✅ | ✅ | ✅ |
| | create/update | ✅ | ❌ | ❌ | ❌ |
| **Users** | read | ✅ | ❌ | ❌ | ❌ |
| | create/update | ✅ | ❌ | ❌ | ❌ |
| **Financial** | read | ✅ | ✅ | ❌ | ❌ |
| | closeCash | ✅ | ✅ | ❌ | ❌ |
| | refund | ✅ | ❌ | ❌ | ❌ |
| **KDS** | read | ✅ | ❌ | ❌ | ✅ |
| | updateStatus | ✅ | ❌ | ❌ | ✅ |
| **Reports** | read | ✅ | ❌ | ❌ | ❌ |
| | export | ✅ | ❌ | ❌ | ❌ |
| **Settings** | read/update | ✅ | ❌ | ❌ | ❌ |

---

## 3. FLUXO DE AUTENTICAÇÃO

### 3.1 Login

```
  USUÁRIO
       │
       ▼
  ┌─────────────────────────────────────┐
  │  POST /api/user/login               │
  │  Body: { email, password }          │
  └────────────────┬────────────────────┘
                   │
                   ▼
  ┌─────────────────────────────────────┐
  │  Backend:                           │
  │  1. Busca User por email            │
  │  2. Verifica bcrypt.compare()       │
  │  3. Verifica isActive               │
  │  4. Gera JWT com { userId, storeId, │
  │       role, isMasterAdmin }         │
  │  5. Cria/atualiza Device            │
  │     (fingerprint + isCurrent)        │
  │  6. SessionLog.create({ login })    │
  │  7. Seta cookie httpOnly:           │
  │     { sameSite: lax,                │
  │       secure: production,           │
  │       maxAge: 30 dias }             │
  │  8. Retorna { _id, name, email,    │
  │       phone, role, store,           │
  │       rolePermissions,              │
  │       isMasterAdmin }               │
  └─────────────────────────────────────┘
```

### 3.2 Verificação de sessão

```
  A CADA REQUISIÇÃO:
       │
       ▼
  ┌─────────────────────────────────────┐
  │  middleware tokenVerification.js    │
  │                                     │
  │  1. Lê cookie 'accessToken'         │
  │  2. Se não existe → 401             │
  │  3. Verifica JWT (jsonwebtoken)      │
  │  4. Se inválido/expirado → 401      │
  │  5. Popula req.user                 │
  └─────────────────────────────────────┘
```

### 3.3 Isolamento de loja

```
  APÓS AUTENTICAÇÃO:
       │
       ▼
  ┌─────────────────────────────────────┐
  │  middleware storeIsolation.js       │
  │                                     │
  │  1. Se req.user.isMasterAdmin:      │
  │     storeId = req.query.storeId     │
  │     ou body.storeId                 │
  │  2. Se não:                         │
  │     storeId = req.user.store        │
  │  3. Injeta req.storeId             │
  │  4. Adiciona filtro em queries      │
  └─────────────────────────────────────┘
```

### 3.4 Verificação de permissão

```
  APÓS ISOLAMENTO:
       │
       ▼
  ┌─────────────────────────────────────┐
  │  middleware checkPermission.js      │
  │  (module, action)                   │
  │                                     │
  │  1. Se isMasterAdmin → ✅ permitir  │
  │  2. Se role == "Admin" → ✅ (legado)│
  │  3. Busca rolePermissions do user   │
  │  4. Se permissions[module][action]  │
  │     == true → ✅ permitir           │
  │  5. Senão → 403 Forbidden           │
  └─────────────────────────────────────┘
```

---

## 4. DISPOSITIVOS

### 4.1 Device Fingerprinting

Todo login gera um hash do dispositivo baseado em:
- User agent
- Tela (resolução)
- Plugins do navegador
- Timezone
- Idioma

```javascript
// Geração do fingerprint
const fingerprint = crypto
  .createHash('sha256')
  .update(`${userAgent}|${screen}|${plugins}|${timezone}|${language}`)
  .digest('hex');
```

### 4.2 Fluxo de aprovação

```
  PRIMEIRO LOGIN EM DISPOSITIVO NOVO:
       │
       ▼
  ┌─────────────────────────────────────┐
  │  1. Backend detecta fingerprint     │
  │     novo (não encontrado)           │
  │  2. Cria Device com                 │
  │     isApproved: false               │
  │  3. Retorna status 200 + flag       │
  │     devicePendingApproval: true     │
  │  4. Login permitido (leitura)       │
  │  5. Notifica admin via WS:          │
  │     "Novo dispositivo: PDV 2        │
  │      - Chrome em Windows            │
  │      - IP: 192.168.1.50             │
  │      [Aprovar] [Revogar]"           │
  └─────────────────────────────────────┘
```

**Regras:**
- Dispositivo não aprovado → acesso apenas leitura
- Admin aprova/revoga na tela de dispositivos
- Dispositivo aprovado → acesso completo baseado no role
- Revogar dispositivo → invalida sessão ativa
- Máx. N dispositivos por usuário (configurável na Role)

---

## 5. GARÇOM — VÍNCULO E COMISSÃO

### 5.1 Vínculo garçom/mesa

```
  ABERTURA DE MESA (Tables.jsx):
       │
       ▼
  ┌─────────────────────────────────────┐
  │  1. Usuário logado (role='Garçom'   │
  │     ou superior)                     │
  │  2. Order.attendant = user._id      │
  │  3. TableCard exibe nome do garçom  │
  │  4. Todos os pedidos da mesa        │
  │     vinculados ao mesmo garçom      │
  └─────────────────────────────────────┘
```

### 5.2 Transferência de garçom

```
  MESA OCUPADA → clique "Transferir"
       │
       ▼
  ┌─────────────────────────────────────┐
  │  Modal:                             │
  │  "Transferir mesa para: [select     │
  │   de garçons disponíveis]"          │
  │                                     │
  │  Motivo: [opcional]                 │
  │                                     │
  │  ┌─ Confirmar ─┐  ┌─ Cancelar ─┐  │
  └─────────────────────────────────────┘
```

**Regras:**
- Apenas Admin/Caixa pode transferir
- Garçom só vê suas próprias mesas
- Transferência registrada no SessionLog
- Comissão original mantida (não migra para novo garçom)

### 5.3 Cálculo de comissão

```javascript
// User.config.commissionRate = 5 (5%)
commissionValue = totalSales * (commissionRate / 100)

// Exemplo:
// Garçom atendeu R$ 2.500,00 em vendas no dia
// CommissionRate = 5%
// Comissão = R$ 2.500,00 * 0,05 = R$ 125,00

// Relatório:
GET /api/attendant/:id/commission
?period=today
→ { totalSales: 2500, totalOrders: 15,
    commissionRate: 5, commissionValue: 125 }
```

---

## 6. REGRAS DE NEGÓCIO

| # | Regra |
|---|-------|
| 1 | MasterAdmin NÃO tem store vinculada (cross-tenant) |
| 2 | Garçom não abre/fecha caixa (apenas Admin/Caixa) |
| 3 | Dispositivo não aprovado = acesso somente leitura |
| 4 | Máximo de sessões simultâneas por usuário = deviceLimit |
| 5 | Exceder deviceLimit bloqueia novo login (mata sessão mais antiga) |
| 6 | Cozinheiro só acessa KDS (não vê valores financeiros) |
| 7 | Admin pode ver tudo na própria loja (exceto outras lojas) |
| 8 | Garçom vê comissões apenas próprias |
| 9 | Troca de senha registra SessionLog |
| 10 | Exclusão de usuário é soft-delete (isActive: false) |
| 11 | Role com permissões alteradas afeta usuários já logados apenas no próximo login |
| 12 | Admin pode forçar logout de qualquer usuário da loja |

---

## 7. ENDPOINTS

```javascript
// Autenticação
POST   /api/user/login
POST   /api/user/register
POST   /api/user/logout
GET    /api/user

// CRUD Usuários
GET    /api/users
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id

// Cargos (Roles)
GET    /api/roles
POST   /api/roles
PUT    /api/roles/:id
DELETE /api/roles/:id

// Dispositivos
GET    /api/devices?storeId=&user=
POST   /api/devices/:id/approve
POST   /api/devices/:id/revoke
DELETE /api/devices/:id

// Comissão
GET    /api/attendant/:id/commission?period=
GET    /api/attendant/commission-summary?storeId=&period=

// Logs
GET    /api/session-logs?storeId=&user=&action=&period=
```
