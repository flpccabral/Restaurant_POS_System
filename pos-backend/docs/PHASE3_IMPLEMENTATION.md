# Fase 3: WebSockets & Comunicação em Tempo Real

## Visão Geral

A Fase 3 implementou comunicação em tempo real via Socket.io para notificações instantâneas de:

1. **Pedidos** - Criação, atualização e mudança de status
2. **Estoque** - Entradas, saídas, ajustes e baixas de receitas
3. **Produtos** - Disponibilidade de cardápio
4. **Alertas** - Notificações de estoque baixo
5. **Dispositivos** - Aprovação de novos dispositivos

---

## Arquitetura

### Padrão de Comunicação

```
┌─────────────┐     WebSocket      ┌─────────────┐
│   Frontend  │ ◄────────────────► │   Backend   │
│   (Cliente) │                    │  (Socket.io)│
└─────────────┘                    └─────────────┘
       │                                  │
       │ join:store                       │ emit para room
       ▼                                  ▼
┌─────────────┐                    ┌─────────────┐
│ store:xyz   │ ◄──────────────────│  io.to()    │
│   (Room)    │                    │             │
└─────────────┘                    └─────────────┘
```

### Room-based Pub/Sub

Cada loja possui uma room exclusiva. Clientes se inscrevem nas rooms das lojas que têm acesso.

```javascript
// Cliente entra na room da loja
socket.emit('join:store', storeId);

// Servidor envia para todos na room
io.to(`store:${storeId}`).emit('order:created', data);
```

---

## Configuração do Socket.io

### Backend (app.js)

```javascript
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [config.socketCorsOrigin || "http://localhost:5173"],
        credentials: true
    }
});

app.set('io', io); // Acessível via req.app.get('io')

io.on('connection', (socket) => {
    console.log(`[WebSocket] Socket connected: ${socket.id}`);
    
    // Entrar em room de loja única
    socket.on('join:store', (storeId) => {
        socket.join(`store:${storeId}`);
        console.log(`[WebSocket] Socket ${socket.id} joined store:${storeId}`);
    });
    
    // Entrar em múltiplas rooms (usuários multi-loja)
    socket.on('join:stores', (storeIds) => {
        if (Array.isArray(storeIds)) {
            storeIds.forEach(id => {
                socket.join(`store:${id}`);
                console.log(`[WebSocket] Socket ${socket.id} joined store:${id}`);
            });
        }
    });
    
    // Sair de room
    socket.on('leave:store', (storeId) => {
        socket.leave(`store:${storeId}`);
        console.log(`[WebSocket] Socket ${socket.id} left store:${storeId}`);
    });
    
    // Error handler
    socket.on('error', (error) => {
        console.error(`[WebSocket] Error on socket ${socket.id}:`, error.message);
    });
});
```

### Variáveis de Ambiente

```bash
# .env
SOCKET_CORS_ORIGIN=http://localhost:5173
```

---

## Service Layer - websocketService.js

### Estrutura

```javascript
// services/websocketService.js

/**
 * Emitir evento de pedido criado
 */
const emitOrderCreated = (io, order) => {
    io.to(`store:${order.store}`).emit('order:created', {
        orderId: order._id,
        storeId: order.store,
        tableId: order.table,
        orderNumber: order.orderNumber,
        items: order.items,
        total: order.total,
        status: order.status,
        createdAt: order.createdAt
    });
    console.log(`[WebSocket] order:created emitted for store ${order.store}`);
};

/**
 * Emitir evento de pedido atualizado
 */
const emitOrderUpdated = (io, order) => {
    io.to(`store:${order.store}`).emit('order:updated', {
        orderId: order._id,
        storeId: order.store,
        updates: order
    });
    console.log(`[WebSocket] order:updated emitted for order ${order._id}`);
};

/**
 * Emitir evento de mudança de status
 */
const emitOrderStatusChanged = (io, storeId, order, oldStatus) => {
    io.to(`store:${storeId}`).emit('order:status-changed', {
        orderId: order._id,
        storeId: storeId,
        oldStatus: oldStatus,
        newStatus: order.orderStatus,
        timestamp: new Date().toISOString()
    });
    console.log(`[WebSocket] order:status-changed emitted: ${oldStatus} → ${order.orderStatus}`);
};

/**
 * Emitir evento de atualização de estoque
 */
const emitInventoryUpdated = (io, storeId, data) => {
    io.to(`store:${storeId}`).emit('inventory:updated', {
        storeId: storeId,
        type: data.type, // 'stock_in', 'stock_out', 'adjustment', 'recipe_deduction'
        ingredientId: data.ingredientId,
        ingredientName: data.ingredientName,
        quantity: data.quantity,
        balance: data.balance,
        unit: data.unit,
        timestamp: new Date().toISOString()
    });
    console.log(`[WebSocket] inventory:updated emitted for ingredient ${data.ingredientId}`);
};

/**
 * Emitir evento de disponibilidade de produto
 */
const emitProductAvailability = (io, storeId, data) => {
    io.to(`store:${storeId}`).emit('product:availability', {
        storeId: storeId,
        productId: data.productId,
        productName: data.productName,
        isActive: data.isActive,
        isCurrent: data.isCurrent,
        timestamp: new Date().toISOString()
    });
    console.log(`[WebSocket] product:availability emitted for product ${data.productId}`);
};

/**
 * Emitir evento de alerta criado
 */
const emitAlertCreated = (io, alert) => {
    io.to(`store:${alert.store}`).emit('alert:created', {
        alertId: alert._id,
        storeId: alert.store,
        type: alert.type, // 'low_stock', 'out_of_stock'
        severity: alert.severity,
        ingredientName: alert.ingredient?.name,
        currentBalance: alert.currentBalance,
        minimumStock: alert.minimumStock,
        timestamp: new Date().toISOString()
    });
    console.log(`[WebSocket] alert:created emitted for alert ${alert._id}`);
};

/**
 * Emitir evento de receita produzida
 */
const emitRecipeProduced = (io, storeId, data) => {
    io.to(`store:${storeId}`).emit('recipe:produced', {
        storeId: storeId,
        recipeId: data.recipeId,
        recipeName: data.recipeName,
        sku: data.sku,
        quantity: data.quantity,
        ingredients: data.ingredients,
        timestamp: new Date().toISOString()
    });
    console.log(`[WebSocket] recipe:produced emitted for recipe ${data.recipeId}`);
};

/**
 * Emitir evento de dispositivo aprovado
 */
const emitDeviceApproved = (io, device) => {
    io.to(`store:${device.store}`).emit('device:approved', {
        deviceId: device._id,
        storeId: device.store,
        isApproved: true,
        timestamp: new Date().toISOString()
    });
    console.log(`[WebSocket] device:approved emitted for device ${device._id}`);
};

module.exports = {
    emitOrderCreated,
    emitOrderUpdated,
    emitOrderStatusChanged,
    emitInventoryUpdated,
    emitProductAvailability,
    emitAlertCreated,
    emitRecipeProduced,
    emitDeviceApproved
};
```

---

## Integração nos Controllers

### Order Controller

```javascript
// controllers/orderController.js
const ws = require("../services/websocketService");

const addOrder = async (req, res, next) => {
    try {
        const order = new Order(req.body);
        await order.save();
        
        // Emit WebSocket event
        const io = req.app.get('io');
        ws.emitOrderCreated(io, order);
        
        res.status(201).json({
            success: true,
            message: "Order created successfully!",
            data: order
        });
    } catch (error) {
        next(error);
    }
};

const updateOrder = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { orderStatus } = req.body;
        
        const oldOrder = await Order.findById(id);
        const oldStatus = oldOrder.orderStatus;
        
        const order = await Order.findByIdAndUpdate(id, { orderStatus }, { new: true });
        
        // Emit WebSocket events
        const io = req.app.get('io');
        ws.emitOrderUpdated(io, order);
        
        if (oldStatus !== orderStatus) {
            ws.emitOrderStatusChanged(io, order.store, order, oldStatus);
        }
        
        res.status(200).json({
            success: true,
            message: "Order updated successfully!",
            data: order
        });
    } catch (error) {
        next(error);
    }
};
```

### Recipe Controller

```javascript
// controllers/recipeController.js
const ws = require("../services/websocketService");

const deductStock = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { quantity } = req.body;
        
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;
        
        const result = await recipeService.deductStock(id, quantity, req.user._id);
        
        // Emit WebSocket events
        const io = req.app.get('io');
        
        if (result.deducted && result.deducted.length > 0) {
            for (const item of result.deducted) {
                ws.emitInventoryUpdated(io, storeRef, {
                    type: 'recipe_deduction',
                    ingredientId: item.ingredientId,
                    ingredientName: item.ingredientName,
                    quantity: item.quantityDeducted,
                    balance: item.balanceAfter,
                    unit: item.unit
                });
            }
        }
        
        ws.emitRecipeProduced(io, storeRef, {
            recipeId: id,
            recipeName: result.recipeName,
            sku: result.sku,
            quantity: quantity,
            ingredients: result.deducted
        });
        
        res.status(200).json({
            success: true,
            message: "Stock deducted successfully!",
            data: result
        });
    } catch (error) {
        next(error);
    }
};
```

### Stock Controller

```javascript
// controllers/stockController.js
const ws = require("../services/websocketService");

const stockIn = async (req, res, next) => {
    try {
        const { ingredientId, quantity, price, reason } = req.body;
        
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;
        
        // ... lógica de entrada de estoque ...
        
        // Emit WebSocket event
        const io = req.app.get('io');
        ws.emitInventoryUpdated(io, storeRef, {
            type: 'stock_in',
            ingredientId: ingredientId,
            ingredientName: stockBalance.ingredient?.name,
            quantity: quantity,
            balance: stockBalance.balance,
            unit: stockBalance.unit
        });
        
        res.status(200).json({
            success: true,
            message: "Stock entry registered successfully!",
            data: { movement, newBalance: stockBalance.balance }
        });
    } catch (error) {
        next(error);
    }
};

const checkStockAlerts = async (req, res, next) => {
    try {
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;
        
        const alerts = await StockAlert.checkAndCreateAlerts(storeRef);
        
        // Emit WebSocket events para novos alertas
        const io = req.app.get('io');
        for (const alert of alerts) {
            ws.emitAlertCreated(io, alert);
        }
        
        res.status(200).json({
            success: true,
            message: `Checked and created ${alerts.length} new alerts`,
            data: alerts
        });
    } catch (error) {
        next(error);
    }
};
```

### Product Controller

```javascript
// controllers/productController.js
const ws = require("../services/websocketService");

const updateProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { isActive, isCurrent } = req.body;
        
        const product = await Product.findById(id);
        
        const storeRef = req.user.isMasterAdmin ? req.storeId : req.user.store;
        
        // Atualizar campos
        if (isActive !== undefined) product.isActive = isActive;
        if (isCurrent !== undefined) product.isCurrent = isCurrent;
        await product.save();
        
        // Emit WebSocket event se disponibilidade mudou
        if (isActive !== undefined || isCurrent !== undefined) {
            const io = req.app.get('io');
            ws.emitProductAvailability(io, storeRef, {
                productId: product._id,
                productName: product.name,
                isActive: product.isActive,
                isCurrent: product.isCurrent
            });
        }
        
        res.status(200).json({
            success: true,
            message: "Product updated successfully!",
            data: product
        });
    } catch (error) {
        next(error);
    }
};
```

### Device Controller

```javascript
// controllers/deviceController.js
const ws = require("../services/websocketService");

const approveDevice = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const device = await Device.findById(id);
        
        // ... validações e aprovação ...
        
        device.isApproved = true;
        device.approvedBy = req.user._id;
        device.approvedAt = new Date();
        await device.save();
        
        // Emit WebSocket event
        const io = req.app.get('io');
        ws.emitDeviceApproved(io, device);
        
        res.status(200).json({
            success: true,
            message: "Device approved successfully!",
            data: device
        });
    } catch (error) {
        next(error);
    }
};
```

---

## Catálogo de Eventos

### Eventos do Servidor para Cliente

| Evento | Payload | Quando Emitir |
|--------|---------|---------------|
| `order:created` | `{ orderId, storeId, tableId, orderNumber, items, total, status, createdAt }` | Novo pedido criado |
| `order:updated` | `{ orderId, storeId, updates }` | Pedido atualizado |
| `order:status-changed` | `{ orderId, storeId, oldStatus, newStatus, timestamp }` | Status do pedido mudou |
| `inventory:updated` | `{ storeId, type, ingredientId, ingredientName, quantity, balance, unit, timestamp }` | Movimento de estoque |
| `product:availability` | `{ storeId, productId, productName, isActive, isCurrent, timestamp }` | Disponibilidade mudou |
| `alert:created` | `{ alertId, storeId, type, severity, ingredientName, currentBalance, minimumStock, timestamp }` | Novo alerta de estoque |
| `recipe:produced` | `{ storeId, recipeId, recipeName, sku, quantity, ingredients, timestamp }` | Receita produzida |
| `device:approved` | `{ deviceId, storeId, isApproved, timestamp }` | Dispositivo aprovado |

### Eventos do Cliente para Servidor

| Evento | Payload | Descrição |
|--------|---------|-----------|
| `join:store` | `storeId` | Entrar na room da loja |
| `join:stores` | `[storeId1, storeId2]` | Entrar em múltiplas rooms |
| `leave:store` | `storeId` | Sair da room da loja |

---

## Frontend Integration

### React Hook

```javascript
// hooks/useRealTimeUpdates.js
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const useRealTimeUpdates = (storeId) => {
    const socket = useRef(null);

    useEffect(() => {
        // Conectar ao Socket.io
        socket.current = io('http://localhost:8000', {
            withCredentials: true
        });

        // Entrar na room da loja
        socket.current.emit('join:store', storeId);

        // Listeners
        socket.current.on('order:created', (data) => {
            console.log('Novo pedido:', data);
            // Atualizar lista de pedidos
        });

        socket.current.on('order:status-changed', (data) => {
            console.log('Status mudou:', data);
            // Atualizar status na tela
        });

        socket.current.on('inventory:updated', (data) => {
            console.log('Estoque atualizado:', data);
            // Atualizar saldo de ingrediente
        });

        socket.current.on('product:availability', (data) => {
            console.log('Produto atualizado:', data);
            // Atualizar cardápio
        });

        socket.current.on('alert:created', (data) => {
            console.log('Alerta criado:', data);
            // Mostrar notificação toast
        });

        socket.current.on('recipe:produced', (data) => {
            console.log('Receita produzida:', data);
            // Atualizar histórico de produção
        });

        socket.current.on('device:approved', (data) => {
            console.log('Dispositivo aprovado:', data);
            // Atualizar lista de dispositivos
        });

        // Cleanup
        return () => {
            socket.current.emit('leave:store', storeId);
            socket.current.disconnect();
        };
    }, [storeId]);

    return socket.current;
};

export default useRealTimeUpdates;
```

### Context API

```javascript
// context/SocketContext.js
import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const SocketProvider = ({ children, storeId }) => {
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        const newSocket = io('http://localhost:8000', {
            withCredentials: true
        });

        newSocket.on('connect', () => {
            console.log('Socket connected:', newSocket.id);
            newSocket.emit('join:store', storeId);
        });

        setSocket(newSocket);

        return () => {
            newSocket.emit('leave:store', storeId);
            newSocket.disconnect();
        };
    }, [storeId]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
```

### Uso em Componentes

```javascript
// components/OrderList.js
import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';

const OrderList = ({ storeId }) => {
    const [orders, setOrders] = useState([]);
    const socket = useSocket();

    useEffect(() => {
        // Carregar pedidos iniciais
        fetchOrders();
    }, []);

    useEffect(() => {
        if (!socket) return;

        // Listener para novos pedidos
        socket.on('order:created', (data) => {
            setOrders(prev => [data, ...prev]);
            // Tocar som de notificação
        });

        socket.on('order:status-changed', (data) => {
            setOrders(prev => prev.map(o => 
                o.orderId === data.orderId ? { ...o, status: data.newStatus } : o
            ));
        });

        return () => {
            socket.off('order:created');
            socket.off('order:status-changed');
        };
    }, [socket]);

    return (
        // Renderizar lista de pedidos
    );
};
```

---

## Testes

### Testar Conexão WebSocket

```bash
# Usando wscat (npm install -g wscat)
wscat -c http://localhost:8000/socket.io/?EIO=4&transport=polling

# Ou usar script de teste em Node.js
```

### Testar Eventos

```javascript
// test-websocket.js
const { io } = require('socket.io-client');

const socket = io('http://localhost:8000', {
    withCredentials: true
});

socket.on('connect', () => {
    console.log('Connected:', socket.id);
    socket.emit('join:store', 'STORE_ID_AQUI');
});

socket.on('order:created', (data) => {
    console.log('Order created:', data);
});

socket.on('inventory:updated', (data) => {
    console.log('Inventory updated:', data);
});

socket.on('product:availability', (data) => {
    console.log('Product availability:', data);
});
```

### Testar com Curl + HTTP

```bash
# 1. Criar pedido (deve disparar WebSocket event)
curl -X POST http://localhost:8000/api/order \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "store": "<store-id>",
    "table": "<table-id>",
    "items": [
      { "product": "<product-id>", "quantity": 2, "price": 29.90 }
    ]
  }'

# 2. Verificar logs do backend
# Deve aparecer:
# [WebSocket] order:created emitted for store <store-id>
```

---

## Troubleshooting

### Problema: Cliente não recebe eventos

**Causas possíveis:**
1. Não entrou na room corretamente
2. StoreId incorreto
3. Conexão não estabelecida

**Solução:**
```javascript
// Verificar conexão
socket.on('connect', () => console.log('Connected!'));
socket.on('connect_error', (error) => console.error('Error:', error));

// Verificar room
socket.emit('join:store', storeId);
console.log('Joined room for store:', storeId);
```

### Problema: Eventos duplicados

**Causa**: Múltiplas conexões ou listeners duplicados

**Solução:**
```javascript
// Cleanup correto no useEffect
useEffect(() => {
    socket.on('event', handler);
    return () => socket.off('event', handler);
}, [dependencies]);
```

### Problema: CORS error

**Causa**: Origem não configurada no backend

**Solução:**
```bash
# .env
SOCKET_CORS_ORIGIN=http://localhost:5173
```

### Problema: Eventos não logados

**Causa**: Console.log não aparece

**Solução:** Verificar se websocketService está sendo importado corretamente

---

## Considerações de Segurança

### Autenticação (Futura Implementação)

```javascript
// Middleware de autenticação WebSocket
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
        return next(new Error('Authentication required'));
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
        next();
    } catch (error) {
        next(new Error('Invalid token'));
    }
});
```

### Validação de Room

```javascript
// Verificar usuário pertence à loja antes de entrar na room
socket.on('join:store', async (storeId) => {
    const user = socket.user;
    
    if (!user.isMasterAdmin && user.store !== storeId) {
        socket.emit('error', { message: 'Not authorized for this store' });
        return;
    }
    
    socket.join(`store:${storeId}`);
});
```

---

## Performance

### Otimizações

1. **Batching**: Agrupar múltiplos eventos em um único payload
2. **Throttling**: Limitar frequência de eventos para o mesmo cliente
3. **Acknowledgments**: Usar callbacks para confirmar recebimento

```javascript
// Exemplo de acknowledgment
socket.emit('order:status', data, (ack) => {
    if (ack.success) {
        console.log('Event received by server');
    }
});
```

---

## Próximos Passos (Fase 4)

Com a Fase 3 completa, o sistema está pronto para:

1. **Purchase Orders** - Pedidos de compra automáticos
2. **Kitchen Display System** - Tela de cozinha em tempo real
3. **Dashboard Analytics** - Métricas em tempo real
4. **Mobile Push Notifications** - Notificações push para mobile

---

## Referências

- [WEBSOCKETS.md](../WEBSOCKETS.md) - Documentação completa de eventos
- [services/websocketService.js](../services/websocketService.js) - Serviço de WebSocket
- [app.js](../app.js) - Configuração do Socket.io

---

*Documentação criada em: 2026-05-21*
