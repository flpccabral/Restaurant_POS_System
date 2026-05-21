# 🚀 Quick Start Guide - POS Multi-Loja SaaS

## Pré-requisitos

- Node.js 18+ instalado
- MongoDB rodando (local ou Atlas)
- npm ou yarn

---

## 1. Instalação Rápida

```bash
cd pos-backend

# Instalar dependências
npm install

# Copiar arquivo de ambiente
cp .env.example .env

# Editar .env com suas credenciais MongoDB
nano .env  # ou use seu editor preferido
```

### .env Mínimo

```env
PORT=8000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/pos-saas
JWT_SECRET=seu-segredo-jwt-mude-isso
SOCKET_CORS_ORIGIN=http://localhost:5173
```

---

## 2. Popular Banco de Dados

```bash
# Resetar e criar dados do zero
npm run db:reset

# Ou apenas criar dados iniciais (se banco já existir)
npm run db:seed
```

### O que o seed cria:

| Item | Quantidade |
|------|------------|
| 📦 Loja | 1 (Loja Demo - Matriz) |
| 🔐 Roles | 4 (Admin, Gerente, Caixa, Garçom) |
| 👥 Usuários | 2 (admin + user) |
| 🧀 Ingredientes | 42 (globais) |

---

## 3. Iniciar Servidor

```bash
# Desenvolvimento (com auto-reload)
npm run dev

# Produção
npm start
```

Servidor rodará em `http://localhost:8000`

---

## 4. Testar API

### Login

```bash
curl -X POST http://localhost:8000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@pos.com", "password": "admin123"}'
```

Resposta inclui cookie `accessToken`.

### Listar Meus Dispositivos

```bash
curl http://localhost:8000/api/device/my \
  -H "Cookie: accessToken=SEU_TOKEN_AQUI"
```

### Registrar Dispositivo com Nickname

```bash
curl -X POST http://localhost:8000/api/device/register \
  -H "Cookie: accessToken=SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{"nickname": "Meu Notebook"}'
```

### Listar Roles

```bash
curl http://localhost:8000/api/role \
  -H "Cookie: accessToken=SEU_TOKEN_AQUI"
```

---

## 5. Credenciais de Teste

### Master Admin

| Campo | Valor |
|-------|-------|
| Email | `admin@pos.com` |
| Senha | `admin123` |
| Role | Admin (acesso total) |
| Loja | Loja Demo - Matriz |

**Permissões:** Todas as permissões em todos os módulos.

### Usuário Comum (Garçom)

| Campo | Valor |
|-------|-------|
| Email | `user@pos.com` |
| Senha | `user123` |
| Role | Garçom |
| Loja | Loja Demo - Matriz |

**Permissões:**
- ✅ Orders: criar, ler, atualizar
- ✅ Tables: ler, atualizar
- ✅ Products: ler
- ❌ Demais módulos: sem acesso

---

## 6. Fluxo de Device Approval

### Passo 1: Login

```bash
curl -X POST http://localhost:8000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@pos.com", "password": "user123"}'
```

Guarde o `accessToken` dos cookies.

### Passo 2: Tentar Acessar (Vai Falhar)

```bash
curl http://localhost:8000/api/user \
  -H "Cookie: accessToken=..."
```

**Resposta:** `403 - DEVICE_NEEDS_NICKNAME`

### Passo 3: Registrar Dispositivo

```bash
curl -X POST http://localhost:8000/api/device/register \
  -H "Cookie: accessToken=..." \
  -H "Content-Type: application/json" \
  -d '{"nickname": "Notebook Dell"}'
```

### Passo 4a: Se for Master Admin

✅ Acesso liberado automaticamente!

### Passo 4b: Se for Usuário Comum

❌ `403 - DEVICE_PENDING_APPROVAL`

Admin deve aprovar:

```bash
# Listar pendentes (como admin)
curl http://localhost:8000/api/device/pending \
  -H "Cookie: accessToken=ADMIN_TOKEN"

# Aprovar dispositivo
curl -X POST http://localhost:8000/api/device/:id/approve \
  -H "Cookie: accessToken=ADMIN_TOKEN"
```

### Passo 5: Acessar Novamente

```bash
curl http://localhost:8000/api/user \
  -H "Cookie: accessToken=..."
```

✅ `200 - Success!`

---

## 7. Testar Sistema de Roles

### Criar Nova Role (apenas Admin/Gerente)

```bash
curl -X POST http://localhost:8000/api/role \
  -H "Cookie: accessToken=ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Supervisor",
    "description": "Supervisor de turno",
    "permissions": {
      "orders": { "create": true, "read": true, "update": true },
      "tables": { "read": true, "update": true },
      "products": { "read": true },
      "inventory": { "read": true },
      "payments": { "read": true },
      "users": { "read": true },
      "devices": { "read": true },
      "reports": { "read": true }
    }
  }'
```

### Criar Usuário com Role Específica

```bash
curl -X POST http://localhost:8000/api/user/register \
  -H "Cookie: accessToken=ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Supervisor",
    "email": "joao@pos.com",
    "phone": "11999888777",
    "password": "senha123",
    "role": "Supervisor",
    "storeId": "ID_DA_LOJA"
  }'
```

### Testar Permissão

```bash
# Tentar criar produto como Garçom (não tem permissão)
curl -X POST http://localhost:8000/api/product \
  -H "Cookie: accessToken=USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Teste", "price": 100}'

# Resposta: 403 - Permission denied: products:create
```

---

## 8. Scripts Úteis

```bash
# Limpar banco (CUIDADO: remove tudo!)
npm run db:clean

# Migrar dados existentes para multi-tenant
npm run db:migrate

# Ver logs do MongoDB
mongosh
use pos-saas
db.users.find().pretty()
```

---

## 9. Estrutura de Diretórios

```
pos-backend/
├── config/              # DB e config
├── controllers/         # Lógica de negócio
│   ├── deviceController.js
│   ├── roleController.js
│   ├── storeController.js
│   ├── userController.js
│   └── ...
├── middlewares/         # Middlewares
│   ├── checkPermission.js    ← Roles dinâmicas
│   ├── deviceApproval.js     ← Device + Nickname
│   ├── storeIsolation.js     ← Multi-tenant
│   └── tokenVerification.js
├── models/              # Schemas
│   ├── deviceModel.js
│   ├── roleModel.js
│   ├── storeModel.js
│   └── userModel.js
├── routes/              # Rotas API
├── scripts/             # Scripts DB
│   ├── seed.js
│   ├── migrate-all.js
│   └── migration-cleanup.js
├── utils/               # Utilitários
│   └── deviceFingerprint.js
└── app.js               # Entry point
```

---

## 10. Endpoints Principais

### Autenticação
```
POST /api/user/login
POST /api/user/register
POST /api/user/logout
GET  /api/user
```

### Devices
```
POST /api/device/register
POST /api/device/submit-nickname
GET  /api/device/my
GET  /api/device/pending
POST /api/device/:id/approve
DELETE /api/device/:id
```

### Roles
```
POST /api/role
GET  /api/role
PUT  /api/role/:id
DELETE /api/role/:id
```

### Lojas
```
POST /api/store
GET  /api/store
GET  /api/store/current
PUT  /api/store/:id
```

---

## 11. Solução de Problemas

### Erro: "Device not approved"

1. Registre o dispositivo: `POST /api/device/register`
2. Se usuário comum, aguarde aprovação do admin
3. Admin aprova: `POST /api/device/:id/approve`

### Erro: "Permission denied"

Verifique se:
- Usuário tem role ativa
- Role possui permissão para o módulo/ação
- Master Admin tem acesso total

### Erro: "Store not found"

- Usuários comuns têm store automática
- Master Admin deve passar `?storeId=XXX` na query

### Erro: "Invalid Token"

- Token expirou (1 dia)
- Faça login novamente
- Verifique se `JWT_SECRET` no .env é o mesmo

---

## 12. Próximos Passos

1. ✅ Backend configurado e rodando
2. ⏳ Configurar frontend (pos-frontend)
3. ⏳ Implementar Products & Categories
4. ⏳ Implementar Inventory Service
5. ⏳ Configurar WebSockets

---

**Documentação Completa:** [PHASE1_FINAL_SUMMARY.md](./PHASE1_FINAL_SUMMARY.md)

*Atualizado em: 2026-05-20*
