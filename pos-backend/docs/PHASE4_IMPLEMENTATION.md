# Fase 4: Purchase Orders & Gestão de Compras

## Visão Geral

A Fase 4 implementou o sistema completo de gestão de compras e fornecedores, permitindo:

1. **Fornecedores** - Cadastro e gestão de fornecedores por loja
2. **Pedidos de Compra** - Ciclo completo (draft → pending → sent → confirmed → received)
3. **Recebimento de Mercadoria** - Entrada automática no estoque
4. **Alertas Integrados** - Criar pedidos a partir de alertas de estoque
5. **Histórico de Compras** - Tracking completo de gastos por fornecedor

---

## Arquitetura

### Fluxo do Pedido de Compra

```
┌─────────┐    ┌─────────┐    ┌──────┐    ┌───────────┐    ┌─────────────────┐    ┌──────────┐
│  DRAFT  │───►│ PENDING │───►│ SENT │───►│ CONFIRMED │───►│ PARTIALLY_RECV  │───►│ RECEIVED │
└─────────┘    └─────────┘    └──────┘    └───────────┘    └─────────────────┘    └──────────┘
     │              │              │              │                    │              │
     │              │              │              │                    │              │
     ▼              ▼              ▼              ▼                    ▼              ▼
  Cancelar     Cancelar       Cancelar       Cancelar            Cancelar        (Fim)
```

### Modelo de Dados

```
┌─────────────┐         ┌───────────────────┐
│  Supplier   │◄────────│  PurchaseOrder    │
│             │         │                   │
│ - name      │         │ - orderNumber     │
│ - document  │         │ - status          │
│ - contact   │         │ - items[]         │
│ - rating    │         │ - total           │
└──────┬──────┘         │ - expectedDate    │
       │                └───────────────────┘
       │                          │
       │                          │
       ▼                          ▼
┌─────────────┐         ┌───────────────────┐
│StockBalance │         │  StockMovement    │
│             │         │                   │
│ - balance   │         │ - type: 'in'      │
│ - supplier  │         │ - quantity        │
│             │         │ - reason          │
└─────────────┘         └───────────────────┘
```

---

## Modelos de Dados

### Supplier (Fornecedor)

```javascript
// models/supplierModel.js
const supplierSchema = {
    supplierId: String,         // UUID único
    store: ObjectId,            // Loja proprietária
    name: String,               // Razão social
    tradeName: String,          // Nome fantasia
    document: String,           // CNPJ/CPF
    contact: {
        name: String,           // Nome do contato
        email: String,
        phone: String,
        cellPhone: String
    },
    address: {
        street: String,
        number: String,
        neighborhood: String,
        city: String,
        state: String,
        zipCode: String
    },
    bankInfo: {
        bank: String,
        agency: String,
        account: String
    },
    paymentTerms: {
        defaultDays: Number,    // Dias para pagamento
        discountDays: Number,   // Dias para desconto
        discountPercent: Number // % de desconto
    },
    categories: [String],       // Categorias de produtos
    rating: Number,             // Avaliação (1-5)
    isActive: Boolean
};
```

### PurchaseOrder (Pedido de Compra)

```javascript
// models/purchaseOrderModel.js
const purchaseOrderSchema = {
    orderId: String,            // UUID único
    orderNumber: String,        // Número para referência (PO-1234567890)
    store: ObjectId,            // Loja
    supplier: ObjectId,         // Fornecedor
    status: String,             // draft, pending, sent, confirmed, partially_received, received, cancelled
    items: [{
        ingredient: ObjectId,   // Ingrediente
        quantity: Number,       // Quantidade comprada
        unit: String,           // Unidade
        unitPrice: Number,      // Preço unitário
        totalPrice: Number,     // Preço total (qty * unitPrice)
        receivedQuantity: Number // Quantidade já recebida
    }],
    subtotal: Number,
    discount: Number,
    shipping: Number,
    total: Number,
    expectedDate: Date,         // Data prevista de entrega
    receivedDate: Date,         // Data de recebimento
    paymentTerms: {
        days: Number,
        description: String
    },
    sourceAlert: ObjectId,      // Alerta que originou o pedido
    createdBy: ObjectId,
    approvedBy: ObjectId,
    receivedBy: ObjectId
};
```

---

## Endpoints

### Fornecedores (Suppliers)

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | `/api/supplier` | Listar fornecedores | Admin, Manager |
| GET | `/api/supplier/:id` | Obter fornecedor por ID | Admin, Manager |
| GET | `/api/supplier/stats/:id` | Estatísticas do fornecedor | Admin |
| POST | `/api/supplier` | Criar fornecedor | Admin |
| PUT | `/api/supplier/:id` | Atualizar fornecedor | Admin |
| PATCH | `/api/supplier/:id/status` | Ativar/Desativar | Admin |
| DELETE | `/api/supplier/:id` | Deletar fornecedor | Admin |

### Pedidos de Compra (Purchase Orders)

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | `/api/purchase-orders` | Listar pedidos | Admin, Manager |
| GET | `/api/purchase-orders/stats` | Estatísticas | Admin |
| GET | `/api/purchase-orders/:id` | Obter pedido por ID | Admin, Manager |
| POST | `/api/purchase-orders` | Criar pedido | Admin, Manager |
| PUT | `/api/purchase-orders/:id` | Atualizar pedido | Admin, Manager |
| POST | `/api/purchase-orders/:id/send` | Enviar pedido | Admin, Manager |
| POST | `/api/purchase-orders/:id/confirm` | Confirmar pedido | Admin |
| POST | `/api/purchase-orders/:id/approve` | Aprovar pedido | Admin |
| POST | `/api/purchase-orders/:id/receive` | Receber mercadoria | Admin, Manager |
| POST | `/api/purchase-orders/:id/cancel` | Cancelar pedido | Admin |
| POST | `/api/purchase-orders/from-alert/:alertId` | Criar de alerta | Admin, Manager |

---

## Implementação do Controller

### Criar Fornecedor

```javascript
const createSupplier = async (req, res, next) => {
    try {
        const {
            name, tradeName, document, contact, address,
            paymentTerms, categories, rating, notes
        } = req.body;

        if (!name) {
            throw createHttpError(400, "Name is required!");
        }

        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Verificar documento duplicado
        if (document) {
            const existing = await Supplier.findOne({
                store: storeRef,
                document
            });

            if (existing) {
                throw createHttpError(400, "Supplier with this document already exists!");
            }
        }

        const supplier = await Supplier.create({
            store: storeRef,
            name,
            tradeName,
            document,
            contact,
            address,
            paymentTerms,
            categories,
            rating,
            notes
        });

        // Log de auditoria
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'supplier_created',
            metadata: { supplierName: supplier.name }
        });

        res.status(201).json({
            success: true,
            message: "Supplier created successfully!",
            data: supplier
        });
    } catch (error) {
        next(error);
    }
};
```

### Criar Pedido de Compra

```javascript
const createPurchaseOrder = async (req, res, next) => {
    try {
        const {
            supplier, items, expectedDate, paymentTerms,
            shipping, discount, notes, internalNotes, sourceAlert
        } = req.body;

        // Validações
        if (!supplier) {
            throw createHttpError(400, "Supplier is required!");
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            throw createHttpError(400, "At least one item is required!");
        }

        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;

        // Verificar fornecedor
        const supplierDoc = await Supplier.findOne({
            _id: supplier,
            store: storeRef
        });

        if (!supplierDoc) {
            throw createHttpError(400, "Invalid supplier!");
        }

        // Gerar número do pedido
        const orderNumber = `PO-${Date.now()}`;

        // Validar e preparar itens
        const validatedItems = [];
        for (const item of items) {
            if (!item.ingredientId || !item.quantity || item.quantity <= 0) {
                continue;
            }

            const ingredient = await GlobalIngredient.findById(item.ingredientId);
            if (!ingredient) {
                continue;
            }

            validatedItems.push({
                ingredient: item.ingredientId,
                quantity: item.quantity,
                unit: item.unit || ingredient.baseUnit,
                unitPrice: item.unitPrice || 0,
                totalPrice: (item.quantity || 0) * (item.unitPrice || 0)
            });
        }

        if (validatedItems.length === 0) {
            throw createHttpError(400, "No valid items provided!");
        }

        const order = await PurchaseOrder.create({
            orderNumber,
            store: storeRef,
            supplier,
            status: 'draft',
            items: validatedItems,
            expectedDate: expectedDate ? new Date(expectedDate) : null,
            paymentTerms,
            shipping: shipping || 0,
            discount: discount || 0,
            notes,
            internalNotes,
            createdBy: req.user._id,
            sourceAlert: sourceAlert || null
        });

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: storeRef,
            action: 'purchase_order_created',
            metadata: {
                orderNumber: order.orderNumber,
                supplier: supplierDoc.name
            }
        });

        res.status(201).json({
            success: true,
            message: "Purchase order created successfully!",
            data: order
        });
    } catch (error) {
        next(error);
    }
};
```

### Receber Mercadoria

```javascript
const receivePurchaseOrder = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            throw createHttpError(400, "Items array is required!");
        }

        const order = await PurchaseOrder.findById(id);

        if (!order) {
            throw createHttpError(404, "Purchase order not found!");
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && order.store.toString() !== req.user.store.toString()) {
            throw createHttpError(403, "Access denied!");
        }

        // Validar status
        if (!['sent', 'confirmed', 'partially_received'].includes(order.status)) {
            throw createHttpError(400, `Cannot receive order with status: ${order.status}`);
        }

        // Processar recebimento
        await order.receiveItems(items, req.user._id);

        // Emit WebSocket events
        const io = req.app.get('io');
        for (const item of items) {
            const orderItem = order.items.find(i => i._id.toString() === item.itemId.toString());
            if (orderItem) {
                ws.emitInventoryUpdated(io, order.store, {
                    type: 'stock_in',
                    ingredientId: orderItem.ingredient.toString(),
                    ingredientName: orderItem.ingredient?.name,
                    quantity: item.quantity,
                    balance: orderItem.receivedQuantity,
                    unit: orderItem.unit
                });
            }
        }

        res.status(200).json({
            success: true,
            message: `Items received successfully! Order status: ${order.status}`,
            data: order
        });
    } catch (error) {
        next(error);
    }
};
```

### Criar Pedido a Partir de Alerta

```javascript
const createFromAlert = async (req, res, next) => {
    try {
        const { alertId } = req.params;

        const alert = await StockAlert.findById(alertId)
            .populate('ingredient');

        if (!alert) {
            throw createHttpError(404, "Alert not found!");
        }

        // Verificar permissão de loja
        if (!req.user.isMasterAdmin && alert.store.toString() !== req.user.store.toString()) {
            throw createHttpError(403, "Access denied!");
        }

        // Usar método estático do modelo
        const order = await PurchaseOrder.createFromAlert(alertId, req.user._id);

        const populatedOrder = await PurchaseOrder.findById(order._id)
            .populate('supplier', 'name tradeName')
            .populate('items.ingredient', 'name category');

        // Log
        await SessionLog.create({
            user: req.user._id,
            store: req.user.store,
            action: 'purchase_order_created_from_alert',
            metadata: {
                orderNumber: order.orderNumber,
                alertId
            }
        });

        res.status(201).json({
            success: true,
            message: "Purchase order created from alert successfully!",
            data: populatedOrder
        });
    } catch (error) {
        next(error);
    }
};
```

---

## Service Layer - PurchaseOrder Model

### Método receiveItems

```javascript
// models/purchaseOrderModel.js
purchaseOrderSchema.methods.receiveItems = async function(items, receivedBy) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        for (const item of items) {
            const orderItem = this.items.find(i => 
                i._id.toString() === item.itemId.toString()
            );
            
            if (!orderItem) {
                throw new Error(`Item not found: ${item.itemId}`);
            }

            // Atualizar quantidade recebida
            orderItem.receivedQuantity = (orderItem.receivedQuantity || 0) + item.quantity;

            // Atualizar estoque
            const StockBalance = mongoose.model('StockBalance');
            const StockMovement = mongoose.model('StockMovement');

            let stockBalance = await StockBalance.findOne({
                store: this.store,
                ingredient: orderItem.ingredient
            }).session(session);

            if (!stockBalance) {
                const ingredient = await GlobalIngredient.findById(orderItem.ingredient);
                stockBalance = await StockBalance.create([{
                    store: this.store,
                    ingredient: orderItem.ingredient,
                    balance: 0,
                    unit: ingredient?.baseUnit || orderItem.unit,
                    minimumStock: 0
                }], { session });
                stockBalance = stockBalance[0];
            }

            const balanceBefore = stockBalance.balance;
            stockBalance.balance += item.quantity;
            stockBalance.lastPurchasePrice = orderItem.unitPrice;
            stockBalance.lastPurchaseDate = new Date();
            await stockBalance.save({ session });

            // Criar movimento de estoque
            await StockMovement.create([{
                store: this.store,
                ingredient: orderItem.ingredient,
                type: 'in',
                quantity: item.quantity,
                unit: orderItem.unit,
                balanceBefore,
                balanceAfter: stockBalance.balance,
                reason: `Purchase Order #${this.orderNumber}`,
                user: receivedBy,
                metadata: {
                    purchaseOrderId: this._id,
                    unitPrice: orderItem.unitPrice
                }
            }], { session });
        }

        // Atualizar status do pedido
        this.receivedBy = receivedBy;
        await this.updateStatusFromReceipt();

        await session.commitTransaction();
        return this;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};
```

### Método updateStatusFromReceipt

```javascript
purchaseOrderSchema.methods.updateStatusFromReceipt = function() {
    const totalQuantity = this.items.reduce((acc, item) => acc + item.quantity, 0);
    const receivedQuantity = this.items.reduce((acc, item) => acc + item.receivedQuantity, 0);

    if (receivedQuantity === 0) {
        this.status = 'sent';
    } else if (receivedQuantity >= totalQuantity) {
        this.status = 'received';
        this.receivedDate = new Date();
    } else {
        this.status = 'partially_received';
    }

    return this.save();
};
```

---

## Arquivos Criados

### Novos Modelos

| Arquivo | Descrição |
|---------|-----------|
| `models/supplierModel.js` | Schema de fornecedores |
| `models/purchaseOrderModel.js` | Schema de pedidos de compra |

### Novos Controllers

| Arquivo | Descrição |
|---------|-----------|
| `controllers/supplierController.js` | CRUD de fornecedores |
| `controllers/purchaseOrderController.js` | Gestão de pedidos de compra |

### Novas Rotas

| Arquivo | Descrição |
|---------|-----------|
| `routes/supplierRoutes.js` | Rotas de fornecedores |
| `routes/purchaseOrderRoutes.js` | Rotas de pedidos de compra |

### Arquivos Modificados

| Arquivo | Modificação |
|---------|-------------|
| `app.js` | Registro de novas rotas |
| `models/stockAlertModel.js` | Adicionado campo `purchaseOrder` |

---

## Fluxo de Uso

### 1. Cadastrar Fornecedor

```bash
# Criar fornecedor
curl -X POST http://localhost:8000/api/supplier \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Distribuidora de Alimentos LTDA",
    "tradeName": "Distribuidora Silva",
    "document": "12.345.678/0001-90",
    "contact": {
      "name": "João Silva",
      "email": "joao@distribuidora.com",
      "phone": "(11) 3333-4444"
    },
    "categories": ["proteina", "laticinio"],
    "paymentTerms": {
      "defaultDays": 30,
      "discountDays": 10,
      "discountPercent": 5
    }
  }'
```

### 2. Criar Pedido de Compra

```bash
# Criar pedido
curl -X POST http://localhost:8000/api/purchase-orders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "supplier": "<supplier-id>",
    "items": [
      {
        "ingredientId": "<carne-bovina-id>",
        "quantity": 50,
        "unit": "kg",
        "unitPrice": 35.00
      },
      {
        "ingredientId": "<queijo-mussarela-id>",
        "quantity": 30,
        "unit": "kg",
        "unitPrice": 45.00
      }
    ],
    "expectedDate": "2026-05-28",
    "paymentTerms": {
      "days": 30,
      "description": "Pagamento em 30 dias"
    }
  }'
```

### 3. Enviar Pedido

```bash
# Enviar pedido ao fornecedor
curl -X POST http://localhost:8000/api/purchase-orders/<order-id>/send \
  -H "Authorization: Bearer <token>"
```

### 4. Confirmar Pedido

```bash
# Confirmar pedido (após fornecedor confirmar)
curl -X POST http://localhost:8000/api/purchase-orders/<order-id>/confirm \
  -H "Authorization: Bearer <token>"
```

### 5. Receber Mercadoria

```bash
# Receber itens do pedido
curl -X POST http://localhost:8000/api/purchase-orders/<order-id>/receive \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "itemId": "<item-id-1>",
        "quantity": 50
      },
      {
        "itemId": "<item-id-2>",
        "quantity": 25
      }
    ]
  }'
```

### 6. Criar Pedido a Partir de Alerta

```bash
# Primeiro, verificar alertas
curl http://localhost:8000/api/stock/alerts?status=pending \
  -H "Authorization: Bearer <token>"

# Criar pedido a partir do alerta
curl -X POST http://localhost:8000/api/purchase-orders/from-alert/<alert-id> \
  -H "Authorization: Bearer <token>"
```

---

## Estatísticas

### Estatísticas de Fornecedor

```javascript
// GET /api/supplier/stats/:id
{
    "success": true,
    "data": {
        "totalOrders": 15,
        "pendingOrders": 2,
        "totalPurchases": 25750.00,
        "averageOrderValue": 1716.67
    }
}
```

### Estatísticas de Pedidos

```javascript
// GET /api/purchase-orders/stats
{
    "success": true,
    "data": {
        "total": 25,
        "draft": 3,
        "pending": 2,
        "sent": 5,
        "received": 12,
        "cancelled": 1,
        "late": 2,
        "totalSpent": 45230.50
    }
}
```

---

## WebSocket Integration

### Eventos Emitidos

Quando um pedido de compra é recebido, o sistema emite eventos de atualização de estoque:

```javascript
// controllers/purchaseOrderController.js - receivePurchaseOrder
const io = req.app.get('io');
for (const item of items) {
    const orderItem = order.items.find(i => i._id.toString() === item.itemId.toString());
    if (orderItem) {
        ws.emitInventoryUpdated(io, storeRef, {
            type: 'stock_in',
            ingredientId: orderItem.ingredient.toString(),
            ingredientName: orderItem.ingredient?.name,
            quantity: item.quantity,
            balance: orderItem.receivedQuantity,
            unit: orderItem.unit
        });
    }
}
```

---

## Validações e Regras de Negócio

### Regras de Status

| Status | Pode Editar | Pode Enviar | Pode Confirmar | Pode Receber | Pode Cancelar |
|--------|-------------|-------------|----------------|--------------|---------------|
| draft | Sim | Sim | Não | Não | Sim |
| pending | Sim | Sim | Não | Não | Sim |
| sent | Não | Não | Sim | Não | Sim |
| confirmed | Não | Não | Não | Sim | Sim |
| partially_received | Não | Não | Não | Sim | Sim |
| received | Não | Não | Não | Não | Não |
| cancelled | Não | Não | Não | Não | Não |

### Validações de Criação

- Fornecedor deve existir e pertencer à mesma loja
- Pelo menos 1 item válido é necessário
- Quantidade deve ser positiva
- Ingrediente deve existir no catálogo global

### Validações de Recebimento

- Pedido deve estar em status `sent`, `confirmed` ou `partially_received`
- Quantidade recebida não pode exceder quantidade pedida
- Transação atômica garante consistência do estoque

---

## Troubleshooting

### Problema: Não consegue criar pedido

**Causa**: Fornecedor não existe ou não pertence à loja

**Solução**: Verificar se o fornecedor foi criado para a loja correta

### Problema: Erro ao receber mercadoria

**Causa**: Status do pedido não permite recebimento

**Solução**: Verificar status atual do pedido antes de receber

### Problema: Estoque não atualiza

**Causa**: Erro na transação ou item não encontrado

**Solução**: Verificar logs e garantir que `itemId` corresponde ao item do pedido

### Problema: Não pode deletar fornecedor

**Causa**: Fornecedor tem pedidos de compra vinculados

**Solução**: Desativar fornecedor ao invés de deletar, ou remover pedidos primeiro

---

## Próximos Passos (Fase 5)

Com a Fase 4 completa, o sistema está pronto para:

1. **Dashboard & Analytics** - Métricas de compras, gastos por fornecedor
2. **Relatórios** - Exportação de dados de compras
3. **Previsão de Demanda** - Sugestão automática de compras baseada em histórico
4. **Integração Fiscal** - Notas fiscais e documentação de compras

---

## Referências

- [PHASE3_IMPLEMENTATION.md](./PHASE3_IMPLEMENTATION.md) - WebSockets
- [PHASE2_IMPLEMENTATION.md](./PHASE2_IMPLEMENTATION.md) - Gestão de Estoque
- [WEBSOCKETS.md](../WEBSOCKETS.md) - Catálogo de eventos

---

*Documentação criada em: 2026-05-21*
