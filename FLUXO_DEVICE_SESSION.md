# FLUXO DE DISPOSITIVOS E SESSÕES — FINGERPRINT, APROVAÇÃO E AUDITORIA

## VISÃO GERAL

Cada login cria uma sessão vinculada a um dispositivo (celular, tablet, desktop). O dispositivo é identificado por fingerprint e precisa ser aprovado pelo admin para acesso completo. Sessões são rastreadas em log de auditoria.

---

## 1. MODELOS

### 1.1 Device

```javascript
{
  _id, storeId,
  user: ObjectId,
  fingerprint: String,          // Hash SHA-256 único
  name: String,                 // "PDV Balcão"
  type: String,                 // desktop | tablet | mobile | kds
  platform: String,             // Windows | macOS | iOS | Android | Linux
  browser: String,              // Chrome | Safari | Firefox
  osVersion: String,
  browserVersion: String,
  ipAddress: String,
  lastIpAddress: String,
  isApproved: Boolean,          // Aprovado pelo admin?
  isCurrent: Boolean,           // Dispositivo da sessão atual
  approvedAt: Date,
  approvedBy: ObjectId,
  revokedAt: Date,
  revokedBy: ObjectId,
  revokeReason: String,
  lastUsedAt: Date,
  loginCount: Number,
  createdAt
}
```

### 1.2 SessionLog

```javascript
{
  _id, storeId, user,
  action: String,
  // Categorias:
  // auth: login, logout, login_failed, password_changed
  // device: device_approved, device_revoked, device_auto_blocked
  // admin: user_created, user_updated, user_deleted
  // cash: cash_open, cash_close, sangria, supply
  // order: order_cancelled, order_refunded
  // fiscal: nfce_issued, nfce_cancelled, nfce_contingency
  // stock: stock_adjusted, stock_transferred
  // security: permission_changed, role_changed, forced_logout

  details: String,              // Descrição textual do evento
  ipAddress: String,
  deviceFingerprint: String,
  userAgent: String,
  metadata: Object,             // Dados adicionais (ex: { orderId, reason })
  createdAt: Date
}
```

---

## 2. FINGERPRINT

### 2.1 Geração

```javascript
// No backend, no momento do login:
const fingerprint = crypto
  .createHash('sha256')
  .update([
    req.headers['user-agent'],
    req.headers['accept-language'],
    req.headers['sec-ch-ua-platform'],
    req.ip
  ].join('|'))
  .digest('hex');
```

### 2.2 Verificação

```
  LOGIN:
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  1. Gera fingerprint do request         │
  │  2. Busca Device por store+user+fp      │
  │                                         │
  │  Se ENCONTRAR:                          │
  │  │  Se isApproved: ✅ permitir login    │
  │  │  Se !isApproved: ✅ permitir (leitura)│
  │  │  Atualiza lastUsedAt, loginCount     │
  │  │  Seta isCurrent: true                │
  │                                         │
  │  Se NÃO ENCONTRAR:                      │
  │  │  Cria Device com isApproved: false   │
  │  │  ✅ Permitir login (leitura)          │
  │  │  Notifica admin:                     │
  │  │  "Novo dispositivo detectado:"       │
  │  │  "  Usuário: João (Garçom)"          │
  │  │  "  Dispositivo: Chrome no Windows"  │
  │  │  "  IP: 192.168.1.100"               │
  │  │  "  [Aprovar] [Ignorar]"             │
  └─────────────────────────────────────────┘
```

---

## 3. LIMITE DE DISPOSITIVOS

### 3.1 Verificação

```
  LOGIN (após autenticação):
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  1. Conta devices aprovados do user     │
  │     (excluindo o atual)                  │
  │  2. Se count >= user.deviceLimit:        │
  │     │  "Você atingiu o limite de N      │
  │     │   dispositivos."                  │
  │     │  Opções:                          │
  │     │  • Revogar dispositivo antigo     │
  │     │    (lista dos ativos)             │
  │     │  • Solicitar aumento de limite    │
  │     │    ao administrador               │
  │     └── Bloqueia login                  │
  │  3. Se count < limit: ✅ permitir       │
  └─────────────────────────────────────────┘
```

---

## 4. REGRAS DE SESSÃO

| # | Regra |
|---|-------|
| 1 | Dispositivo NÃO aprovado → acesso somente leitura |
| 2 | Admin notificado por WS sobre novo dispositivo |
| 3 | Dispositivo revogado → sessão atual invalidada |
| 4 | Exceder deviceLimit → bloqueia login (não mata sessão atual) |
| 5 | Toda ação importante registrada em SessionLog |
| 6 | SessionLog visível apenas para Admin |
| 7 | Log de login falho (credenciais inválidas) também registrado |
| 8 | Admin pode forçar logout de qualquer usuário |

---

## 5. ENDPOINTS

```javascript
// Dispositivos
GET    /api/devices?storeId=&user=&status=
POST   /api/devices/:id/approve
POST   /api/devices/:id/revoke
DELETE /api/devices/:id

// Session Logs
GET    /api/session-logs?storeId=&user=&action=&period=

// Admin
POST   /api/admin/force-logout/:userId
```
