# 🏗️ Fase 1 Concluída - Arquitetura Multi-Loja SaaS (Completa)

## ✅ Implementação Finalizada

Esta documentação descreve todas as mudanças implementadas na **Fase 1** completa do sistema POS Multi-Loja SaaS com sistema de roles dinâmicas e device approval com nickname.

---

## 📁 Novos Arquivos Criados

### Models (Mongoose Schemas)
| Arquivo | Descrição |
|---------|-----------|
| `models/roleModel.js` | **NOVO** - Sistema de roles dinâmicas com permissões granulares por módulo |
| `models/deviceModel.js` | **ATUALIZADO** - Adicionado campo `nickname` obrigatório |

### Controllers
| Arquivo | Descrição |
|---------|-----------|
| `controllers/roleController.js` | **NOVO** - CRUD completo de roles com validação de permissões |

### Middlewares
| Arquivo | Descrição |
|---------|-----------|
| `middlewares/checkPermission.js` | **NOVO** - Sistema de verificação de permissões dinâmicas |

### Utils
| Arquivo | Descrição |
|---------|-----------|
| `utils/deviceFingerprint.js` | **ATUALIZADO** - Fingerprint aprimorado com IP + Agent + Language + Timezone |

### Routes
| Arquivo | Descrição |
|---------|-----------|
| `routes/roleRoute.js` | **NOVO** - Rotas da API de roles |

---

## 🔑 Padrões de ID Implementados

### UUID v4 em Todos os Models

| Model | Campo UUID |
|-------|------------|
| Store | `storeId` |
| User | `userId` |
| Role | `roleId` |
| Device | `deviceId` |
| GlobalIngredient | `ingredientId` |
| SessionLog | `logId` |

```javascript
{
    type: String,
    default: uuidv4,
    unique: true,
    index: true,
    immutable: true
}
```

---

## 🔐 Sistema de Roles Dinâmicas

### Estrutura de Permissões

Cada role possui permissões granulares por módulo:

```javascript
permissions: {
    orders: {
        create: Boolean,
        read: Boolean,
        update: Boolean,
        delete: Boolean,
        cancel: Boolean
    },
    tables: { ... },
    products: { ... },
    inventory: {
        create: Boolean,
        read: Boolean,
        update: Boolean,
        delete: Boolean,
        adjust: Boolean,    // Ajuste de estoque
        transfer: Boolean   // Transferência entre lojas
    },
    payments: {
        create: Boolean,
        read: Boolean,
        refund: Boolean     // Estorno
    },
    users: {
        create: Boolean,
        read: Boolean,
        update: Boolean,
        delete: Boolean,
        manageRoles: Boolean  // Criar/editar roles
    },
    devices: {
        read: Boolean,
        approve: Boolean,
        revoke: Boolean
    },
    reports: {
        read: Boolean,
        export: Boolean,
        financial: Boolean
    },
    settings: {
        read: Boolean,
        update: Boolean
    }
}
```

### Roles Padrão do Sistema

| Role | Descrição | Permissões Principais |
|------|-----------|----------------------|
| **Admin** | Acesso total | Todos os módulos: full access |
| **Gerente** | Gerente da loja | Quase total, sem delete de usuários |
| **Caixa** | Operador de caixa | Orders, payments (leitura), products (leitura) |
| **Garçom** | Atendente de salão | Orders, tables (criar/ler/atualizar) |

### Uso do Middleware checkPermission

```javascript
// Verificar permissão única
router.post("/", checkPermission('orders', 'create'), createOrder);

// Verificar múltiplas permissões (qualquer uma)
router.get("/:id", checkPermission('products', ['read', 'update']), getProduct);

// Verificar todas as permissões necessárias
router.put("/:id", checkPermission('inventory', ['update', 'adjust'], { requireAll: true }), updateInventory);
```

---

## 🖥️ Device Approval com Nickname

### Fluxo Completo

```
1. Primeiro Acesso (qualquer rota protegida)
   ↓
   403 - DEVICE_NEEDS_NICKNAME
   ↓
2. POST /api/device/register
   { "nickname": "Meu Notebook" }
   ↓
   Device registrado com nickname
   ↓
3. Se Master Admin → Auto-aprovado
   Se usuário comum → Pendente de aprovação
   ↓
4. Próximo acesso:
   - Aprovado → 200 OK
   - Pendente → 403 DEVICE_PENDING_APPROVAL
```

### Fingerprint Aprimorado

Fatores utilizados para gerar o fingerprint único:

```javascript
const factors = [
    user-agent,           // Navegador + versão
    accept-language,      // Idioma do sistema
    accept-encoding,      // Codificação suportada
    sec-ch-ua-platform,   // Plataforma (Windows, macOS, etc.)
    sec-ch-ua,            // User-Agent Client Hint
    sec-ch-ua-mobile,     // Mobile flag
    IP address,           // IP do cliente
    timezone              // Fuso horário (se disponível)
];

// Hash SHA-256 concatenando todos os fatores
const fingerprint = crypto
    .createHash('sha256')
    .update(factors.join('|||'))
    .digest('hex');
```

### Validação de Nickname

```javascript
{
    nickname: {
        type: String,
        required: [true, 'Device nickname is required'],
        trim: true,
        maxlength: 50
    }
}
```

**Regras:**
- Mínimo 3 caracteres
- Máximo 50 caracteres
- Trim de espaços em branco
- Obrigatório antes da aprovação

---

## 🏪 Store Isolation Aprimorado

### Helpers para Queries Transparentes

```javascript
// Helper para filters Mongoose
const filter = applyStoreFilter(req, { status: 'active', category: 'food' });
const items = await Item.find(filter);

// Helper para aggregations
const pipeline = applyStoreToAggregation(req, [
    { $match: { status: 'active' } },
    { $group: { _id: '$category', total: { $sum: '$price' } } }
]);
```

### Injeção Automática de storeId

```javascript
// No middleware storeIsolation:

// Usuário comum
req.storeId = user.store.toString();  // Automático

// Master Admin
req.storeId = query.storeId || null;  // Filtra ou vê tudo
req.isMasterAdmin = true;  // Flag para controllers
```

---

## 📡 Novos Endpoints da API

### Roles
| Método | Endpoint | Descrição | Auth | Permissão |
|--------|----------|-----------|------|-----------|
| POST | `/api/role` | Criar role | ✅ | `users:manageRoles` |
| GET | `/api/role` | Listar roles | ✅ | - |
| GET | `/api/role/:id` | Detalhes da role | ✅ | - |
| PUT | `/api/role/:id` | Atualizar role | ✅ | `users:manageRoles` |
| PUT | `/api/role/:id/toggle-status` | Ativar/Desativar | ✅ | `users:manageRoles` |
| POST | `/api/role/:id/duplicate` | Duplicar role | ✅ | `users:manageRoles` |
| DELETE | `/api/role/:id` | Deletar role | ✅ | `users:manageRoles` |

### Devices
| Método | Endpoint | Descrição | Auth | Permissão |
|--------|----------|-----------|------|-----------|
| POST | `/api/device/register` | Registrar dispositivo | ✅ | - |
| POST | `/api/device/submit-nickname` | Submeter nickname | ✅ | - |
| GET | `/api/device` | Listar dispositivos | ✅ | `devices:read` |
| GET | `/api/device/pending` | Pendentes de aprovação | ✅ | `devices:read` |
| GET | `/api/device/my` | Meus dispositivos | ✅ | - |
| GET | `/api/device/stats` | Estatísticas | ✅ | `devices:read` |
| GET | `/api/device/:id` | Detalhes | ✅ | `devices:read` |
| POST | `/api/device/:id/approve` | Aprovar | ✅ | `devices:approve` |
| DELETE | `/api/device/:id` | Revogar | ✅ | `devices:revoke` |
| POST | `/api/device/:id/set-current` | Marcar como atual | ✅ | - |
| PUT | `/api/device/:id/nickname` | Atualizar nickname | ✅ | - |

---

## 🧪 Testando o Sistema

### 1. Testar Device Approval com Nickname

```bash
# Login
curl -X POST http://localhost:8000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@pos.com", "password": "user123"}'

# Tentar acessar rota protegida (vai falhar)
curl http://localhost:8000/api/user \
  -H "Cookie: accessToken=..."

# Resultado: 403 - DEVICE_NEEDS_NICKNAME

# Registrar dispositivo com nickname
curl -X POST http://localhost:8000/api/device/register \
  -H "Cookie: accessToken=..." \
  -H "Content-Type: application/json" \
  -d '{"nickname": "Meu Notebook Dell"}'

# Agora tentar acessar novamente (se for Master Admin → aprovado)
curl http://localhost:8000/api/user \
  -H "Cookie: accessToken=..."

# Se usuário comum → 403 PENDING_APPROVAL
# Admin aprova:
curl -X POST http://localhost:8000/api/device/:id/approve \
  -H "Cookie: accessToken=ADMIN_TOKEN"
```

### 2. Testar Sistema de Roles

```bash
# Criar nova role (apenas Admin ou Gerente)
curl -X POST http://localhost:8000/api/role \
  -H "Cookie: accessToken=ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Supervisor",
    "description": "Supervisor de turno",
    "permissions": {
      "orders": { "create": true, "read": true, "update": true, "cancel": true },
      "tables": { "read": true, "update": true },
      "products": { "read": true },
      "inventory": { "read": true },
      "payments": { "read": true },
      "users": { "read": true },
      "devices": { "read": true },
      "reports": { "read": true },
      "settings": { "read": true }
    }
  }'

# Listar roles
curl http://localhost:8000/api/role \
  -H "Cookie: accessToken=ADMIN_TOKEN"

# Testar permissão (usuário com role "Caixa" tentando criar produto)
curl -X POST http://localhost:8000/api/product \
  -H "Cookie: accessToken=CASHIER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Teste", "price": 100}'

# Resultado: 403 - Permission denied: products:create
```

---

## 📦 Dados Iniciais Atualizados (Seed)

O script `seed.js` agora cria:

1. **1 Loja** padrão
2. **1 Master Admin** (admin@pos.com / admin123)
3. **1 Usuário comum** (user@pos.com / user123)
4. **4 Roles do Sistema**:
   - Admin (acesso total)
   - Gerente (quase total)
   - Caixa (operacional)
   - Garçom (salão)
5. **42 Ingredientes Globais**

---

## ⚠️ Considerações Importantes

### 1. Migração de Roles Existentes

Se você já tem usuários com `role: String` (legado), o sistema ainda funciona:

```javascript
// userModel.methods.hasLegacyRole()
if (user.hasLegacyRole('Admin')) {
    // Funciona para roles string
}
```

### 2. Device Nickname é Obrigatório

```javascript
// No deviceModel.js
nickname: {
    type: String,
    required: [true, 'Device nickname is required'],
    // ...
}
```

Sem nickname, o dispositivo não pode ser aprovado.

### 3. Fingerprint é Sensível a Mudanças

O fingerprint usa múltiplos fatores. Mudar qualquer um destes cria um "novo" dispositivo:
- User-Agent (atualizar navegador)
- IP (mudar de rede)
- Accept-Language (mudar idioma do sistema)
- Timezone

### 4. Store Isolation é Transparente

Os controllers não precisam se preocupar com storeId:

```javascript
// Controller usa req.storeId injetado pelo middleware
const orders = await Order.find({ storeId: req.storeId, status: 'active' });
```

---

## 🔧 Comandos Úteis

```bash
# Instalar dependências
npm install

# Resetar banco e criar dados iniciais
npm run db:reset

# Migrar dados existentes
npm run db:migrate

# Iniciar servidor
npm run dev
```

---

## 📚 Arquivos de Documentação

| Arquivo | Descrição |
|---------|-----------|
| `README.md` | Guia principal do backend |
| `PHASE1_SUMMARY.md` | Resumo da Fase 1 (versão anterior) |
| `MIGRATION_GUIDE.md` | Guia de migração de dados |
| `PHASE1_FINAL_SUMMARY.md` | **Este arquivo** - Resumo final completo |

---

## 🚀 Próximos Passos (Fase 2)

- [ ] Product & Category Models (por loja)
- [ ] Recipe (Ficha Técnica) conectando produtos a ingredientes
- [ ] Inventory Service com baixa automática
- [ ] Stock Movement (entradas/saídas/transferências)
- [ ] Purchase Order com sugestão de compra inteligente
- [ ] WebSockets para atualizações em tempo real

---

*Implementado em: 2026-05-20*
*Status: ✅ Fase 1 Completa - Ready for Phase 2*
