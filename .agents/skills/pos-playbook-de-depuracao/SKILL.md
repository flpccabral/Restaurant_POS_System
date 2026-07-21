---
name: pos-playbook-de-depuracao
description: >-
  Use quando precisar diagnosticar e resolver erros comuns no Restaurant POS System:
  HTTP 401 Unauthorized, HTTP 403 Forbidden, HTTP 500 Internal Error, desincronização
  de estoque, falhas de transação no MongoDB, pendências de aprovação de dispositivo
  (DEVICE_PENDING_APPROVAL) ou falha na atualização em tempo real via Socket.io.
---

# Playbook de Depuração — Restaurant POS System

## Quando usar

- Investigar erros HTTP retornados pela API (401, 403, 404, 500)
- Resolver falhas ao processar pagamentos ou fechar caixa
- Diagnosticar motivos de baixa de estoque não ter ocorrido ou ter gerado erro
- Corrigir bloqueio por dispositivo não aprovado (`DEVICE_PENDING_APPROVAL`)
- Resolver problemas de eventos em tempo real no Socket.io / KDS

## Quando não usar

- Dúvidas conceituais de arquitetura (→ `pos-contrato-de-arquitetura`)
- Setup do ambiente inicial (→ `pos-build-e-ambiente`)

---

## Matriz de Triagem Rápida por Sintoma

| Sintoma / Erro | Causa Provável | Arquivo / Módulo a Verificar | Ação Recomendada |
|---|---|---|---|
| `HTTP 401 Unauthorized` | Cookie `accessToken` ausente ou expirado; JWT_SECRET modificado | `middlewares/tokenVerification.js` | Refazer login para renovar cookie; conferir `JWT_SECRET` no `.env` |
| `HTTP 403 Forbidden` | Usuário sem permissão na Role; ou loja diferente no `storeIsolation` | `middlewares/checkPermission.js`, `storeIsolation.js` | Verificar role do usuário e se `req.storeId` bate com o recurso solicitado |
| `DEVICE_PENDING_APPROVAL` | Dispositivo novo tentando logar sem nickname ou aprovação | `middlewares/deviceApproval.js` | Executar aprovação via endpoint `/api/device/:id/approve` |
| `MongoServerError: Transaction numbers...` | MongoDB em execução sem Replica Set | `config/database.js` | Configurar Replica Set local (`rs.initiate()`) ou usar MongoDB Atlas |
| Baixa de estoque não ocorre pós-venda | Soft error na receita ou produto do tipo sem baixa | `services/orderCheckoutService.js` | Verificar `stockDeductionStatus` e `stockDeductionReason` no documento do Order |
| Eventos Socket.io não chegam ao KDS/Admin | Cliente não executou `join:store` ou room incorreta | `app.js`, `services/websocketService.js` | Verificar logs do servidor por `[WebSocket] Socket ... joined store:...` |

---

## Guias Detalhados de Resolução

### 1. Resoluções para `DEVICE_PENDING_APPROVAL`

**Passos:**
1. Listar dispositivos pendentes usando credenciais de administrador da loja:
   `GET /api/device/pending`
2. Identificar o `deviceId` ou `fingerprint`.
3. Aprovar o dispositivo:
   `POST /api/device/<deviceId>/approve`

---

### 2. Investigação de Erros de Baixa de Estoque (`orderCheckoutService`)

Quando um pedido é finalizado mas o estoque não é deduzido:

1. Consultar o pedido no MongoDB:
   ```javascript
   db.orders.findOne({ orderId: "<ORDER_ID>" }, { stockDeductionStatus: 1, stockDeductionReason: 1 })
   ```
2. **Cenário A: `stockDeductionStatus === 'failed'`**
   - **Motivo:** Hard error (ex: produto sem receita e politica de estoque é estrita, ou saldo insuficiente).
   - **Solução:** Verificar saldo do ingrediente na `stockBalanceModel` e receita cadastrada no `recipeModel`.
3. **Cenário B: `stockDeductionStatus === 'skipped'`**
   - **Motivo:** Produto marcado como revenda direta ou item sem necessidade de baixa (`industrialized_resale`).

---

### 3. Diagnóstico de Socket.io (WebSocket)

1. Verificar no console do servidor Node se a conexão foi estabelecida:
   ```text
   [WebSocket] Socket connected: <SOCKET_ID>
   [WebSocket] Socket <SOCKET_ID> joined store:<STORE_UUID>
   ```
2. Se a mensagem `joined store` não aparecer:
   - Confirmar se o frontend enviou o evento `socket.emit('join:store', storeId)` após a autenticação.

---

## Skills Relacionadas

- `pos-seguranca` — autenticação e autorização
- `pos-estoque-e-checkout` — detalhes do fluxo de checkout transacional
- `pos-observabilidade` — análise de logs do sistema

## Proveniência e Manutenção

- Verificado em: 2026-07-20
- Fontes primárias:
  - `pos-backend/middlewares/globalErrorHandler.js`
  - `pos-backend/middlewares/deviceApproval.js`
  - `pos-backend/services/orderCheckoutService.js`
  - `pos-backend/app.js`
