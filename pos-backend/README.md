# 🍽️ Restaurant POS System - Backend

Backend do sistema PDV Multi-Loja (SaaS) construído com **Node.js**, **Express** e **MongoDB**.

## 🚀 Features da Fase 1

- ✅ **Multi-tenancy** com isolamento por loja (`storeId`)
- ✅ **Device Approval** com fingerprint SHA-256
- ✅ **UUID v4** para identificação
- ✅ **Socket.io** para atualizações em tempo real
- ✅ **Master Admin** com acesso global
- ✅ **Ingredientes Globais** com conversão de unidades

---

## 📁 Estrutura do Projeto

```
pos-backend/
├── config/              # Configurações de DB e ambiente
├── controllers/         # Lógica de negócio
│   ├── deviceController.js
│   ├── globalIngredientController.js
│   ├── storeController.js
│   └── userController.js
├── middlewares/         # Middlewares personalizados
│   ├── deviceApproval.js
│   ├── storeIsolation.js
│   └── tokenVerification.js
├── models/              # Schemas Mongoose
│   ├── deviceModel.js
│   ├── globalIngredientModel.js
│   ├── sessionLogModel.js
│   ├── storeModel.js
│   └── userModel.js
├── routes/              # Rotas da API
│   ├── deviceRoute.js
│   ├── globalIngredientRoute.js
│   ├── storeRoute.js
│   └── userRoute.js
├── scripts/             # Scripts de DB
│   ├── migrate-all.js
│   ├── migration-cleanup.js
│   └── seed.js
├── utils/               # Utilitários
│   └── deviceFingerprint.js
├── app.js               # Entry point
└── package.json
```

---

## 🛠️ Instalação

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

```bash
cp .env.example .env
```

Edite `.env`:

```env
PORT=8000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/pos-saas

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this

# Razorpay (opcional)
RAZORPAY_KEY_ID=your-key-id
RAZORPAY_KEY_SECRET=your-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret

# Socket.io
SOCKET_CORS_ORIGIN=http://localhost:5173
```

### 3. Popular Banco de Dados (Opcional)

```bash
# Limpar e criar dados do zero
npm run db:reset

# Ou apenas criar dados iniciais
npm run db:seed
```

### 4. Iniciar Servidor

```bash
# Desenvolvimento (com nodemon)
npm run dev

# Produção
npm start
```

---

## 👤 Credenciais de Teste

Após rodar `npm run db:seed`:

| Tipo | Email | Senha | Permissões |
|------|-------|-------|------------|
| Master Admin | `admin@pos.com` | `admin123` | Acesso total |
| Usuário | `user@pos.com` | `user123` | Acesso à loja |

---

## 📡 API Endpoints

### Autenticação

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/user/register` | Criar usuário |
| POST | `/api/user/login` | Login |
| POST | `/api/user/logout` | Logout |
| GET | `/api/user` | Dados do usuário |

### Lojas (Store)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/store` | Criar loja |
| GET | `/api/store` | Listar lojas |
| GET | `/api/store/current` | Loja atual |
| GET | `/api/store/:id` | Detalhes da loja |
| PUT | `/api/store/:id` | Atualizar loja |

### Dispositivos (Device)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/device` | Listar dispositivos |
| GET | `/api/device/pending` | Pendentes de aprovação |
| POST | `/api/device/:id/approve` | Aprovar dispositivo |
| DELETE | `/api/device/:id` | Revogar acesso |

### Ingredientes Globais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/ingredient` | Criar ingrediente |
| GET | `/api/ingredient` | Listar ingredientes |
| PUT | `/api/ingredient/:id` | Atualizar |
| DELETE | `/api/ingredient/:id` | Deletar |

---

## 🔐 Fluxo de Device Approval

### 1. Login Registra Dispositivo

```bash
curl -X POST http://localhost:8000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@pos.com", "password": "user123"}'
```

### 2. Primeira Requisição Bloqueia (403)

```bash
curl http://localhost:8000/api/user \
  -H "Cookie: accessToken=..."

# 403 - Dispositivo pendente de aprovação
```

### 3. Admin Aprova

```bash
# Listar pendentes
curl http://localhost:8000/api/device/pending \
  -H "Cookie: accessToken=ADMIN_TOKEN"

# Aprovar
curl -X POST http://localhost:8000/api/device/:id/approve \
  -H "Cookie: accessToken=ADMIN_TOKEN"
```

### 4. Usuário Acessa Normalmente

```bash
curl http://localhost:8000/api/user \
  -H "Cookie: accessToken=USER_TOKEN"

# 200 - Sucesso!
```

---

## 🧪 Scripts de Database

### Limpar Banco

```bash
npm run db:clean
# ⚠️ Remove TODAS as coleções!
```

### Criar Dados Iniciais

```bash
npm run db:seed
# Cria: 1 loja, 2 usuários, 42 ingredientes
```

### Resetar Completo

```bash
npm run db:reset
# Limpa + Seed
```

### Migrar Dados Existentes

```bash
npm run db:migrate
# Migra dados single-tenant para multi-tenant
```

---

## 📦 Novos Models

### Store

```javascript
{
  storeId: UUID,
  name: String,
  cnpj: String (unique),
  email: String,
  phone: String,
  address: Object,
  isActive: Boolean,
  subscriptionPlan: 'basic' | 'pro' | 'enterprise',
  settings: { taxRate, currency, timezone }
}
```

### Device

```javascript
{
  deviceId: UUID,
  fingerprint: String (SHA-256 hash),
  user: ObjectId,
  store: ObjectId,
  deviceInfo: { browser, os, device, ip },
  isApproved: Boolean,
  isCurrent: Boolean,
  lastActiveAt: Date
}
```

### GlobalIngredient

```javascript
{
  ingredientId: UUID,
  name: String (unique),
  category: 'proteina' | 'carboidrato' | ...,
  baseUnit: 'g' | 'kg' | 'ml' | 'L' | 'unidade',
  conversionToBase: Map,
  averageCost: Number,
  isActive: Boolean
}
```

---

## 🔧 Middlewares

### storeIsolation

Filtra dados automaticamente pela loja do usuário:

```javascript
// Usuário comum
req.storeId = user.store._id  // Automático

// Master Admin
req.storeId = query.storeId || null  // Filtra ou vê tudo
```

### deviceApproval

Verifica se dispositivo está aprovado:

```javascript
// Gera fingerprint
const fingerprint = generateDeviceFingerprint(req);

// Busca dispositivo
const device = await Device.findOne({ fingerprint, user });

// Se não existe ou não aprovado → 403
if (!device || !device.isApproved) {
  return next(createHttpError(403, "Dispositivo não autorizado"));
}
```

---

## 🔌 Socket.io

### Conectar e Entrar na Room da Loja

```javascript
const socket = io('http://localhost:8000');

socket.on('connect', () => {
  socket.emit('join:store', storeId);
});

// Ouvir atualizações
socket.on('order:created', (data) => {
  console.log('Novo pedido:', data.orderId);
});

socket.on('inventory:updated', (data) => {
  console.log('Estoque atualizado:', data);
});
```

---

## 📚 Documentação Adicional

- [PHASE1_SUMMARY.md](./PHASE1_SUMMARY.md) - Resumo detalhado da Fase 1
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Guia de migração de dados

---

## ⚠️ Importante

### Índices de Performance

Todos os models incluem índices para queries eficientes:

```javascript
storeId: { type: ..., index: true }
{ storeId: 1, createdAt: -1 }  // Compound index
```

### Campos Imutáveis

Campos de ID são imutáveis após criação:

```javascript
immutable: true  // Previne alteração acidental
```

---

## 🚧 Em Desenvolvimento (Fases Seguintes)

- [ ] Product & Category Models (por loja)
- [ ] Recipe (Ficha Técnica)
- [ ] Inventory Service
- [ ] Stock Movement
- [ ] Purchase Order com sugestão automática

---

*Versão: 1.0.0 (Fase 1)*
*Última atualização: 2026-05-20*
