# Documentação Técnica - Restaurant POS System

**Versão**: 2.0.0  
**Data**: 2026-07-21  
**Status**: Produção

---

## Índice

1. [Introdução](#introdução)
2. [Arquitetura](#arquitetura)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Estrutura do Projeto](#estrutura-do-projeto)
5. [Modelos de Dados](#modelos-de-dados)
6. [API REST](#api-rest)
7. [WebSocket](#websocket)
8. [Funcionalidades](#funcionalidades)
9. [Padrões de Código](#padrões-de-código)
10. [Operação](#operação)
11. [Troubleshooting](#troubleshooting)
12. [Extensão](#extensão)

---

## Introdução

### O que é

Sistema POS (Point of Sale) completo para restaurantes com:
- Gestão de pedidos e mesas
- Processamento de pagamentos
- Controle de caixa (abertura/fechamento/sangrias)
- Cozinha (KDS - Kitchen Display System)
- Divisão de contas
- Cálculo de comissões de garçons
- Gorjeta opcional (10%)

### Para quem é

- **Garçons**: Criar pedidos, gerenciar mesas
- **Caixas**: Processar pagamentos, gerenciar caixa
- **Cozinha**: Visualizar e preparar pedidos
- **Administradores**: Relatórios e configuração

### Requisitos de Sistema

**Servidor**:
- Node.js 18+
- MongoDB 6.0+ (com replica set para transações)
- 2GB RAM mínimo
- 10GB storage

**Cliente**:
- Browser moderno (Chrome 90+, Firefox 88+, Safari 14+)
- Impressora térmica ESC/POS (opcional)

---

## Arquitetura

### Visão Geral

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  ┌──────────┬──────────┬──────────┬──────────────────┐ │
│  │   PDV    │  Mesas   │  Caixa   │    Kitchen       │ │
│  └──────────┴──────────┴──────────┴──────────────────┘ │
└─────────────────────────────────────────────────────────┘
                         │
                    REST + WebSocket
                         │
┌─────────────────────────────────────────────────────────┐
│                  Backend (Node.js)                       │
│  ┌──────────┬──────────┬──────────┬──────────────────┐ │
│  │  Routes  │Controllers│ Services │   Middlewares    │ │
│  └──────────┴──────────┴──────────┴──────────────────┘ │
└─────────────────────────────────────────────────────────┘
                         │
                      Mongoose
                         │
┌─────────────────────────────────────────────────────────┐
│                    MongoDB                               │
└─────────────────────────────────────────────────────────┘
```

### Padrões Utilizados

**Backend**:
- **MVC**: Separação de responsabilidades
- **Service Layer**: Lógica de negócio isolada
- **Middleware Pattern**: Autenticação e validação
- **Event-Driven**: WebSocket para real-time

**Frontend**:
- **Component-Based**: React com hooks
- **Server State**: React Query
- **Real-time**: Socket.io-client
- **State Management**: Redux Toolkit (se necessário)

### Fluxos Principais

#### 1. Criação de Pedido

```
1. Garçom seleciona mesa
2. Adiciona itens ao pedido
3. Backend cria Order (status: pending)
4. WebSocket notifica KDS
5. Cozinha visualiza e prepara
6. Garçom marca como pronto
7. Cliente paga (gorjeta opcional)
8. Backend atualiza status e registra Payment
9. Caixa registra movimento
```

#### 2. Gestão de Caixa

```
1. Caixa abre sessão (openingBalance)
2. Vendas registram movimentos
3. Sangrias/suprimentos são registrados
4. Caixa fecha sessão (closingBalance)
5. Sistema calcula diferença
```

#### 3. Divisão de Conta

```
1. Cliente solicita divisão
2. Sistema calcula por itens ou igual
3. Cada pagamento é processado separadamente
4. Order é fechado quando todos pagam
```

---

## Stack Tecnológico

### Backend

| Tecnologia | Versão | Propósito | Arquivo de Config |
|------------|--------|-----------|-------------------|
| Node.js | 18+ | Runtime | `package.json` |
| Express.js | 4.18+ | Framework web | `app.js` |
| Mongoose | 7.0+ | ODM MongoDB | `config/database.js` |
| MongoDB | 6.0+ | Banco NoSQL | `.env` |
| Socket.io | 4.5+ | WebSocket | `app.js` |
| JWT | 9.0+ | Autenticação | `.env` |
| bcrypt | 5.1+ | Hash senhas | `services/authService.js` |
| Joi | 17.9+ | Validação | `middlewares/validation.js` |

### Frontend

| Tecnologia | Versão | Propósito | Arquivo de Config |
|------------|--------|-----------|-------------------|
| React | 18.2+ | UI Library | `package.json` |
| Vite | 5.0+ | Build tool | `vite.config.js` |
| Tailwind CSS | 3.3+ | Styling | `tailwind.config.js` |
| React Query | 4.36+ | Server state | `main.jsx` |
| Socket.io-client | 4.5+ | WebSocket | `hooks/useWebSocket.js` |
| Axios | 1.4+ | HTTP client | `services/api.js` |

### Ferramentas de Desenvolvimento

- **ESLint**: `eslint.config.js`
- **Prettier**: `.prettierrc`
- **Git**: `.gitignore`
- **Nodemon**: Backend hot-reload
- **React DevTools**: Debug frontend

---

## Estrutura do Projeto

```
Restaurant_POS_System/
├── pos-backend/
│   ├── config/
│   │   ├── database.js          # Conexão MongoDB
│   │   └── config.js            # Variáveis de ambiente
│   ├── controllers/             # Lógica de requisições
│   │   ├── orderController.js
│   │   ├── paymentController.js
│   │   ├── tableController.js
│   │   ├── cashSessionController.js
│   │   ├── kdsController.js
│   │   └── authController.js
│   ├── models/                  # Schemas Mongoose
│   │   ├── orderModel.js
│   │   ├── paymentModel.js
│   │   ├── tableModel.js
│   │   ├── cashSessionModel.js
│   │   ├── userModel.js
│   │   └── productModel.js
│   ├── services/                # Lógica de negócio
│   │   ├── authService.js
│   │   ├── paymentService.js
│   │   └── websocketService.js
│   ├── middlewares/             # Interceptadores
│   │   ├── auth.js              # JWT verification
│   │   ├── errorHandler.js      # Error handling
│   │   └── validation.js        # Data validation
│   ├── routes/                  # Definição de rotas
│   │   ├── orderRoutes.js
│   │   ├── paymentRoutes.js
│   │   ├── tableRoutes.js
│   │   └── authRoutes.js
│   ├── utils/                   # Funções auxiliares
│   │   └── helpers.js
│   ├── app.js                   # Configuração Express
│   ├── server.js                # Inicialização servidor
│   ├── package.json
│   └── .env.example
│
├── pos-frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── pdv/             # Componentes PDV
│   │   │   │   ├── OrderCard.jsx
│   │   │   │   ├── ProductGrid.jsx
│   │   │   │   └── Payment.jsx
│   │   │   ├── tables/          # Componentes mesas
│   │   │   │   └── TableCard.jsx
│   │   │   ├── cash/            # Componentes caixa
│   │   │   │   └── CashSession.jsx
│   │   │   ├── kitchen/         # Componentes KDS
│   │   │   │   └── KitchenOrder.jsx
│   │   │   └── shared/          # Componentes compartilhados
│   │   │       ├── Modal.jsx
│   │   │       └── SplitBill.jsx
│   │   ├── pages/               # Páginas da aplicação
│   │   │   ├── PDV.jsx
│   │   │   ├── Tables.jsx
│   │   │   ├── Cash.jsx
│   │   │   └── Kitchen.jsx
│   │   ├── services/            # Serviços
│   │   │   └── api.js
│   │   ├── hooks/               # Hooks customizados
│   │   │   ├── useOrders.js
│   │   │   └── useWebSocket.js
│   │   ├── utils/               # Utilitários
│   │   │   └── helpers.js
│   │   ├── App.jsx              # Componente raiz
│   │   └── main.jsx             # Entry point
│   ├── public/
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
└── docs/
    ├── DOCUMENTACAO_TECNICA.md
    ├── ARCHITECTURE_ANALYSIS.md
    └── IMPLEMENTACAO_BRASIL.md
```

---

## Modelos de Dados

### Order (Pedido)

**Arquivo**: `pos-backend/models/orderModel.js`

```javascript
{
  orderNumber: String,              // Ex: "ORD-001"
  tableId: ObjectId,                // Ref: Table
  items: [{
    product: ObjectId,              // Ref: Product
    name: String,                   // Nome do produto
    quantity: Number,               // Quantidade
    price: Number,                  // Preço unitário
    notes: String,                  // Observações
    status: String                  // pending|preparing|ready|served
  }],
  customer: {
    name: String,
    phone: String,
    guests: Number
  },
  orderType: String,                // dine-in|takeout|delivery
  status: String,                   // pending|in-progress|ready|completed|cancelled
  paymentStatus: String,            // unpaid|paid
  paymentMethod: String,            // cash|credit-card|debit-card|pix
  subtotal: Number,
  tax: Number,
  discount: Number,
  serviceCharge: {
    amount: Number,
    rate: Number,                   // 10 para 10%
    opted: Boolean
  },
  total: Number,
  waiter: ObjectId,                 // Ref: User (garçom)
  commission: {
    rate: Number,                   // Percentual
    amount: Number                  // Valor calculado
  },
  createdAt: Date,
  updatedAt: Date
}
```

**Validações**:
- `orderNumber`: Único
- `items`: Mínimo 1 item
- `quantity`: Mínimo 1
- `price`: Deve ser positivo

**Índices**:
- `orderNumber`: Único
- `tableId`: Para consultas por mesa
- `status`: Para filtros
- `createdAt`: Para ordenação

### Payment (Pagamento)

**Arquivo**: `pos-backend/models/paymentModel.js`

```javascript
{
  orderId: ObjectId,                // Ref: Order (obrigatório)
  method: String,                   // cash|credit-card|debit-card|pix
  amount: Number,                   // Valor pago (obrigatório)
  tip: Number,                      // Gorjeta
  status: String,                   // pending|completed|failed
  transactionId: String,            // ID da transação externa
  createdAt: Date
}
```

**Validações**:
- `orderId`: Obrigatório
- `method`: Enum válido
- `amount`: Positivo

### CashSession (Sessão de Caixa)

**Arquivo**: `pos-backend/models/cashSessionModel.js`

```javascript
{
  openedBy: ObjectId,               // Ref: User (obrigatório)
  closedBy: ObjectId,               // Ref: User
  openingBalance: Number,           // Saldo inicial (obrigatório)
  closingBalance: Number,           // Saldo final
  movements: [{
    type: String,                   // sale|sangria|suprimento|refund
    amount: Number,                 // Valor (obrigatório)
    description: String,            // Descrição
    paymentMethod: String,          // Método de pagamento
    orderId: ObjectId,              // Ref: Order (para vendas)
    createdAt: Date
  }],
  status: String,                   // open|closed
  openedAt: Date,
  closedAt: Date
}
```

**Lógica de Cálculo**:
```javascript
const totalSales = movements
  .filter(m => m.type === 'sale')
  .reduce((sum, m) => sum + m.amount, 0);

const totalSangrias = movements
  .filter(m => m.type === 'sangria')
  .reduce((sum, m) => sum + m.amount, 0);

const expectedBalance = openingBalance + totalSales - totalSangrias;
```

### Table (Mesa)

**Arquivo**: `pos-backend/models/tableModel.js`

```javascript
{
  number: Number,                   // Número da mesa (único)
  capacity: Number,                 // Capacidade de pessoas
  status: String,                   // available|occupied|reserved
  location: String,                 // indoor|outdoor|bar
  currentOrder: ObjectId,           // Ref: Order (pedido ativo)
  waiter: ObjectId                  // Ref: User (garçom responsável)
}
```

**Validações**:
- `number`: Único
- `capacity`: Mínimo 1
- `status`: Enum válido

### User (Usuário)

**Arquivo**: `pos-backend/models/userModel.js`

```javascript
{
  name: String,                     // Nome completo (obrigatório)
  email: String,                    // Email único (obrigatório)
  password: String,                 // Hash bcrypt (obrigatório)
  role: String,                     // admin|waiter|cashier|kitchen
  commissionRate: Number,           // Percentual de comissão (0-100)
  active: Boolean,                  // Usuário ativo
  createdAt: Date
}
```

**Segurança**:
- Senha hash com bcrypt (10 rounds)
- Email único
- Role define permissões

### Product (Produto)

**Arquivo**: `pos-backend/models/productModel.js`

```javascript
{
  name: String,                     // Nome do produto (obrigatório)
  description: String,              // Descrição
  price: Number,                    // Preço (obrigatório, positivo)
  category: String,                 // Categoria (ex: bebidas, pratos)
  image: String,                    // URL da imagem
  available: Boolean,               // Disponível para venda
  createdAt: Date
}
```

---

## API REST

### Autenticação

**Base URL**: `http://localhost:8000/api`

#### Login

```http
POST /user/login
Content-Type: application/json

{
  "email": "admin@pos.com",
  "password": "admin123"
}
```

**Resposta**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "_id": "60d5ecb5c7f6b7b4c8e8b456",
    "name": "Admin",
    "email": "admin@pos.com",
    "role": "admin"
  }
}
```

**Headers subsequentes**:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

#### Logout

```http
POST /auth/logout
Authorization: Bearer {token}
```

#### Obter Usuário Atual

```http
GET /auth/me
Authorization: Bearer {token}
```

### Pedidos

#### Listar Pedidos

```http
GET /orders
Authorization: Bearer {token}
```

**Query Parameters**:
- `status`: pending|in-progress|ready|completed
- `tableId`: Filtrar por mesa
- `startDate`, `endDate`: Filtrar por data

**Resposta**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "60d5ecb5c7f6b7b4c8e8b456",
      "orderNumber": "ORD-001",
      "items": [...],
      "total": 100,
      "status": "pending"
    }
  ]
}
```

#### Criar Pedido

```http
POST /orders
Authorization: Bearer {token}
Content-Type: application/json

{
  "tableId": "60d5ecb5c7f6b7b4c8e8b456",
  "items": [
    {
      "productId": "60d5ecb5c7f6b7b4c8e8b457",
      "quantity": 2,
      "notes": "Sem cebola"
    }
  ],
  "orderType": "dine-in",
  "customer": {
    "name": "João",
    "guests": 4
  }
}
```

**Resposta**:
```json
{
  "success": true,
  "data": {
    "_id": "60d5ecb5c7f6b7b4c8e8b458",
    "orderNumber": "ORD-001",
    "status": "pending"
  }
}
```

#### Atualizar Pedido

```http
PUT /orders/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "in-progress"
}
```

#### Cancelar Pedido

```http
DELETE /orders/:id
Authorization: Bearer {token}
```

#### Processar Pagamento

```http
POST /orders/:id/pay
Authorization: Bearer {token}
Content-Type: application/json

{
  "method": "credit-card",
  "tip": 10,
  "serviceChargeOpted": true
}
```

**Resposta**:
```json
{
  "success": true,
  "data": {
    "order": {
      "status": "completed",
      "paymentStatus": "paid",
      "total": 110
    },
    "payment": {
      "method": "credit-card",
      "amount": 110,
      "tip": 10
    }
  }
}
```

### Mesas

#### Listar Mesas

```http
GET /tables
Authorization: Bearer {token}
```

**Query Parameters**:
- `status`: available|occupied|reserved
- `location`: indoor|outdoor|bar

#### Ocupar Mesa

```http
POST /tables/:id/occupy
Authorization: Bearer {token}
Content-Type: application/json

{
  "waiterId": "60d5ecb5c7f6b7b4c8e8b456"
}
```

#### Liberar Mesa

```http
POST /tables/:id/free
Authorization: Bearer {token}
```

### Caixa

#### Abrir Caixa

```http
POST /cash-sessions/open
Authorization: Bearer {token}
Content-Type: application/json

{
  "openingBalance": 100
}
```

#### Obter Sessão Atual

```http
GET /cash-sessions/current
Authorization: Bearer {token}
```

**Resposta**:
```json
{
  "success": true,
  "data": {
    "_id": "60d5ecb5c7f6b7b4c8e8b456",
    "openingBalance": 100,
    "movements": [...],
    "status": "open",
    "totalSales": 500,
    "expectedBalance": 600
  }
}
```

#### Registrar Sangria

```http
POST /cash-sessions/:id/sangria
Authorization: Bearer {token}
Content-Type: application/json

{
  "amount": 50,
  "description": "Pagamento fornecedor"
}
```

#### Registrar Suprimento

```http
POST /cash-sessions/:id/suprimento
Authorization: Bearer {token}
Content-Type: application/json

{
  "amount": 100,
  "description": "Troco"
}
```

#### Fechar Caixa

```http
POST /cash-sessions/:id/close
Authorization: Bearer {token}
Content-Type: application/json

{
  "closingBalance": 550
}
```

**Resposta**:
```json
{
  "success": true,
  "data": {
    "expectedBalance": 600,
    "closingBalance": 550,
    "difference": -50
  }
}
```

### KDS

#### Listar Pedidos na Cozinha

```http
GET /kds/orders
Authorization: Bearer {token}
```

#### Atualizar Status

```http
PUT /kds/orders/:id/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "ready"
}
```

---

## WebSocket

### Configuração

**Backend**: `pos-backend/app.js`

```javascript
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ['GET', 'POST']
  }
});
```

**Frontend**: `pos-frontend/src/hooks/useWebSocket.js`

```javascript
import { io } from 'socket.io-client';

const useWebSocket = () => {
  const socket = io(process.env.REACT_APP_API_URL);
  
  return socket;
};
```

### Eventos do Servidor

#### order:created

Emitido quando novo pedido é criado.

```javascript
// Backend
io.emit('order:created', order);

// Frontend
socket.on('order:created', (order) => {
  console.log('Novo pedido:', order);
  // Atualizar lista de pedidos
});
```

**Payload**:
```json
{
  "_id": "60d5ecb5c7f6b7b4c8e8b456",
  "orderNumber": "ORD-001",
  "tableId": "60d5ecb5c7f6b7b4c8e8b457",
  "items": [...],
  "status": "pending",
  "createdAt": "2026-07-21T10:00:00.000Z"
}
```

#### order:updated

Emitido quando pedido é atualizado.

```javascript
socket.on('order:updated', (order) => {
  console.log('Pedido atualizado:', order);
  // Atualizar estado local
});
```

#### order:status-changed

Emitido quando status muda.

```javascript
socket.on('order:status-changed', ({ orderId, status }) => {
  console.log(`Pedido ${orderId} mudou para ${status}`);
});
```

#### payment:completed

Emitido quando pagamento é processado.

```javascript
socket.on('payment:completed', (payment) => {
  console.log('Pagamento concluído:', payment);
  // Atualizar caixa
});
```

#### table:updated

Emitido quando mesa é atualizada.

```javascript
socket.on('table:updated', (table) => {
  console.log('Mesa atualizada:', table);
  // Atualizar status da mesa
});
```

### Eventos do Cliente

#### join:table

Cliente entra em sala da mesa.

```javascript
socket.emit('join:table', { tableId: '60d5ecb5c7f6b7b4c8e8b456' });
```

#### leave:table

Cliente sai da sala da mesa.

```javascript
socket.emit('leave:table', { tableId: '60d5ecb5c7f6b7b4c8e8b456' });
```

### Rooms

O servidor cria rooms para cada mesa:

```javascript
// Backend
socket.join(`table:${tableId}`);

// Emitir apenas para mesa específica
io.to(`table:${tableId}`).emit('order:updated', order);
```

---

## Funcionalidades

### 1. Sistema de Pedidos

**Descrição**: Criação e gestão completa de pedidos.

**Fluxo**:
```
1. Selecionar mesa
2. Adicionar itens
3. Revisar pedido
4. Enviar para cozinha
5. Cozinha prepara
6. Marcar como pronto
7. Cliente paga
8. Fechar pedido
```

**Componentes**:
- Frontend: `components/pdv/OrderCard.jsx`
- Backend: `controllers/orderController.js`
- Model: `models/orderModel.js`

**Teste**:
```bash
# Criar pedido
curl -X POST http://localhost:8000/api/order \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "tableId": "60d5ecb5c7f6b7b4c8e8b456",
    "items": [{"productId": "60d5ecb5c7f6b7b4c8e8b457", "quantity": 2}]
  }'
```

### 2. Gestão de Mesas

**Descrição**: Controle de ocupação e atendimento.

**Estados**:
- `available`: Disponível
- `occupied`: Ocupada
- `reserved`: Reservada

**Componentes**:
- Frontend: `components/tables/TableCard.jsx`
- Backend: `controllers/tableController.js`
- Model: `models/tableModel.js`

### 3. Sistema de Caixa

**Descrição**: Gestão financeira do caixa.

**Operações**:
- Abrir caixa (openingBalance)
- Registrar vendas
- Sangrias (retiradas)
- Suprimentos (adições)
- Fechar caixa (closingBalance)

**Cálculo**:
```javascript
expectedBalance = openingBalance + sales - sangrias + suprimentos
difference = closingBalance - expectedBalance
```

**Componentes**:
- Frontend: `components/cash/CashSession.jsx`
- Backend: `controllers/cashSessionController.js`
- Model: `models/cashSessionModel.js`

### 4. Gorjeta Opcional (10%)

**Descrição**: Sistema de gorjeta opcional.

**Lógica**:
```javascript
if (serviceChargeOpted) {
  serviceCharge = subtotal * 0.10;
  total = subtotal + tax + serviceCharge;
}
```

**Componentes**:
- Frontend: `components/pdv/Payment.jsx`
- Backend: `controllers/paymentController.js`

### 5. Divisão de Conta

**Descrição**: Divisão por itens ou valor igual.

**Tipos**:
- **Por itens**: Cada pessoa paga seus itens
- **Igual**: Valor dividido igualmente

**Componentes**:
- Frontend: `components/shared/SplitBill.jsx`
- Backend: `controllers/paymentController.js`

### 6. Comissão de Garçons

**Descrição**: Cálculo automático de comissão.

**Fórmula**:
```javascript
commission = total * (commissionRate / 100)
```

**Componentes**:
- Backend: `controllers/orderController.js`
- Model: `models/userModel.js`

### 7. KDS (Kitchen Display System)

**Descrição**: Visualização de pedidos na cozinha.

**Fluxo**:
```
1. Pedido criado → aparece no KDS
2. Cozinha visualiza
3. Marca como preparando
4. Marca como pronto
5. Garçom retira
```

**Componentes**:
- Frontend: `pages/Kitchen.jsx`
- Backend: `controllers/kdsController.js`
- Model: `models/kdsOrderModel.js`

### 8. WebSocket Real-time

**Descrição**: Comunicação bidirecional.

**Casos de Uso**:
- Notificar novo pedido
- Atualizar status em tempo real
- Sincronizar múltiplos clientes

**Componentes**:
- Backend: `services/websocketService.js`
- Frontend: `hooks/useWebSocket.js`

---

## Padrões de Código

### Backend

#### Controllers

**Padrão**: Async/await com try-catch.

```javascript
const createOrder = async (req, res) => {
  try {
    const order = await Order.create(req.body);
    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
```

**Arquivo**: `controllers/orderController.js`

#### Models

**Padrão**: Schema Mongoose com validação.

```javascript
const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    }
  }]
}, {
  timestamps: true
});

orderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});
```

**Arquivo**: `models/orderModel.js`

#### Services

**Padrão**: Lógica de negócio isolada.

```javascript
class PaymentService {
  static async processPayment(orderId, paymentData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      const payment = await Payment.create([paymentData], { session });
      
      order.paymentStatus = 'paid';
      await order.save({ session });
      
      await session.commitTransaction();
      return payment;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}
```

**Arquivo**: `services/paymentService.js`

#### Middlewares

**Padrão**: Interceptadores reutilizáveis.

```javascript
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Token não fornecido'
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Token inválido'
    });
  }
};
```

**Arquivo**: `middlewares/auth.js`

### Frontend

#### Components

**Padrão**: Functional components com hooks.

```javascript
const OrderCard = ({ order }) => {
  const [status, setStatus] = useState(order.status);
  
  const handleStatusChange = async (newStatus) => {
    try {
      await api.orders.update(order._id, { status: newStatus });
      setStatus(newStatus);
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };
  
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="font-bold">{order.orderNumber}</h3>
      <StatusBadge status={status} />
      <button onClick={() => handleStatusChange('ready')}>
        Marcar Pronto
      </button>
    </div>
  );
};
```

**Arquivo**: `components/pdv/OrderCard.jsx`

#### Hooks Customizados

**Padrão**: Lógica reutilizável.

```javascript
const useOrders = (filters = {}) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await api.orders.getAll(filters);
        setOrders(response.data);
      } catch (error) {
        console.error('Erro ao buscar pedidos:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrders();
  }, [filters]);
  
  return { orders, loading };
};
```

**Arquivo**: `hooks/useOrders.js`

#### API Service

**Padrão**: Cliente centralizado.

```javascript
const api = {
  orders: {
    getAll: (params) => axios.get('/api/orders', { params }),
    create: (data) => axios.post('/api/orders', data),
    update: (id, data) => axios.put(`/api/orders/${id}`, data),
    delete: (id) => axios.delete(`/api/orders/${id}`)
  },
  tables: {
    getAll: () => axios.get('/api/tables'),
    occupy: (id, data) => axios.post(`/api/tables/${id}/occupy`, data),
    free: (id) => axios.post(`/api/tables/${id}/free`)
  }
};

export default api;
```

**Arquivo**: `services/api.js`

---

## Operação

### Instalação

#### 1. Pré-requisitos

```bash
# Verificar versões
node --version  # 18+
npm --version   # 9+
mongod --version # 6+
```

#### 2. Clone e Instale

```bash
# Clonar repositório
git clone <repository-url>
cd Restaurant_POS_System

# Instalar backend
cd pos-backend
npm install

# Instalar frontend
cd ../pos-frontend
npm install
```

#### 3. Configuração

**Backend (.env)**:
```bash
cd pos-backend
cp .env.example .env
```

Editar `.env`:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/restaurant_pos
JWT_SECRET=seu-segredo-aqui-mude-isto
JWT_EXPIRE=7d
CORS_ORIGIN=http://localhost:5173
```

**Frontend (.env)**:
```bash
cd pos-frontend
cp .env.example .env
```

Editar `.env`:
```env
VITE_BACKEND_URL=http://localhost:8000
```

#### 4. MongoDB

```bash
# Iniciar MongoDB (Linux/Mac)
mongod --dbpath /data/db

# Windows
net start MongoDB

# Verificar
mongosh
```

**Replica Set (necessário para transações)**:
```bash
# Iniciar com replica set
mongod --replSet rs0 --dbpath /data/db

# Conectar e inicializar
mongosh
rs.initiate()
```

#### 5. Popular Banco

```bash
cd pos-backend
node scripts/seed.js
```

**Dados criados**:
- 1 usuário admin: `admin@pos.com` / `admin123`
- 10 produtos de exemplo
- 5 mesas

#### 6. Iniciar Aplicação

**Terminal 1 - Backend**:
```bash
cd pos-backend
npm run dev
```

**Terminal 2 - Frontend**:
```bash
cd pos-frontend
npm run dev
```

**Acessar**: `http://localhost:5173`

### Scripts Disponíveis

#### Backend

```bash
npm run dev          # Desenvolvimento (nodemon)
npm start            # Produção
npm test             # Testes
node scripts/seed.js # Popular banco
npm run lint         # Linting
```

#### Frontend

```bash
npm run dev          # Desenvolvimento (Vite)
npm run build        # Build produção
npm run preview      # Preview do build
npm test             # Testes
npm run lint         # Linting
```

### Variáveis de Ambiente

#### Backend

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `NODE_ENV` | Ambiente | `development` |
| `PORT` | Porta servidor | `8000` |
| `MONGODB_URI` | URI MongoDB | `mongodb://localhost:27017/restaurant_pos` |
| `JWT_SECRET` | Segredo JWT | - |
| `JWT_EXPIRE` | Expiração JWT | `7d` |
| `CORS_ORIGIN` | Origem permitida | `http://localhost:5173` |

#### Frontend (pos-frontend)

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `VITE_BACKEND_URL` | URL da API | `http://localhost:8000` |

#### Frontend (pos-admin)

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `NEXT_PUBLIC_API_URL` | URL da API | `http://localhost:8000` |

### Deploy

#### Backend (Produção)

```bash
cd pos-backend
npm run build
NODE_ENV=production npm start
```

**Process Manager (PM2)**:
```bash
npm install -g pm2
pm2 start server.js --name pos-backend
pm2 save
pm2 startup
```

#### Frontend (Produção)

```bash
cd pos-frontend
npm run build
```

**Servir build**:
```bash
# Serve (desenvolvimento)
npx serve dist

# Nginx (produção)
server {
  listen 80;
  server_name pos.restaurant.com;
  root /var/www/pos-frontend/dist;
  index index.html;
  
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

### Backup MongoDB

```bash
# Backup completo
mongodump --db restaurant_pos --out backup_$(date +%Y%m%d)

# Restaurar
mongorestore --db restaurant_pos backup_20260721/restaurant_pos

# Backup específico de coleção
mongodump --db restaurant_pos --collection orders --out orders_backup
```

### Monitoramento

**Logs Backend**:
```bash
# Desenvolvimento
tail -f pos-backend/logs/app.log

# PM2
pm2 logs pos-backend
```

**Logs Frontend**:
```bash
# Browser Console
# F12 > Console

# Production
# Integrar com Sentry, LogRocket, etc.
```

---

## Troubleshooting

### Problemas Comuns

#### 1. MongoDB não conecta

**Sintoma**:
```
MongoNetworkError: connect ECONNREFUSED 127.0.0.1:27017
```

**Solução**:
```bash
# Verificar se MongoDB está rodando
ps aux | grep mongod

# Iniciar MongoDB
mongod --dbpath /data/db

# Verificar porta
lsof -i :27017

# Se não estiver rodando
sudo systemctl start mongod  # Linux
brew services start mongodb-community  # Mac
```

**Verificar conexão**:
```bash
mongosh
# Deve conectar sem erro
```

#### 2. WebSocket não conecta

**Sintoma**:
```
WebSocket connection to 'ws://localhost:8000' failed
```

**Solução**:

**Backend** (`app.js`):
```javascript
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true
  }
});
```

**Frontend** (`useWebSocket.js`):
```javascript
const socket = io(process.env.REACT_APP_API_URL, {
  withCredentials: true
});
```

**Verificar CORS**:
```javascript
// app.js
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}));
```

#### 3. Pagamento falha

**Sintoma**: Erro ao processar pagamento.

**Verificações**:
```javascript
// 1. Caixa está aberto?
const cashSession = await CashSession.findOne({ status: 'open' });
if (!cashSession) throw new Error('Caixa não está aberto');

// 2. Saldo suficiente?
const balance = cashSession.openingBalance + 
  cashSession.movements.reduce((sum, m) => sum + m.amount, 0);
if (balance < amount) throw new Error('Saldo insuficiente');

// 3. Pedido existe?
const order = await Order.findById(orderId);
if (!order) throw new Error('Pedido não encontrado');

// 4. Pedido já foi pago?
if (order.paymentStatus === 'paid') {
  throw new Error('Pedido já foi pago');
}
```

**Teste**:
```bash
# Abrir caixa
curl -X POST http://localhost:8000/api/pdv/cash-sessions/open \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"openingBalance": 100}'
```

#### 4. Pedido não aparece no KDS

**Sintoma**: Pedido criado mas não visível na cozinha.

**Verificações**:
```javascript
// 1. Pedido foi criado?
const order = await Order.findById(orderId);
if (!order) throw new Error('Pedido não encontrado');

// 2. Evento WebSocket foi emitido?
io.emit('order:created', order);

// 3. KDSOrder foi criado?
const kdsOrder = await KDSOrder.create({
  orderId: order._id,
  items: order.items,
  status: 'pending'
});

// 4. Frontend está ouvindo?
socket.on('order:created', (order) => {
  console.log('Pedido recebido:', order);
});
```

**Debug WebSocket**:
```javascript
// Backend
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});
```

#### 5. Comissão não é calculada

**Sintoma**: Comissão do garçom não aparece.

**Verificações**:
```javascript
// 1. Garçom tem commissionRate?
const waiter = await User.findById(waiterId);
if (!waiter.commissionRate) {
  throw new Error('Garçom não tem taxa de comissão configurada');
}

// 2. Pedido tem waiterId?
if (!order.waiter) {
  throw new Error('Pedido não tem garçom atribuído');
}

// 3. Comissão foi calculada?
const commission = order.total * (waiter.commissionRate / 100);
order.commission = {
  rate: waiter.commissionRate,
  amount: commission
};
await order.save();
```

**Teste**:
```bash
# Atualizar commissionRate do garçom
curl -X PUT http://localhost:8000/api/user/{waiterId} \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"commissionRate": 5}'
```

#### 6. Gorjeta não é aplicada

**Sintoma**: Gorjeta não aparece no total.

**Verificações**:
```javascript
// 1. Cliente optou pela gorjeta?
if (!paymentData.serviceChargeOpted) {
  return; // Não aplicar gorjeta
}

// 2. Cálculo correto?
const serviceCharge = order.subtotal * 0.10; // 10%
order.serviceCharge = {
  amount: serviceCharge,
  rate: 10,
  opted: true
};

// 3. Total atualizado?
order.total = order.subtotal + order.tax + serviceCharge;
await order.save();
```

### Logs e Debug

#### Backend

```bash
# Habilitar logs detalhados
DEBUG=express:* npm run dev

# Logs MongoDB
MONGODB_DEBUG=true npm run dev

# Logs Socket.io
DEBUG=socket.io* npm run dev

# Ver logs em tempo real
tail -f pos-backend/logs/app.log
```

#### Frontend

```javascript
// React Query DevTools
import { ReactQueryDevtools } from 'react-query/devtools';

function App() {
  return (
    <>
      <MainApp />
      <ReactQueryDevtools initialIsOpen={false} />
    </>
  );
}
```

```bash
# Habilitar logs
VITE_DEBUG=true npm run dev

# Console do browser
# F12 > Console
```

### Testes

#### Backend

```bash
# Executar todos os testes
npm test

# Teste específico
npm test orderController

# Coverage
npm run test:coverage

# Teste de integração
npm run test:integration
```

**Exemplo de teste**:
```javascript
describe('Order Controller', () => {
  it('should create order', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tableId: tableId,
        items: [{ productId, quantity: 2 }]
      });
    
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderNumber).toBeDefined();
  });
});
```

#### Frontend

```bash
# Executar testes
npm test

# Testes com watch
npm run test:watch

# Coverage
npm run test:coverage
```

**Exemplo de teste**:
```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import OrderCard from './OrderCard';

test('should render order', () => {
  render(<OrderCard order={mockOrder} />);
  expect(screen.getByText('ORD-001')).toBeInTheDocument();
});

test('should update status on click', async () => {
  render(<OrderCard order={mockOrder} />);
  fireEvent.click(screen.getByText('Marcar Pronto'));
  await waitFor(() => {
    expect(screen.getByText('ready')).toBeInTheDocument();
  });
});
```

---

## Extensão

### Adicionar Nova Funcionalidade

#### 1. Definir Model

**Exemplo**: Reserva de mesa

```javascript
// pos-backend/models/reservationModel.js
const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  tableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table',
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  guests: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'pending'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Reservation', reservationSchema);
```

#### 2. Implementar Controller

```javascript
// pos-backend/controllers/reservationController.js
const Reservation = require('../models/reservationModel');

const createReservation = async (req, res) => {
  try {
    const reservation = await Reservation.create(req.body);
    res.status(201).json({
      success: true,
      data: reservation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

const getReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find()
      .populate('tableId')
      .sort({ date: 1 });
    
    res.json({
      success: true,
      data: reservations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = { createReservation, getReservations };
```

#### 3. Definir Rotas

```javascript
// pos-backend/routes/reservationRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { 
  createReservation, 
  getReservations 
} = require('../controllers/reservationController');

router.get('/', auth, getReservations);
router.post('/', auth, createReservation);

module.exports = router;
```

#### 4. Registrar Rotas

```javascript
// pos-backend/app.js
const reservationRoutes = require('./routes/reservationRoutes');
app.use('/api/reservations', reservationRoutes);
```

#### 5. Implementar Frontend

```javascript
// pos-frontend/src/pages/Reservations.jsx
import React from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../services/api';

const Reservations = () => {
  const queryClient = useQueryClient();
  
  const { data: reservations, isLoading } = useQuery(
    'reservations',
    () => api.reservations.getAll()
  );
  
  const createMutation = useMutation(
    (data) => api.reservations.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('reservations');
      }
    }
  );
  
  if (isLoading) return <div>Carregando...</div>;
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Reservas</h1>
      {reservations?.data.map(reservation => (
        <div key={reservation._id} className="bg-white p-4 mb-2 rounded">
          <p>{reservation.customerName}</p>
          <p>{new Date(reservation.date).toLocaleString()}</p>
          <p>{reservation.guests} pessoas</p>
        </div>
      ))}
    </div>
  );
};

export default Reservations;
```

#### 6. Adicionar Rota

```javascript
// pos-frontend/src/App.jsx
import Reservations from './pages/Reservations';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/reservations" element={<Reservations />} />
      </Routes>
    </Router>
  );
}
```

### Adicionar Novo Endpoint

**Exemplo**: Relatório de vendas

```javascript
// 1. Controller
// pos-backend/controllers/reportController.js
const getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const sales = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          },
          paymentStatus: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$total' },
          count: { $sum: 1 },
          avgTicket: { $avg: '$total' }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: sales[0] || { totalSales: 0, count: 0, avgTicket: 0 }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 2. Rota
// pos-backend/routes/reportRoutes.js
router.get('/sales', auth, getSalesReport);

// 3. Frontend
// pos-frontend/src/services/api.js
reports: {
  getSales: (startDate, endDate) => 
    axios.get('/api/reports/sales', { params: { startDate, endDate } })
}
```

### Adicionar Novo WebSocket Event

**Exemplo**: Notificação de nova reserva

```javascript
// 1. Backend
// pos-backend/controllers/reservationController.js
const createReservation = async (req, res) => {
  const reservation = await Reservation.create(req.body);
  
  // Emitir evento
  const io = req.app.get('io');
  io.emit('reservation:created', reservation);
  
  res.status(201).json({
    success: true,
    data: reservation
  });
};

// 2. Frontend
// pos-frontend/src/hooks/useReservations.js
const useReservations = () => {
  const socket = useWebSocket();
  const queryClient = useQueryClient();
  
  useEffect(() => {
    socket.on('reservation:created', (reservation) => {
      console.log('Nova reserva:', reservation);
      queryClient.invalidateQueries('reservations');
    });
    
    return () => socket.off('reservation:created');
  }, [socket]);
};
```

### Boas Práticas

#### 1. Validação de Dados

```javascript
// Usar Joi para validação
const Joi = require('joi');

const orderSchema = Joi.object({
  tableId: Joi.string().required(),
  items: Joi.array().items(
    Joi.object({
      productId: Joi.string().required(),
      quantity: Joi.number().integer().min(1).required()
    })
  ).min(1).required(),
  customer: Joi.object({
    name: Joi.string(),
    guests: Joi.number().integer().min(1)
  })
});

// Middleware de validação
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }
  next();
};

// Uso
router.post('/orders', auth, validate(orderSchema), createOrder);
```

#### 2. Tratamento de Erros

```javascript
// Centralizar tratamento de erros
// pos-backend/middlewares/errorHandler.js
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  
  // Erro de validação Mongoose
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: Object.values(err.errors).map(e => e.message).join(', ')
    });
  }
  
  // Erro de cast (ObjectId inválido)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'ID inválido'
    });
  }
  
  // Erro padrão
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Erro interno do servidor'
  });
};

// Uso
app.use(errorHandler);
```

#### 3. Transações

```javascript
// Usar transações para operações atômicas
const session = await mongoose.startSession();
session.startTransaction();

try {
  const order = await Order.create([orderData], { session });
  const payment = await Payment.create([paymentData], { session });
  
  order.paymentStatus = 'paid';
  await order.save({ session });
  
  await session.commitTransaction();
  return { order, payment };
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

#### 4. Cache

```javascript
// Usar cache para dados frequentemente acessados
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // 10 minutos

const getProducts = async (req, res) => {
  const cacheKey = 'products';
  let products = cache.get(cacheKey);
  
  if (!products) {
    products = await Product.find({ available: true });
    cache.set(cacheKey, products);
  }
  
  res.json({
    success: true,
    data: products
  });
};

// Invalidar cache quando produtos mudam
const updateProduct = async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body);
  cache.del('products');
  
  res.json({
    success: true,
    data: product
  });
};
```

#### 5. Rate Limiting

```javascript
// Prevenir abuso de API
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requisições
  message: 'Muitas requisições, tente novamente mais tarde',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Rate limit específico para login
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 tentativas
  message: 'Muitas tentativas de login'
});

app.use('/api/auth/login', authLimiter);
```

#### 6. Documentação API

```javascript
// Usar JSDoc para documentar endpoints
/**
 * Criar novo pedido
 * @route POST /api/orders
 * @param {string} req.body.tableId - ID da mesa
 * @param {Array} req.body.items - Lista de itens
 * @returns {Object} 201 - Pedido criado
 * @returns {Error} 400 - Dados inválidos
 */
const createOrder = async (req, res) => {
  // ...
};
```

---

## Glossário

| Termo | Definição |
|-------|-----------|
| **PDV** | Ponto de Venda (Point of Sale) |
| **KDS** | Kitchen Display System - Sistema de visualização para cozinha |
| **Sangria** | Retirada de dinheiro do caixa para pagamentos externos |
| **Suprimento** | Adição de dinheiro ao caixa |
| **Gorjeta** | Taxa opcional de 10% sobre o valor do pedido |
| **Comissão** | Percentual pago ao garçom sobre vendas |
| **Split Bill** | Divisão de conta entre clientes |
| **WebSocket** | Protocolo de comunicação bidirecional em tempo real |
| **JWT** | JSON Web Token - Padrão de autenticação |
| **ODM** | Object Data Modeling - Mongoose para MongoDB |
| **Replica Set** | Configuração MongoDB para transações |
| **ESC/POS** | Protocolo de impressão térmica |

---

## Referências

### Documentação Oficial

- [Express.js](https://expressjs.com/)
- [Mongoose](https://mongoosejs.com/)
- [MongoDB](https://www.mongodb.com/docs/)
- [React](https://react.dev/)
- [React Query](https://tanstack.com/query)
- [Socket.io](https://socket.io/)
- [Tailwind CSS](https://tailwindcss.com/)

### Ferramentas

- [Postman](https://www.postman.com/) - Testar APIs
- [MongoDB Compass](https://www.mongodb.com/products/compass) - GUI MongoDB
- [React DevTools](https://react.dev/learn/react-developer-tools) - Debug React
- [Redux DevTools](https://github.com/reduxjs/redux-devtools) - Debug Redux

### Artigos Úteis

- [REST API Best Practices](https://restfulapi.net/)
- [WebSocket Tutorial](https://socket.io/docs/v4/)
- [MongoDB Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [React Query Guide](https://tanstack.com/query/latest/docs/react/overview)

---

## Suporte

### Issues Comuns

1. **MongoDB não conecta**: Verificar serviço e porta
2. **WebSocket falha**: Verificar CORS e configuração
3. **Pagamento falha**: Verificar caixa aberto e saldo
4. **Comissão errada**: Verificar commissionRate do garçom
5. **Gorjeta não aplicada**: Verificar serviceChargeOpted

### Contato

- **Email**: suporte@restaurant.com
- **Documentação**: `/docs`
- **Repositório**: GitHub Issues

---

**Fim da Documentação**
