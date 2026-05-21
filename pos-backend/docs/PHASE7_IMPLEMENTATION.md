# Fase 7: Kitchen Display System (KDS)

## Visão Geral

A Fase 7 implementou um sistema completo de exibição de cozinha (Kitchen Display System) para gestão de pedidos em tempo real, substituindo impressoras de comandas por telas digitais com:

1. **Filas de Pedidos** - Visualização organizada por estação e tempo
2. **Múltiplas Estações** - Cozinha, Bar, Sobremesas, Expedição
3. **Timers e SLA** - Controle de tempo de preparo e alertas de atraso
4. **Priorização** - Pedidos urgentes, VIP e normais
5. **Status por Item** - Acompanhamento granular de cada item
6. **WebSocket em Tempo Real** - Atualizações automáticas em todas as telas
7. **Roteamento Automático** - Itens direcionados para estações corretas

---

## Arquitetura

### Fluxo do Pedido no KDS

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│   Pedido    │───►│  Sincronizar │───►│  Aceitar    │───►│  Preparar   │
│   (POS)     │    │    KDS       │    │  Cozinha    │    │  (Timer)    │
└─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘
                                                      │
                                                      ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Servido   │◄───│    Pronto    │◄───│  Item Ready │
│  (Garçom)   │    │ (Expedição)  │    │  (Chef)     │
└─────────────┘    └──────────────┘    └─────────────┘
```

### Estações do KDS

```
┌─────────────────────────────────────────────────────────────┐
│                        KITCHEN DISPLAY                      │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│   COZINHA   │     BAR     │  SOBREMESAS │    EXPEDIÇÃO      │
│   (Hot)     │   (Cold)    │   (Dessert) │    (Expo)         │
├─────────────┼─────────────┼─────────────┼───────────────────┤
│ • Pratos    │ • Bebidas   │ • Doces     │ • Conferência     │
│   quentes   │   geladas   │ • Sobremesas│ • Montagem        │
│ • Entradas  │ • Drinks    │ • Cafés     │ • Distribuição    │
│ • Principais│ • Sucos     │             │ • Garçons         │
└─────────────┴─────────────┴─────────────┴───────────────────┘
```

---

## Modelos de Dados

### KDSConfig (Configuração)

```javascript
// models/kdsConfigModel.js
const kdsConfigSchema = {
    store: ObjectId,              // Loja proprietária
    isEnabled: Boolean,           // KDS habilitado
    stations: [{
        id: String,               // kitchen, bar, dessert, expo
        name: String,             // Nome exibido
        type: String,             // kitchen, bar, dessert, expo
        displayOrder: Number,     // Ordem de exibição
        autoRouteItems: Boolean,  // Roteamento automático
        itemCategories: [ObjectId], // Categorias de itens
        isActive: Boolean,
        displaySettings: {
            theme: String,        // light, dark
            showItemImages: Boolean,
            showModifiers: Boolean,
            highlightAllergens: Boolean,
            soundEnabled: Boolean
        }
    }],
    defaultStation: String,       // Estação padrão
    slaSettings: {
        defaultPrepTime: Number,  // Tempo padrão (minutos)
        urgentThreshold: Number,  // Minutos para urgente
        lateThreshold: Number     // Minutos para atraso
    },
    displaySettings: {
        refreshInterval: Number,  // Segundos
        showOrderNumber: Boolean,
        showTableNumber: Boolean,
        showTimer: Boolean,
        groupByTable: Boolean,
        sortOrdersBy: String      // time, table, priority
    }
};
```

### KDSOrder (Pedido KDS)

```javascript
// models/kdsOrderModel.js
const kdsOrderSchema = {
    kdsOrderId: String,           // ID único
    store: ObjectId,
    order: ObjectId,              // Pedido original
    orderNumber: String,
    table: ObjectId,
    tableNumber: String,
    customerName: String,
    orderType: String,            // dine-in, takeout, delivery
    items: [{
        orderItem: ObjectId,
        productId: ObjectId,
        productName: String,
        quantity: Number,
        status: String,           // pending, preparing, ready, served, cancelled
        station: String,          // kitchen, bar, dessert, expo
        prepTimeMinutes: Number,
        startedAt: Date,
        completedAt: Date,
        servedAt: Date,
        notes: String,
        modifiers: [{ name, extra }],
        priority: String          // normal, urgent, vip
    }],
    status: String,               // pending, preparing, partially_ready, ready, served, cancelled
    priority: String,             // normal, urgent, vip
    estimatedReady: Date,
    actualReady: Date,
    servedAt: Date,
    acceptedAt: Date,
    acceptedBy: ObjectId,
    stations: [{
        station: String,
        status: String,
        startedAt: Date,
        completedAt: Date
    }],
    timers: {
        createdAt: Date,
        acceptedAt: Date,
        firstPrepAt: Date,
        readyAt: Date,
        servedAt: Date
    },
    flags: {
        isRushed: Boolean,
        isRefire: Boolean,        // Refeita (erro cozinha)
        is86: Boolean,            // Sem estoque
        allergyAlert: Boolean
    }
};
```

---

## Endpoints

### Configuração

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | `/api/kds/config` | Obter configuração KDS | Auth |
| PUT | `/api/kds/config` | Atualizar configuração | Admin |

### Pedidos KDS

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | `/api/kds/orders` | Listar pedidos da cozinha | Auth |
| GET | `/api/kds/orders/:id` | Detalhes do pedido | Auth |
| POST | `/api/kds/orders/sync` | Sincronizar pedido do POS | Auth |

### Ações

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| POST | `/api/kds/orders/:id/accept` | Aceitar pedido | Kitchen |
| POST | `/api/kds/orders/:id/items/:itemId/status` | Atualizar item | Kitchen |
| POST | `/api/kds/orders/:id/ready` | Marcar como pronto | Kitchen |
| POST | `/api/kds/orders/:id/served` | Marcar como servido | Expo/Garçom |
| POST | `/api/kds/orders/:id/rush` | Priorizar pedido | Admin/Manager |
| POST | `/api/kds/orders/:id/cancel` | Cancelar pedido | Admin |

### Estatísticas

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | `/api/kds/stats/station` | Estatísticas da estação | Admin |

---

## Implementação do Controller

### Obter Pedidos da Cozinha

```javascript
const getKitchenOrders = async (req, res, next) => {
    try {
        const { station = 'kitchen', status, tableId } = req.query;
        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        const orders = await KDSOrder.getKitchenOrders(storeRef, station, {
            status,
            tableId,
            limit: 100
        });

        // Calcular tempos para cada pedido
        const ordersWithTimers = orders.map(order => ({
            ...order.toObject(),
            elapsedMinutes: order.elapsedMinutes,
            minutesUntilReady: order.minutesUntilReady,
            isLate: order.isLate,
            isUrgent: order.isUrgent
        }));

        res.status(200).json({
            success: true,
            count: ordersWithTimers.length,
            data: ordersWithTimers
        });
    } catch (error) {
        next(error);
    }
};
```

### Aceitar Pedido

```javascript
const acceptKDSOrder = async (req, res, next) => {
    try {
        const { id } = req.params;

        const order = await KDSOrder.findOne({ kdsOrderId: id });

        if (!order) {
            throw createHttpError(404, "KDS order not found!");
        }

        if (order.status !== 'pending') {
            throw createHttpError(400, `Order already ${order.status}!`);
        }

        await order.accept(req.user._id);
        order.calculateEstimatedReady();
        await order.save();

        // Emit WebSocket event
        const io = req.app.get('io');
        ws.emitOrderStatusChanged(io, order.store, {
            _id: order.order,
            orderStatus: 'preparing'
        }, 'pending');

        res.status(200).json({
            success: true,
            message: "Order accepted!",
            data: order
        });
    } catch (error) {
        next(error);
    }
};
```

### Atualizar Status do Item

```javascript
const updateItemStatus = async (req, res, next) => {
    try {
        const { id, itemId } = req.params;
        const { status, station } = req.body;

        const order = await KDSOrder.findOne({ kdsOrderId: id });

        if (!order) {
            throw createHttpError(404, "KDS order not found!");
        }

        await order.updateItemStatus(itemId, status, station);

        // Verificar se todos itens da estação estão prontos
        const stationItems = order.items.filter(i => i.station === station);
        const allReady = stationItems.every(i => i.status === 'ready' || i.status === 'served');

        if (allReady && stationItems.length > 0) {
            const stationData = order.stations.find(s => s.station === station);
            if (stationData) {
                stationData.status = 'ready';
                stationData.completedAt = new Date();
                await order.save();
            }
        }

        // Emit WebSocket event
        const io = req.app.get('io');
        io.to(`store:${order.store}`).emit('kds:item-updated', {
            kdsOrderId: order.kdsOrderId,
            itemId,
            status,
            station,
            timestamp: new Date().toISOString()
        });

        res.status(200).json({
            success: true,
            message: `Item ${status}!`,
            data: order
        });
    } catch (error) {
        next(error);
    }
};
```

### Sincronizar Pedido do POS

```javascript
const syncOrderToKDS = async (req, res, next) => {
    try {
        const { orderId } = req.body;

        const order = await Order.findById(orderId).populate('table', 'name number');

        if (!order) {
            throw createHttpError(404, "Order not found!");
        }

        const storeRef = req.user.isMasterAdmin && req.storeId ? req.storeId : req.user.store;

        // Verificar se já existe
        let kdsOrder = await KDSOrder.findOne({ order: orderId });

        if (kdsOrder) {
            // Atualizar existente
            kdsOrder.orderType = order.orderType || 'dine-in';
            kdsOrder.table = order.table?._id;
            kdsOrder.tableNumber = order.table?.number;
            kdsOrder.customerName = order.customerDetails?.name;
            await kdsOrder.save();
        } else {
            // Criar novo
            const config = await KDSConfig.getStoreConfig(storeRef);

            const items = order.items.map(item => ({
                orderItem: item._id,
                productId: item.product,
                productName: item.name,
                quantity: item.quantity,
                station: config.defaultStation,
                prepTimeMinutes: config.slaSettings?.defaultPrepTime || 15,
                notes: item.notes,
                modifiers: item.modifiers || []
            }));

            kdsOrder = await KDSOrder.create({
                store: storeRef,
                order: orderId,
                orderNumber: order.orderNumber || `ORD-${Date.now()}`,
                table: order.table?._id,
                tableNumber: order.table?.number,
                customerName: order.customerDetails?.name,
                orderType: order.orderType || 'dine-in',
                items,
                estimatedReady: new Date(Date.now() + (config.slaSettings?.defaultPrepTime || 15) * 60000)
            });
        }

        // Emit WebSocket event
        const io = req.app.get('io');
        io.to(`store:${storeRef}`).emit('kds:order-synced', {
            kdsOrderId: kdsOrder.kdsOrderId,
            orderNumber: kdsOrder.orderNumber,
            itemsCount: kdsOrder.items.length
        });

        res.status(200).json({
            success: true,
            message: "Order synced to KDS!",
            data: kdsOrder
        });
    } catch (error) {
        next(error);
    }
};
```

---

## WebSocket Events

### Eventos do KDS

| Evento | Payload | Quando |
|--------|---------|--------|
| `kds:order-synced` | `{ kdsOrderId, orderNumber, tableNumber, itemsCount }` | Novo pedido sincronizado |
| `kds:item-updated` | `{ kdsOrderId, itemId, status, station }` | Item atualizado |
| `kds:order-ready` | `{ kdsOrderId, orderNumber, tableNumber }` | Pedido pronto |
| `kds:order-served` | `{ kdsOrderId, orderNumber }` | Pedido servido |
| `kds:order-rushed` | `{ kdsOrderId, orderNumber, priority }` | Pedido priorizado |
| `kds:order-cancelled` | `{ kdsOrderId, orderNumber, reason }` | Pedido cancelado |

### Frontend Integration

```javascript
// hooks/useKDS.js
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const useKDS = (storeId, station = 'kitchen') => {
    const socket = useRef(null);

    useEffect(() => {
        socket.current = io('http://localhost:8000', {
            withCredentials: true
        });

        socket.current.emit('join:store', storeId);

        // Listeners
        socket.current.on('kds:order-synced', (data) => {
            console.log('Novo pedido:', data);
            // Tocar som de notificação
            // Atualizar fila
        });

        socket.current.on('kds:item-updated', (data) => {
            console.log('Item atualizado:', data);
            // Atualizar item na tela
        });

        socket.current.on('kds:order-ready', (data) => {
            console.log('Pedido pronto:', data);
            // Tocar som de pedido pronto
            // Mover para seção "Ready"
        });

        socket.current.on('kds:order-rushed', (data) => {
            console.log('Pedido urgente:', data);
            // Mover para topo da fila
            // Mostrar alerta visual
        });

        return () => {
            socket.current.emit('leave:store', storeId);
            socket.current.disconnect();
        };
    }, [storeId, station]);

    return socket.current;
};
```

---

## Exemplos de Uso

### 1. Obter Configuração

```bash
curl http://localhost:8000/api/kds/config \
  -H "Authorization: Bearer <token>"
```

### 2. Listar Pedidos da Cozinha

```bash
# Todos os pedidos da cozinha
curl "http://localhost:8000/api/kds/orders?station=kitchen" \
  -H "Authorization: Bearer <token>"

# Apenas pedidos em preparo
curl "http://localhost:8000/api/kds/orders?station=kitchen&status=preparing" \
  -H "Authorization: Bearer <token>"
```

**Resposta:**
```json
{
    "success": true,
    "count": 5,
    "data": [
        {
            "kdsOrderId": "kds_1716307200000_abc123",
            "orderNumber": "ORD-123",
            "tableNumber": "5",
            "customerName": "João Silva",
            "orderType": "dine-in",
            "status": "preparing",
            "priority": "normal",
            "items": [
                {
                    "productName": "Hambúrguer Artesanal",
                    "quantity": 2,
                    "status": "preparing",
                    "station": "kitchen",
                    "prepTimeMinutes": 15,
                    "startedAt": "2026-05-21T12:30:00.000Z"
                },
                {
                    "productName": "Batata Frita",
                    "quantity": 1,
                    "status": "ready",
                    "station": "kitchen",
                    "completedAt": "2026-05-21T12:35:00.000Z"
                }
            ],
            "elapsedMinutes": 8,
            "minutesUntilReady": 7,
            "isLate": false,
            "isUrgent": false,
            "estimatedReady": "2026-05-21T12:45:00.000Z"
        }
    ]
}
```

### 3. Aceitar Pedido

```bash
curl -X POST http://localhost:8000/api/kds/orders/kds_123/accept \
  -H "Authorization: Bearer <token>"
```

### 4. Atualizar Status do Item

```bash
# Iniciar preparo
curl -X POST http://localhost:8000/api/kds/orders/kds_123/items/item_456/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "preparing", "station": "kitchen"}'

# Marcar como pronto
curl -X POST http://localhost:8000/api/kds/orders/kds_123/items/item_456/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "ready", "station": "kitchen"}'
```

### 5. Marcar Pedido como Pronto

```bash
curl -X POST http://localhost:8000/api/kds/orders/kds_123/ready \
  -H "Authorization: Bearer <token>"
```

### 6. Priorizar Pedido (Rush)

```bash
curl -X POST http://localhost:8000/api/kds/orders/kds_123/rush \
  -H "Authorization: Bearer <token>"
```

### 7. Estatísticas da Estação

```bash
curl "http://localhost:8000/api/kds/stats/station?station=kitchen" \
  -H "Authorization: Bearer <token>"
```

**Resposta:**
```json
{
    "success": true,
    "data": {
        "pending": 3,
        "preparing": 5,
        "ready": 2,
        "served": 45,
        "cancelled": 1,
        "avgPrepMinutes": 12,
        "totalOrders": 56
    }
}
```

---

## Configuração de Estações

### Estações Pré-configuradas

| ID | Nome | Tipo | Categorias Típicas |
|----|------|------|-------------------|
| kitchen | Cozinha | kitchen | Pratos principais, Entradas, Acompanhamentos |
| bar | Bar | bar | Bebidas, Drinks, Sucos, Cafés |
| dessert | Sobremesas | dessert | Sobremesas, Doces |
| expo | Expedição | expo | Conferência final |

### Configurar Roteamento Automático

```bash
curl -X PUT http://localhost:8000/api/kds/config \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "stations": [
      {
        "id": "kitchen",
        "name": "Cozinha Quente",
        "type": "kitchen",
        "autoRouteItems": true,
        "itemCategories": ["65f1234567890abcdef12340"],
        "isActive": true
      },
      {
        "id": "bar",
        "name": "Bar",
        "type": "bar",
        "autoRouteItems": true,
        "itemCategories": ["65f1234567890abcdef12341"],
        "isActive": true
      }
    ]
  }'
```

---

## Flags e Alertas

### Tipos de Flags

| Flag | Descrição | Uso |
|------|-----------|-----|
| `isRushed` | Pedido prioritário | Cliente VIP, tempo curto |
| `isRefire` | Pedido refeita | Cozinha errou, cliente não gostou |
| `is86` | Sem estoque | Ingrediente esgotado |
| `allergyAlert` | Alerta de alergia | Cliente tem alergia |

### Prioridades

| Prioridade | Descrição | Exibição |
|------------|-----------|----------|
| normal | Pedido padrão | Cor normal |
| urgent | Urgente (< 5 min) | Laranja, topo da fila |
| vip | Cliente VIP | Roxo, destaque |

---

## Métricas e KPIs

### Tempo de Preparo

```javascript
// Tempo médio de preparo por estação
avgPrepTime = (readyAt - acceptedAt) / 60000 // minutos

// Tempo decorrido desde criação
elapsedMinutes = (now - createdAt) / 60000

// Tempo até ficar pronto
minutesUntilReady = (estimatedReady - now) / 60000
```

### SLA de Cozinha

| Métrica | Target | Alerta |
|---------|--------|--------|
| Tempo médio preparo | < 15 min | > 20 min |
| Pedidos atrasados | < 5% | > 10% |
| Pedidos cancelados | < 2% | > 5% |

---

## Arquivos Criados

### Novos Modelos

| Arquivo | Descrição |
|---------|-----------|
| `models/kdsConfigModel.js` | Configuração do KDS |
| `models/kdsOrderModel.js` | Pedidos do KDS |

### Novos Controllers

| Arquivo | Descrição |
|---------|-----------|
| `controllers/kdsController.js` | Gestão do KDS |

### Novas Rotas

| Arquivo | Descrição |
|---------|-----------|
| `routes/kdsRoutes.js` | Rotas do KDS |

### Arquivos Modificados

| Arquivo | Modificação |
|---------|-------------|
| `app.js` | Registro das rotas KDS |
| `services/websocketService.js` +6 eventos KDS |

---

## Troubleshooting

### Problema: Pedido não aparece no KDS

**Causa**: Pedido não foi sincronizado

**Solução**: Usar endpoint `/api/kds/orders/sync` após criar pedido

### Problema: Timer não inicia

**Causa**: Pedido não foi aceito

**Solução**: Chamar endpoint `/api/kds/orders/:id/accept`

### Problema: Item não atualiza

**Causa**: itemId incorreto ou item não existe

**Solução**: Verificar itemId no payload do pedido

### Problema: WebSocket não atualiza telas

**Causa**: Cliente não entrou na room da loja

**Solução**: Emitir `socket.emit('join:store', storeId)` no frontend

---

## Próximos Passos

1. **Integração com Hardware** - Telas touch, botões físicos
2. **Modo Offline** - Cache local para quedas de rede
3. **Relatórios de Performance** - Tempo por chef, estação
4. **Previsão com IA** - Estimativa dinâmica de tempo

---

## Referências

- [PHASE3_IMPLEMENTATION.md](./PHASE3_IMPLEMENTATION.md) - WebSockets
- [WEBSOCKETS.md](../WEBSOCKETS.md) - Catálogo de eventos

---

*Documentação criada em: 2026-05-21*
