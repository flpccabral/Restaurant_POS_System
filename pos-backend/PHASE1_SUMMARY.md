# 🏗️ Fase 1 Concluída - Arquitetura Multi-Loja SaaS

## ✅ Resumo da Implementação

Esta documentação descreve todas as mudanças implementadas na **Fase 1** da transformação do sistema POS single-tenant para uma plataforma SaaS multi-loja.

---

## 📁 Novos Arquivos Criados

### Models (Mongoose Schemas)
| Arquivo | Descrição |
|---------|-----------|
| `models/storeModel.js` | Schema de lojas com CNPJ, configurações e plano de assinatura |
| `models/globalIngredientModel.js` | Cadastro único de ingredientes com conversão de unidades |
| `models/deviceModel.js` | Controle de dispositivos com fingerprint e aprovação |
| `models/sessionLogModel.js` | Log de sessões e atividades dos usuários |

### Controllers
| Arquivo | Descrição |
|---------|-----------|
| `controllers/storeController.js` | CRUD de lojas |
| `controllers/deviceController.js` | Gestão de dispositivos (aprovar, revogar) |
| `controllers/globalIngredientController.js` | Gestão de ingredientes globais |

### Middlewares
| Arquivo | Descrição |
|---------|-----------|
| `middlewares/storeIsolation.js` | Isolamento de dados por loja (multi-tenancy) |
| `middlewares/deviceApproval.js` | Verificação e aprovação de dispositivos |

### Utils
| Arquivo | Descrição |
|---------|-----------|
| `utils/deviceFingerprint.js` | Geração de fingerprint SHA-256 para dispositivos |

### Routes
| Arquivo | Descrição |
|---------|-----------|
| `routes/storeRoute.js` | Rotas da API de lojas |
| `routes/deviceRoute.js` | Rotas da API de dispositivos |
| `routes/globalIngredientRoute.js` | Rotas da API de ingredientes |

### Scripts
| Arquivo | Descrição |
|---------|-----------|
| `scripts/migration-cleanup.js` | Limpa todo o banco de dados 🧹 |
| `scripts/seed.js` | Popula com dados iniciais (loja, admin, ingredientes) 🌱 |

---

## 🔧 Arquivos Modificados

### Models
- `models/userModel.js` - Adicionado: `storeId`, `isMasterAdmin`, `lastLoginAt`, `lastDevice`

### Controllers
- `controllers/userController.js` - Atualizado login para incluir `storeId` no token e registrar dispositivo

### Middlewares
- `middlewares/tokenVerification.js` - Agora popula `store` e injeta `storeId` no request

### Configuração
- `app.js` - Adicionado Socket.io e novas rotas
- `.env.example` - Adicionado `SOCKET_CORS_ORIGIN` e `NODE_ENV`
- `package.json` - Adicionadas dependências e scripts

---

## 🔑 Padrões de ID Implementados

### UUID v4
Todos os novos schemas utilizam UUID v4 para identificação:

```javascript
storeId: {
    type: String,
    default: uuidv4,
    unique: true,
    index: true,
    immutable: true
}
```

**Campos com UUID:**
- `Store.storeId`
- `User.userId`
- `Device.deviceId`
- `GlobalIngredient.ingredientId`
- `SessionLog.logId`

---

## 🔐 Segurança Implementada

### 1. Device Fingerprinting
```javascript
// Gera hash SHA-256 baseado em:
// - User-Agent
// - IP
// - Accept-Language
// - Accept-Encoding
// - Platform (sec-ch-ua-platform)
const fingerprint = generateDeviceFingerprint(req);
```

### 2. Device Approval Flow
```
1. Login → Dispositivo é registrado
2. Se isMasterAdmin = true → Auto-aprovado
3. Se usuário comum → Pendente de aprovação
4. Middleware deviceApproval bloqueia 403 se não aprovado
```

### 3. Store Isolation
```javascript
// Usuário comum:
req.storeId = user.store._id  // Automático

// Master Admin:
req.storeId = query.storeId || null  // Pode filtrar ou ver tudo
```

---

## 📊 Novos Endpoints da API

### Store
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/store` | Criar loja (Master Admin) |
| GET | `/api/store` | Listar lojas |
| GET | `/api/store/current` | Obter loja atual |
| GET | `/api/store/:id` | Detalhes da loja |
| PUT | `/api/store/:id` | Atualizar loja |
| PUT | `/api/store/:id/toggle-status` | Ativar/Desativar loja |

### Device
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/device` | Listar dispositivos |
| GET | `/api/device/pending` | Dispositivos pendentes |
| GET | `/api/device/:id` | Detalhes do dispositivo |
| POST | `/api/device/:id/approve` | Aprovar dispositivo |
| DELETE | `/api/device/:id` | Revogar acesso |
| POST | `/api/device/:id/set-current` | Marcar como atual |

### Global Ingredient
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/ingredient` | Criar ingrediente |
| GET | `/api/ingredient` | Listar ingredientes |
| GET | `/api/ingredient/:id` | Detalhes |
| PUT | `/api/ingredient/:id` | Atualizar |
| PUT | `/api/ingredient/:id/toggle-status` | Ativar/Desativar |
| DELETE | `/api/ingredient/:id` | Deletar |

---

## 🚀 Como Usar

### 1. Instalar Dependências
```bash
cd pos-backend
npm install
```

### 2. Configurar Variáveis de Ambiente
```bash
cp .env.example .env
# Edite .env com suas credenciais
```

### 3. Resetar Banco de Dados (Opcional)
```bash
npm run db:reset
```

### 4. Popular com Dados Iniciais
```bash
npm run db:seed
```

### 5. Iniciar Servidor
```bash
npm run dev
```

---

## 👤 Credenciais de Teste (após seed)

| Tipo | Email | Senha |
|------|-------|-------|
| Master Admin | `admin@pos.com` | `admin123` |
| Usuário Comum | `user@pos.com` | `user123` |

---

## 📝 Fluxo de Login com Device Approval

### Para Master Admin
```
1. POST /api/user/login { email, password }
2. Backend gera JWT com { _id, storeId, isMasterAdmin }
3. Backend registra dispositivo (auto-aprovado)
4. Retorna cookie + dados do usuário + device
```

### Para Usuário Comum
```
1. POST /api/user/login { email, password }
2. Backend gera JWT com { _id, storeId, isMasterAdmin: false }
3. Backend registra dispositivo (isApproved: false)
4. Retorna cookie + dados do usuário + device (pendente)
5. Próxima requisição → 403 Device not approved
6. Master Admin aprova: POST /api/device/:id/approve
7. Usuário pode acessar normalmente
```

---

## 🧪 Testando o Device Approval

### Cenário 1: Primeiro Acesso (Usuário Comum)
```bash
# Login
curl -X POST http://localhost:8000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@pos.com", "password": "user123"}'

# Tentar acessar rota protegida
curl http://localhost:8000/api/user \
  -H "Cookie: accessToken=..."

# Resultado esperado: 403 - Dispositivo pendente de aprovação
```

### Cenário 2: Aprovação pelo Admin
```bash
# Listar dispositivos pendentes
curl http://localhost:8000/api/device/pending \
  -H "Cookie: accessToken=ADMIN_TOKEN"

# Aprovar dispositivo
curl -X POST http://localhost:8000/api/device/:id/approve \
  -H "Cookie: accessToken=ADMIN_TOKEN"

# Usuário agora consegue acessar
curl http://localhost:8000/api/user \
  -H "Cookie: accessToken=USER_TOKEN"

# Resultado esperado: 200 - Sucesso
```

---

## 📦 Dados Iniciais (Seed)

### Loja
- **Nome:** Loja Demo - Matriz
- **CNPJ:** 00.000.000/0001-00
- **Plano:** enterprise

### Ingredientes Globais (42 itens)
- 5 Proteínas
- 6 Carboidratos
- 5 Vegetais
- 5 Laticínios
- 8 Temperos
- 6 Bebidas
- 4 Outros

Cada ingrediente inclui conversões automáticas (ex: kg → g, xícara → ml).

---

## ⚠️ Considerações Importantes

### 1. Índices de Banco de Dados
Todos os schemas incluem índices para performance:
```javascript
storeId: { type: ..., index: true }
{ storeId: 1, createdAt: -1 }  // Compound index
```

### 2. Campos Imutáveis
Campos como `storeId`, `userId`, etc. são imutáveis após criação:
```javascript
immutable: true  // Previne alteração acidental
```

### 3. Validação de Store no Registro
```javascript
// Non-admin users MUST provide valid storeId
if (!isMasterAdmin && !storeId) {
  throw Error("Store ID required");
}
```

### 4. Token JWT Estruturado
```javascript
{
  _id: "user_id",
  storeId: "store_id",
  isMasterAdmin: false,
  exp: timestamp
}
```

---

## 🔄 Próximos Passos (Fase 2)

A Fase 1 estabelece a base multi-tenant. Próximas implementações:

1. **Product & Category Models** - Por loja
2. **Recipe (Ficha Técnica)** - Conexão produto-ingrediente
3. **Inventory Service** - Controle de estoque por loja
4. **Stock Movement** - Entradas/saídas com baixa automática
5. **Purchase Order** - Sugestão de compra inteligente

---

*Implementado em: 2026-05-20*
*Status: ✅ Fase 1 Completa*
