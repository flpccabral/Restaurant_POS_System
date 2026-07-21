# 🏗️ Arquitetura do Sistema POS - Análise de Engenharia Reversa

## 📋 Índice
1. [Mapeamento do Banco de Dados](#1-mapeamento-do-banco-de-dados)
2. [Lógica de Negócio](#2-lógica-de-negócio)
3. [Fluxos Críticos da Interface PDV](#3-fluxos-críticos-da-interface-pdv)
4. [APIs e Endpoints](#4-apis-e-endpoints)
5. [Recomendações para Backend Centralizado](#5-recomendações-para-backend-centralizado)

---

## 1. Mapeamento do Banco de Dados

### 1.1 Coleções MongoDB (NoSQL)

O sistema utiliza **MongoDB** com **Mongoose ODM**. Abaixo estão todas as coleções identificadas:

---

#### 📦 **Coleção: `orders`** (Pedidos/Vendas)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `_id` | ObjectId | Auto | Identificador único do pedido |
| `customerDetails.name` | String | Sim | Nome do cliente |
| `customerDetails.phone` | String | Sim | Telefone do cliente |
| `customerDetails.guests` | Number | Sim | Número de pessoas na mesa |
| `orderStatus` | String | Sim | Status do pedido ("In Progress", "Ready", "Completed") |
| `orderDate` | Date | Sim (default: now) | Data/hora do pedido |
| `bills.total` | Number | Sim | Subtotal dos itens |
| `bills.tax` | Number | Sim | Valor do imposto (5.25%) |
| `bills.totalWithTax` | Number | Sim | Total com imposto |
| `items` | Array | Sim | Lista de itens do pedido |
| `table` | ObjectId (ref: Table) | Não | Referência à mesa |
| `paymentMethod` | String | Não | Método de pagamento ("Cash", "Online") |
| `paymentData.razorpay_order_id` | String | Não | ID do pedido Razorpay |
| `paymentData.razorpay_payment_id` | String | Não | ID do pagamento Razorpay |
| `createdAt` | Date | Auto | Timestamp de criação |
| `updatedAt` | Date | Auto | Timestamp de atualização |

**Estrutura do item em `items[]`:**
```javascript
{
  id: Date,              // ID gerado no frontend
  name: String,          // Nome do prato
  pricePerQuantity: Number,
  quantity: Number,
  price: Number          // pricePerQuantity * quantity
}
```

---

#### 👤 **Coleção: `users`** (Usuários)

| Campo | Tipo | Obrigatório | Validação | Descrição |
|-------|------|-------------|-----------|-----------|
| `_id` | ObjectId | Auto | - | Identificador único |
| `name` | String | Sim | - | Nome do usuário |
| `email` | String | Sim | Regex `\S+@\S+\.\S+` | Email único |
| `phone` | Number | Sim | Regex `\d{10}` | Telefone (10 dígitos) |
| `password` | String | Sim | Hash bcrypt (salt 10) | Senha criptografada |
| `role` | String | Sim | - | Papel (admin, staff, etc.) |
| `createdAt` | Date | Auto | - | Timestamp de criação |
| `updatedAt` | Date | Auto | - | Timestamp de atualização |

**Middleware:** Hook `pre('save')` para hash de senha com bcrypt.

---

#### 🪑 **Coleção: `tables`** (Mesas)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `_id` | ObjectId | Auto | Identificador único |
| `tableNo` | Number | Sim (unique) | Número da mesa |
| `seats` | Number | Sim | Capacidade de lugares |
| `status` | String | Default: "Available" | "Available" ou "Booked" |
| `currentOrder` | ObjectId (ref: Order) | Não | Referência ao pedido ativo |

---

#### 💳 **Coleção: `payments`** (Pagamentos)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `_id` | ObjectId | Identificador único |
| `paymentId` | String | ID do pagamento (Razorpay) |
| `orderId` | String | ID do pedido associado |
| `amount` | Number | Valor em INR (Rúpias) |
| `currency` | String | Moeda (ex: "INR") |
| `status` | String | Status do pagamento |
| `method` | String | Método (ex: "upi", "card") |
| `email` | String | Email do pagador |
| `contact` | String | Telefone do pagador |
| `createdAt` | Date | Data do pagamento |

---

### 1.2 Relacionamentos (Diagrama ER)

```
┌─────────────────┐         ┌─────────────────┐
│     tables      │         │      users      │
├─────────────────┤         ├─────────────────┤
│ _id (PK)        │         │ _id (PK)        │
│ tableNo         │         │ email           │
│ seats           │         │ password (hash) │
│ status          │         │ role            │
│ currentOrder →──┼────────▶│                 │
└─────────────────┘         └─────────────────┘
        │
        │ 1:1 (opcional)
        ▼
┌─────────────────┐         ┌─────────────────┐
│     orders      │         │    payments     │
├─────────────────┤         ├─────────────────┤
│ _id (PK)        │         │ _id (PK)        │
│ customerDetails │         │ paymentId       │
│ orderStatus     │         │ orderId         │
│ orderDate       │         │ amount          │
│ bills           │         │ method          │
│ items[]         │         │ status          │
│ table →─────────┼────────▶│                 │
│ paymentMethod   │         │                 │
│ paymentData     │         │                 │
└─────────────────┘         └─────────────────┘
```

**Relacionamentos identificados:**
- `orders.table` → `tables._id` (Many-to-One)
- `tables.currentOrder` → `orders._id` (One-to-One opcional)
- `payments.orderId` → `orders._id` (Referência lógica, sem FK)

---

### 1.3 Observações sobre Produtos/Categorias

**⚠️ IMPORTANTE:** Não existe coleção de produtos/categorias no backend.

Os produtos estão **hardcoded no frontend** em `pos-frontend/src/constants/index.js`:

```javascript
export const menus = [
  { id: 1, name: "Starters", items: startersItem },
  { id: 2, name: "Main Course", items: mainCourse },
  { id: 3, name: "Beverages", items: beverages },
  { id: 4, name: "Soups", items: soups },
  { id: 5, name: "Desserts", items: desserts },
  { id: 6, name: "Pizzas", items: pizzas },
  { id: 7, name: "Alcoholic Drinks", items: alcoholicDrinks },
  { id: 8, name: "Salads", items: salads }
];
```

**Estrutura de um item:**
```javascript
{
  id: Number,
  name: String,
  price: Number,
  category: String  // "Vegetarian", "Non-Vegetarian", "Cold", "Hot", etc.
}
```

**🔴 GAP IDENTIFICADO:** Para um backend centralizado, será necessário criar:
- Coleção `products` ou `menu_items`
- Coleção `categories`
- API para CRUD de produtos e categorias

---

## 2. Lógica de Negócio

### 2.1 Processamento de uma Venda

O fluxo completo de uma venda ocorre da seguinte forma:

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO DE VENDA COMPLETA                       │
└─────────────────────────────────────────────────────────────────┘

1. SELEÇÃO DE MESA (Tables Page)
   └─→ Usuário seleciona mesa disponível
   └─→ Dispatch: updateTable({ tableId, status: "Booked" })

2. CADASTRO DO CLIENTE (CustomerInfo)
   └─→ Input: nome, telefone, número de pessoas
   └─→ Dispatch: setCustomer({ name, phone, guests })
   └─→ Gera orderId único: Date.now()

3. ADIÇÃO DE ITENS AO CARRINHO (MenuContainer)
   └─→ Usuário navega por categorias
   └─→ Incrementa/decrementa quantidade (máx 4 por item)
   └─→ Dispatch: addItems({ id, name, pricePerQuantity, quantity, price })
   └─→ Preço calculado: price = pricePerQuantity * quantity

4. REVISÃO DO CARRINHO (CartInfo)
   └─→ Lista todos os itens adicionados
   └─→ Permite remover itens individualmente
   └─→ Opção de adicionar notas (FaNotesMedical)

5. CÁLCULO DO TOTAL (Bill Component)
   └─→ Subtotal: Σ(item.price)
   └─→ Taxa: subtotal * 5.25%
   └─→ Total com imposto: subtotal + taxa

6. SELEÇÃO DO PAGAMENTO
   ├─→ Cash: Pagamento em dinheiro
   └─→ Online: Integração com Razorpay

7. FINALIZAÇÃO (handlePlaceOrder)
   ├─→ Valida método de pagamento
   ├─→ Se Online:
   │   ├─→ Carrega SDK Razorpay
   │   ├─→ Cria order: amount * 100 (paisa)
   │   ├─→ Abre checkout modal
   │   └─→ Handler verifica assinatura HMAC-SHA256
   │
   └─→ Cria objeto orderData:
       {
         customerDetails: { name, phone, guests },
         orderStatus: "In Progress",
         bills: { total, tax, totalWithTax },
         items: [...cart],
         table: tableId,
         paymentMethod: "Cash" | "Online",
         paymentData: { razorpay_order_id, razorpay_payment_id } // se online
       }

8. PERSISTÊNCIA
   └─→ POST /api/order
   └─→ Atualiza mesa: PUT /api/table/:id (status: "Booked", currentOrder: orderId)
   └─→ Limpa estado: removeAllItems(), removeCustomer()
   └─→ Exibe invoice (Invoice Component)

9. PÓS-VENDA
   └─→ Pedido aparece em Orders page
   └─→ Status pode ser atualizado: PUT /api/order/:id
```

---

### 2.2 Cálculo do Total

**Localização:** `pos-frontend/src/components/menu/Bill.jsx:35-38`

```javascript
const total = useSelector(getTotalPrice);  // Soma dos preços dos itens
const taxRate = 5.25;                       // Taxa fixa de 5.25%
const tax = (total * taxRate) / 100;        // Cálculo do imposto
const totalPriceWithTax = total + tax;      // Total final
```

**Selector `getTotalPrice`** (`cartSlice.js:23`):
```javascript
export const getTotalPrice = (state) => 
  state.cart.reduce((total, item) => total + item.price, 0);
```

**🔴 GAP:** O cálculo é feito no frontend. Para backend centralizado:
- Mover cálculo para o backend
- Validar preços no servidor (evitar manipulação)
- Suportar taxas variáveis por categoria/região

---

### 2.3 Gestão de Estoque

**⚠️ ESTOQUE NÃO IMPLEMENTADO**

O sistema atual **não possui controle de estoque**. Os produtos são estáticos e não há:
- Contagem de ingredientes
- Baixa automática por venda
- Alerta de estoque baixo
- Bloqueio de item sem estoque

**Recomendação para backend centralizado:**
```javascript
// Schema sugerido para inventory
const inventorySchema = {
  productId: ObjectId,
  ingredient: String,
  quantity: Number,
  unit: String,  // kg, g, L, ml, unidades
  minThreshold: Number,
  lastUpdated: Date
}
```

---

### 2.4 Autenticação e Autorização

**Fluxo de Login:**
```javascript
// 1. POST /api/user/login
{ email, password }

// 2. Backend valida credenciais
const isUserPresent = await User.findOne({ email });
const isMatch = await bcrypt.compare(password, isUserPresent.password);

// 3. Gera JWT token
const accessToken = jwt.sign(
  { _id: user._id }, 
  config.accessTokenSecret, 
  { expiresIn: '1d' }
);

// 4. Set cookie HTTP-only
res.cookie('accessToken', accessToken, {
  maxAge: 1000 * 60 * 60 * 24 * 30,  // 30 dias
  httpOnly: true,
  sameSite: 'none',
  secure: true
});
```

**Middleware de Proteção:** `isVerifiedUser` (`tokenVerification.js`)
- Verifica cookie `accessToken`
- Valida JWT
- Busca usuário no DB
- Injeta `req.user` para controllers subsequentes

**Rotas protegidas:**
- Todas as rotas de Order (CRUD)
- Todas as rotas de Table (CRUD)
- GET /api/user (dados do usuário logado)

---

### 2.5 Integração com Razorpay (Pagamento Online)

**Criação do Pedido:**
```javascript
// POST /api/payment/create-order
const options = {
  amount: amount * 100,  // Converte INR para paisa
  currency: "INR",
  receipt: `receipt_${Date.now()}`
};
const order = await razorpay.orders.create(options);
```

**Verificação do Pagamento:**
```javascript
// POST /api/payment/verify-payment
const expectedSignature = crypto
  .createHmac("sha256", config.razorpaySecretKey)
  .update(razorpay_order_id + "|" + razorpay_payment_id)
  .digest("hex");

if (expectedSignature === razorpay_signature) {
  // Pagamento válido
}
```

**Webhook (assíncrono):**
```javascript
// POST /api/payment/webhook
// Verifica assinatura do evento
// Atualiza coleção payments quando "payment.captured"
```

---

## 3. Fluxos Críticos da Interface PDV

### 3.1 Páginas/Frontes Identificados

| Página | Rota | Componente | Funcionalidade |
|--------|------|------------|----------------|
| **Home** | `/` | `Home.jsx` | Dashboard inicial com métricas e pedidos recentes |
| **Auth** | `/auth` | `Auth.jsx` | Login/Registro |
| **Menu/PDV** | `/menu` | `Menu.jsx` | **Interface principal de vendas** |
| **Mesas** | `/tables` | `Tables.jsx` | Gestão de mesas |
| **Pedidos** | `/orders` | `Orders.jsx` | Lista de pedidos em andamento |
| **Dashboard Admin** | `/dashboard` | `Dashboard.jsx` | Admin (métricas, categorias, pratos) |

---

### 3.2 Interface PDV Principal (Menu.jsx)

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│  Header (Menu, Tables, Orders, Dashboard)                  │
├───────────────────────────┬────────────────────────────────┤
│  ÁREA PRINCIPAL (flex-3)  │  SIDEBAR (flex-1)              │
│                           │                                │
│  ┌─────────────────────┐  │  ┌──────────────────────────┐  │
│  │ Categorias (Grid)   │  │  │ CustomerInfo             │  │
│  │ ┌───┐ ┌───┐ ┌───┐   │  │  │ Nome, #Order, Mesa     │  │
│  │ └───┘ └───┘ └───┘   │  │  └──────────────────────────┘  │
│  └─────────────────────┘  │  ┌──────────────────────────┐  │
│                           │  │ CartInfo                 │  │
│  ┌─────────────────────┐  │  │ Itens do carrinho      │  │
│  │ Itens da Categoria  │  │  │ [Remover] [Notas]      │  │
│  │ ┌─────────────────┐ │  │  │                        │  │
│  │ │ Nome   [🛒]     │ │  │  └──────────────────────────┘  │
│  │ │ ₹100  [- 0 +]   │ │  │  ┌──────────────────────────┐  │
│  │ └─────────────────┘ │  │  │ Bill                   │  │
│  └─────────────────────┘  │  │ Subtotal: ₹XXX         │  │
│                           │  │ Tax (5.25%): ₹XX       │  │
│  [Categorias:]            │  │ Total: ₹XXX            │  │
│  Starters | Main | etc.   │  │ [Cash] [Online]        │  │
│                           │  │ [Print] [Place Order]  │  │
│                           │  └──────────────────────────┘  │
├───────────────────────────┴────────────────────────────────┤
│  BottomNav (Home, Menu, Tables, Orders, Dashboard)         │
└────────────────────────────────────────────────────────────┘
```

---

### 3.3 Funcionalidades Essenciais a Replicar

#### **F1. Gestão de Mesas**
- [ ] Visualizar todas as mesas em grid
- [ ] Status visual (Available = verde, Booked = vermelho)
- [ ] Selecionar mesa para iniciar pedido
- [ ] Exibir cliente atual na mesa ocupada
- [ ] Atualizar status em tempo real

#### **F2. Cadastro de Cliente**
- [ ] Input: nome, telefone, número de convidados
- [ ] Gerar ID do pedido único
- [ ] Persistir no Redux state

#### **F3. Navegação por Categorias**
- [ ] Grid de categorias com ícones e cores
- [ ] Indicador de seleção
- [ ] Contagem de itens por categoria
- [ ] Filtro dinâmico de itens

#### **F4. Adição de Itens**
- [ ] Incremento/decremento (0-4 unidades)
- [ ] Preview da quantidade selecionada
- [ ] Botão "Add to Cart" por item
- [ ] Cálculo automático: price × quantity

#### **F5. Carrinho de Compras**
- [ ] Lista de itens adicionados
- [ ] Exibir quantidade por item
- [ ] Remover item individualmente
- [ ] Adicionar notas/observações (📝)
- [ ] Scroll automático para último item

#### **F6. Cálculo de Totais**
- [ ] Subtotal (soma dos itens)
- [ ] Taxa (5.25% configurável)
- [ ] Total com imposto
- [ ] Atualização em tempo real

#### **F7. Pagamento**
- [ ] Seleção: Cash ou Online
- [ ] Integração Razorpay para Online
- [ ] Validação de método antes de finalizar
- [ ] Verificação de assinatura HMAC

#### **F8. Finalização do Pedido**
- [ ] Criar pedido no backend
- [ ] Atualizar status da mesa
- [ ] Limpar carrinho e cliente
- [ ] Exibir invoice (imprimir)

#### **F9. Acompanhamento de Pedidos**
- [ ] Lista de todos os pedidos
- [ ] Filtro por status (All, In Progress, Ready, Completed)
- [ ] Exibir: cliente, mesa, itens, total, data
- [ ] Atualizar status do pedido

#### **F10. Dashboard Administrativo**
- [ ] Métricas (receita, total clientes, etc.)
- [ ] Adicionar mesa
- [ ] Adicionar categoria **🔴 A IMPLEMENTAR**
- [ ] Adicionar prato **🔴 A IMPLEMENTAR**
- [ ] Gestão de pagamentos

---

## 4. APIs e Endpoints

### 4.1 Endpoints Atuais

| Método | Endpoint | Controller | Descrição | Auth |
|--------|----------|------------|-----------|------|
| **User** |
| POST | `/api/user/register` | `register` | Criar usuário | ❌ |
| POST | `/api/user/login` | `login` | Autenticar | ❌ |
| GET | `/api/user` | `getUserData` | Dados do usuário | ✅ |
| POST | `/api/user/logout` | `logout` | Logout | ❌ |
| **Table** |
| POST | `/api/table/` | `addTable` | Adicionar mesa | ✅ |
| GET | `/api/table` | `getTables` | Listar mesas | ✅ |
| PUT | `/api/table/:id` | `updateTable` | Atualizar mesa | ✅ |
| **Order** |
| POST | `/api/order/` | `addOrder` | Criar pedido | ✅ |
| GET | `/api/order` | `getOrders` | Listar pedidos | ✅ |
| GET | `/api/order/:id` | `getOrderById` | Detalhe do pedido | ✅ |
| PUT | `/api/order/:id` | `updateOrder` | Atualizar status | ✅ |
| **Payment** |
| POST | `/api/payment/create-order` | `createOrder` | Criar ordem Razorpay | ✅ |
| POST | `/api/payment/verify-payment` | `verifyPayment` | Verificar pagamento | ✅ |
| POST | `/api/payment/webhook` | `webHookVerification` | Webhook Razorpay | ❌ |

---

### 4.2 Endpoints Faltantes (Para Backend Centralizado)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| **Product** |
| GET | `/api/product` | Listar todos os produtos |
| GET | `/api/product/:id` | Detalhe do produto |
| POST | `/api/product` | Criar produto |
| PUT | `/api/product/:id` | Atualizar produto |
| DELETE | `/api/product/:id` | Remover produto |
| **Category** |
| GET | `/api/category` | Listar categorias |
| POST | `/api/category` | Criar categoria |
| PUT | `/api/category/:id` | Atualizar categoria |
| DELETE | `/api/category/:id` | Remover categoria |
| **Inventory** |
| GET | `/api/inventory` | Listar estoque |
| PUT | `/api/inventory/:id` | Atualizar estoque |
| **Analytics** |
| GET | `/api/analytics/dashboard` | Métricas do dashboard |
| GET | `/api/analytics/sales` | Relatório de vendas |

---

## 5. Recomendações para Backend Centralizado

### 5.1 Arquitetura Proposta

```
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND CENTRALIZADO                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Products  │  │  Inventory  │  │   Orders    │          │
│  │   Service   │  │   Service   │  │   Service   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Categories │  │   Tables    │  │   Payments  │          │
│  │   Service   │  │   Service   │  │   Service   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐                           │
│  │    Users    │  │  Analytics  │                           │
│  │   Service   │  │   Service   │                           │
│  └─────────────┘  └─────────────┘                           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                      MongoDB Atlas                           │
└─────────────────────────────────────────────────────────────┘
```

---

### 5.2 Schemas Sugeridos

#### **Category Schema**
```javascript
const categorySchema = new Schema({
  name: { type: String, required: true, unique: true },
  icon: { type: String, default: "🍽️" },
  color: { type: String },  // bgColor
  description: String,
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });
```

#### **Product Schema**
```javascript
const productSchema = new Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  category: { type: Schema.Types.ObjectId, ref: "Category" },
  type: { type: String, enum: ["Vegetarian", "Non-Vegetarian", "Vegan"] },
  temperature: { type: String, enum: ["Hot", "Cold", "Room"] },
  isAlcoholic: { type: Boolean, default: false },
  images: [String],
  isActive: { type: Boolean, default: true },
  preparationTime: Number  // em minutos
}, { timestamps: true });
```

#### **Inventory Schema**
```javascript
const inventorySchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: "Product", unique: true },
  ingredients: [{
    name: String,
    quantity: Number,
    unit: String,
    minThreshold: Number
  }],
  stockStatus: { 
    type: String, 
    enum: ["In Stock", "Low Stock", "Out of Stock"],
    default: "In Stock"
  },
  lastRestocked: Date
}, { timestamps: true });
```

---

### 5.3 Validações Críticas (Backend)

1. **Preço do Produto:** Sempre buscar do backend, nunca confiar no frontend
2. **Cálculo de Totais:** Backend recalcula subtotal, taxa e total
3. **Disponibilidade:** Verificar se produto está ativo antes de adicionar
4. **Estoque:** Baixa automática ao confirmar pedido
5. **Mesa:** Validar se mesa existe e está disponível
6. **Pagamento:** Sempre verificar assinatura Razorpay no backend

---

### 5.4 Fluxo de Pedido Atualizado (Backend-Centric)

```
1. Frontend solicita cardápio → GET /api/product?category=...
2. Backend retorna produtos ATIVOS com preços ATUAIS
3. Frontend monta carrinho (apenas referência visual)
4. Ao finalizar, frontend envia APENAS IDs e quantidades:
   POST /api/order {
     customerDetails: {...},
     tableId: "...",
     items: [{ productId: "...", quantity: 2 }, ...],
     paymentMethod: "Online"
   }
5. Backend:
   - Busca preços atuais do DB
   - Valida produtos ativos
   - Verifica estoque
   - Calcula totais
   - Cria pedido
   - Reserva estoque
   - Atualiza mesa
6. Retorna pedido criado com totais oficiais
```

---

### 5.5 Tecnologias Recomendadas

| Camada | Tecnologia | Justificativa |
|--------|------------|---------------|
| API | Node.js + Express | Manter consistência |
| Validação | Joi ou Zod | Schema validation |
| Cache | Redis | Produtos/categorias em cache |
| Fila | Bull/BullMQ | Processamento assíncrono (webhooks, emails) |
| Logs | Winston + Morgan | Observabilidade |
| Testes | Jest + Supertest | Testes automatizados |
| Docs | Swagger/OpenAPI | Documentação de API |
| Real-time | Socket.io | Atualização de mesas/pedidos em tempo real |

---

## 📌 Conclusão

### Pontos Fortes do Sistema Atual
- ✅ Arquitetura MERN consistente
- ✅ Autenticação JWT com cookies HTTP-only
- ✅ Integração Razorpay funcional
- ✅ Separação clara de responsabilidades (controllers, models, routes)
- ✅ Redux para estado global
- ✅ React Query para cache de servidor

### Gaps Identificados
- 🔴 Produtos/categorias hardcoded no frontend
- 🔴 Sem gestão de estoque
- 🔴 Cálculos feitos no frontend (segurança)
- 🔴 Sem validação de disponibilidade
- 🔴 Dashboard admin incompleto

### Próximos Passos para Backend Centralizado
1. Criar schemas de Product e Category
2. Implementar CRUD de produtos/categorias
3. Mover cálculos para o backend
4. Adicionar validações de preço/disponibilidade
5. Implementar sistema de estoque
6. Adicionar WebSockets para atualizações em tempo real
7. Completar dashboard admin

---

*Documento gerado em: 2026-05-20*
*Análise baseada no código fonte do repositório Restaurant_POS_System*
