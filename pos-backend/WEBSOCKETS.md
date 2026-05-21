# 📡 WebSockets - Documentação de Eventos em Tempo Real

## Visão Geral

O sistema POS utiliza **Socket.io** para comunicação em tempo real entre o backend e os clientes frontend. Todos os eventos são transmitidos por **rooms** organizadas por loja (`store:{storeId}`), garantindo que cada cliente receba apenas eventos relevantes.

---

## Configuração

### Backend

O Socket.io está configurado em `app.js`:

```javascript
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.SOCKET_CORS_ORIGIN || "http://localhost:5173",
        credentials: true
    }
});

app.set('io', io); // Acessível nos controllers via req.app.get('io')
```

### Frontend

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:8000', {
    withCredentials: true
});

// Entrar na room da loja após autenticação
socket.emit('join:store', userStoreId);
```

---

## Eventos Disponíveis

### 1. Pedidos (Orders)

#### `order:created`
Emitido quando um novo pedido é criado.

**Payload:**
```javascript
{
    orderId: "65f1234567890abcdef12345",
    storeId: "65f1234567890abcdef12340",
    tableId: "65f1234567890abcdef12341",
    orderNumber: "123",
    items: [...],
    total: 125.50,
    status: "pending",
    timestamp: "2026-05-21T15:30:00.000Z"
}
```

**Quando é emitido:**
- Após criação de pedido via `POST /api/order`

---

#### `order:updated`
Emitido quando um pedido é atualizado.

**Payload:**
```javascript
{
    orderId: "65f1234567890abcdef12345",
    storeId: "65f1234567890abcdef12340",
    updates: { ...pedido completo }
}
```

**Quando é emitido:**
- Após atualização de pedido via `PUT /api/order/:id`

---

#### `order:status-changed`
Emitido quando o status de um pedido muda.

**Payload:**
```javascript
{
    orderId: "65f1234567890abcdef12345",
    storeId: "65f1234567890abcdef12340",
    oldStatus: "pending",
    newStatus: "preparing",
    timestamp: "2026-05-21T15:35:00.000Z"
}
```

**Quando é emitido:**
- Quando `orderStatus` é alterado

---

### 2. Estoque (Inventory)

#### `inventory:updated`
Emitido quando há mudança no saldo de um ingrediente.

**Payload:**
```javascript
{
    storeId: "65f1234567890abcdef12340",
    type: "stock_in", // ou "stock_out", "adjustment", "recipe_deduction"
    ingredientId: "65f1234567890abcdef12350",
    ingredientName: "Carne Bovina",
    quantity: 150,
    balance: 9850,
    unit: "g",
    timestamp: "2026-05-21T15:40:00.000Z"
}
```

**Tipos de movimento:**
| Tipo | Descrição | Quando |
|------|-----------|--------|
| `stock_in` | Entrada de estoque | Compra de ingrediente |
| `stock_out` | Saída de estoque | Baixa manual |
| `adjustment` | Ajuste | Correção de saldo |
| `recipe_deduction` | Baixa de receita | Produção de prato |

**Quando é emitido:**
- Após `POST /api/stock/in`
- Após `POST /api/stock/out`
- Após `POST /api/stock/adjust`
- Após `POST /api/recipe/:id/stock/deduct`

---

### 3. Produtos (Products)

#### `product:availability`
Emitido quando a disponibilidade de um produto muda.

**Payload:**
```javascript
{
    storeId: "65f1234567890abcdef12340",
    productId: "65f1234567890abcdef12360",
    productName: "Hambúrguer Artesanal",
    isActive: false,
    isCurrent: true,
    timestamp: "2026-05-21T16:00:00.000Z"
}
```

**Quando é emitido:**
- Após `PUT /api/product/:id` com mudança em `isActive` ou `isCurrent`

---

### 4. Alertas (Alerts)

#### `alert:created`
Emitido quando um novo alerta de estoque é criado.

**Payload:**
```javascript
{
    alertId: "65f1234567890abcdef12370",
    storeId: "65f1234567890abcdef12340",
    type: "low_stock", // ou "out_of_stock"
    severity: "high",
    ingredientName: "Queijo Mussarela",
    currentBalance: 500,
    minimumStock: 2000,
    timestamp: "2026-05-21T16:10:00.000Z"
}
```

**Quando é emitido:**
- Após `POST /api/stock/alerts/check`

---

### 5. Receitas (Recipes)

#### `recipe:produced`
Emitido quando uma receita é produzida (baixa de ingredientes).

**Payload:**
```javascript
{
    storeId: "65f1234567890abcdef12340",
    recipeId: "65f1234567890abcdef12380",
    recipeName: "Hambúrguer Artesanal - P",
    sku: "hamburguer-artesanal-p",
    quantity: 5,
    ingredients: [
        { ingredientId, ingredientName, quantityDeducted }
    ],
    timestamp: "2026-05-21T16:20:00.000Z"
}
```

**Quando é emitido:**
- Após `POST /api/recipe/:id/stock/deduct`

---

### 6. Dispositivos (Devices)

#### `device:registered`
Emitido quando um dispositivo é registrado.

**Payload:**
```javascript
{
    deviceId: "65f1234567890abcdef12390",
    storeId: "65f1234567890abcdef12340",
    userId: "65f1234567890abcdef123a0",
    nickname: "Notebook Cozinha",
    isApproved: true,
    timestamp: "2026-05-21T16:30:00.000Z"
}
```

---

#### `device:approved`
Emitido quando um dispositivo é aprovado.

**Payload:**
```javascript
{
    deviceId: "65f1234567890abcdef12390",
    storeId: "65f1234567890abcdef12340",
    isApproved: true,
    timestamp: "2026-05-21T16:31:00.000Z"
}
```

**Quando é emitido:**
- Após `POST /api/device/:id/approve`

---

## Eventos do Cliente para Servidor

### `join:store`
Cliente entra na room de uma loja específica.

```javascript
socket.emit('join:store', storeId);
```

### `join:stores`
Cliente entra em múltiplas rooms (para usuários com acesso a várias lojas).

```javascript
socket.emit('join:stores', [storeId1, storeId2]);
```

### `leave:store`
Cliente sai da room de uma loja.

```javascript
socket.emit('leave:store', storeId);
```

### `order:status`
Cliente envia atualização de status de pedido (relay para outros clientes).

```javascript
socket.emit('order:status', {
    storeId: "...",
    orderId: "...",
    newStatus: "preparing"
});
```

---

## Exemplo Completo - Frontend React

```javascript
import { useEffect } from 'react';
import { io } from 'socket.io-client';

const useRealTimeUpdates = (storeId) => {
    const socket = useRef(null);

    useEffect(() => {
        // Conectar
        socket.current = io('http://localhost:8000', {
            withCredentials: true
        });

        // Entrar na room
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
            // Mostrar notificação
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

---

## Debug e Troubleshooting

### Logs no Backend

Os eventos WebSocket são logados no console:

```
[WebSocket] Socket connected: abc123
[WebSocket] Socket abc123 joined store:xyz789
[WebSocket] order:created emitted for store xyz789
[WebSocket] inventory:updated emitted for ingredient abc456
```

### Verificar Conexão

No browser console:

```javascript
socket.on('connect', () => {
    console.log('Conectado!', socket.id);
});

socket.on('connect_error', (error) => {
    console.error('Erro de conexão:', error);
});
```

### Problemas Comuns

| Problema | Causa | Solução |
|----------|-------|---------|
| Cliente não recebe eventos | Não entrou na room | Chamar `socket.emit('join:store', storeId)` |
| Recebe eventos de outras lojas | Room errada | Verificar storeId correto |
| Conexão falha | CORS | Configurar `SOCKET_CORS_ORIGIN` no .env |
| Eventos duplicados | Múltiplas conexões | Usar `useEffect` com cleanup |

---

## Segurança

### Autenticação

Para autenticar conexões WebSocket, use middleware no futuro:

```javascript
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    // Validar token JWT
    next();
});
```

### Rate Limiting

Para prevenir abuso, implemente rate limiting por socket.

---

## Arquitetura

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

---

## Próximos Passos

- [ ] Implementar autenticação JWT em conexões WebSocket
- [ ] Adicionar rate limiting
- [ ] Criar dashboard de monitoramento de eventos
- [ ] Implementar reconexão automática com backoff
- [ ] Adicionar persistência de eventos para replay
