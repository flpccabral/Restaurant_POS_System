# Plano de Rollback Manual — Piloto Controlado

## Introducao

Este documento descreve como reverter manualmente cada acao operacional
executada durante o piloto. Cada procedimento inclui o endpoint envolvido,
o servico/model impactado e os passos exatos para reverter.

> **Regra geral:** Toda acao operacional e registrada no `OperationalAuditLog`.
> Use os logs de auditoria para identificar o que precisa ser revertido:
> ```
> GET /api/audit?store=<storeId>&startDate=2026-05-23
> ```

---

## 1. Reverter Politica de Estoque Incorreta

### Cenarios:
- Politica criada com valores errados (min > reorder, etc.)
- Politica editada com parametros incorretos
- Politica desativada por engano

### Rollback:

**Criacao incorreta:**
1. Identifique a politica pelo `policyId` no log de auditoria (`stock_policy_created`)
2. Execute DELETE /api/stock-policies/:policyId (se o endpoint existir) OU
3. Execute diretamente no MongoDB:
   ```javascript
   db.stockpolicies.deleteOne({ policyId: "<policyId>" });
   ```
4. Crie uma nova politica com os valores corretos via POST /api/stock-policies

**Edicao incorreta:**
1. No log de auditoria (`stock_policy_updated`), o campo `before` contem os valores anteriores
2. Use PUT /api/stock-policies/:policyId para restaurar os valores de `before`
3. Campos a restaurar: `minQuantity`, `reorderPoint`, `idealQuantity`, `maxQuantity`, `priority`

**Desativacao por engano:**
1. PUT /api/stock-policies/:policyId com `isActive: true`
2. Ou via MongoDB:
   ```javascript
   db.stockpolicies.updateOne({ policyId: "<policyId>" }, { $set: { isActive: true } });
   ```

### Modelos afetados:
- `StockPolicy` (stockPolicyModel.js)
- Log: `stock_policy_created`, `stock_policy_updated`, `stock_policy_deleted`

### Servico:
- `stockPolicyRoute.js`
- `observabilityService.js` (geracao de alertas depende de politicas)

---

## 2. Reverter Transferencia Central -> Loja Incorreta

### Cenarios:
- Quantidade errada transferida
- Ingrediente errado enviado
- Destino incorreto (loja errada)

### Rollback:

**Transferencia ja executada:**
1. Identifique a transferencia no log (`central_transfer_executed`)
2. Obtenha os detalhes: ingredientId, fromLocation, toLocation, quantity
3. Execute uma transferencia reversa manual via MongoDB:
   ```javascript
   // Devolver do estoque da loja para o central
   const StockMovement = require('../models/stockMovementModel');

   // 1. Debitar da loja
   await db.stockbalances.updateOne(
     { location: "<storeLocationId>", ingredient: "<ingredientId>" },
     { $inc: { balance: -<quantity>, available: -<quantity> } }
   );

   // 2. Creditar no central
   await db.stockbalances.updateOne(
     { location: "<centralLocationId>", ingredient: "<ingredientId>" },
     { $inc: { balance: <quantity>, available: <quantity> } }
   );

   // 3. Registrar movimentacao reversa
   await db.stockmovements.insertOne({
     fromLocation: "<storeLocationId>",
     toLocation: "<centralLocationId>",
     ingredient: "<ingredientId>",
     quantity: <quantity>,
     type: 'transfer_out',
     // ... outros campos
   });
   ```

**Alternativa:** Use o endpoint de transferencia novamente com quantidades e direcao corretas.

### Modelos afetados:
- `StockBalance` (saldo da loja e do central)
- `StockMovement` (registro da movimentacao)
- `OperationalAuditLog` (log da acao)

### Endpoint original:
- POST /api/observability/transfer/central-to-store (se existir)
- OU via servico: `replenishmentService.executeCentralToStoreTransfer()`

---

## 3. Reverter Transferencia Loja -> Loja Incorreta

### Cenarios:
- Ingrediente errado transferido entre lojas
- Quantidade incorreta
- Loja de destino errada

### Rollback:

**Transferencia ja executada:**
1. Identifique no log (`inter_store_transfer_executed`)
2. Obtenha: ingredientId, fromStore, toStore, quantity
3. Execute a reversa:
   ```javascript
   // Debitar da loja destino, creditar na loja origem
   await db.stockbalances.updateOne(
     { store: "<toStoreId>", ingredient: "<ingredientId>" },
     { $inc: { balance: -<quantity>, available: -<quantity> } }
   );
   await db.stockbalances.updateOne(
     { store: "<fromStoreId>", ingredient: "<ingredientId>" },
     { $inc: { balance: <quantity>, available: <quantity> } }
   );
   ```

### Modelos afetados:
- `StockBalance` (ambas as lojas)
- `StockMovement` (registro)
- `InterStoreTransfer` (se existir)

### Servico:
- `interStoreTransferService.js`

---

## 4. Reverter Alerta Resolvido ou Ignorado Incorretamente

### Cenarios:
- Alerta resolvido sem a acao corretiva ter sido feita
- Alerta ignorado que era um problema real

### Rollback:

**Alerta resolvido -> reabrir:**
1. Identifique o alerta no log (`alert_resolved`)
2. Via MongoDB:
   ```javascript
   db.operationalalerts.updateOne(
     { alertId: "<alertId>" },
     {
       $set: {
         status: "new",
         resolvedBy: null,
         resolvedAt: null,
         "metadata.resolutionNotes": null
       }
     }
   );
   ```

**Alerta ignorado -> reabrir:**
1. Via MongoDB:
   ```javascript
   db.operationalalerts.updateOne(
     { alertId: "<alertId>" },
     {
       $set: {
         status: "new",
         dismissedBy: null,
         dismissedAt: null,
         "metadata.dismissalReason": null
       }
     }
   );
   ```

### Modelo afetado:
- `OperationalAlert` (operationalAlertModel.js)

### Log:
- `alert_resolved`, `alert_dismissed`

---

## 5. Reverter Compra Registrada Incorretamente

### Cenarios:
- Quantidade de compra registrada errada
- Ingrediente errado
- Preco incorreto

### Rollback:

**Compra ja registrada:**
1. Identifique no log (`purchase_registered`)
2. Obtenha: ingredientId, storeId, quantity, totalCost
3. Reverter o saldo:
   ```javascript
   await db.stockbalances.updateOne(
     { store: "<storeId>", ingredient: "<ingredientId>" },
     { $inc: { balance: -<quantity>, available: -<quantity> } }
   );
   ```
4. Se houver `PurchaseOrder`, atualize o status para "cancelled":
   ```javascript
   db.purchaseorders.updateOne(
     { _id: "<purchaseOrderId>" },
     { $set: { status: "cancelled" } }
   );
   ```

### Modelos afetados:
- `StockBalance` (saldo)
- `PurchaseOrder` (se criada)
- `StockMovement` (se registrada)

### Endpoint original:
- POST /api/observability/purchase/register

---

## 6. Reverter Saldo Inicial Incorreto

### Cenarios:
- Seed executado com valores errados de estoque inicial
- Ingrediente com saldo zerado que deveria ter estoque

### Rollback:

**Ajuste manual de saldo:**
1. Identifique o ingrediente e a loja
2. Via MongoDB:
   ```javascript
   // Ajustar saldo diretamente
   await db.stockbalances.updateOne(
     { store: "<storeId>", ingredient: "<ingredientId>" },
     { $set: { balance: <novoValor>, available: <novoValor> } }
   );
   ```

**Reexecutar seed (cuidado — pode duplicar dados):**
1. Use `node scripts/pilot-seed.js --clean` para limpar dados do piloto
2. Ajuste os valores no script `pilot-seed.js`
3. Execute `node scripts/pilot-seed.js` novamente

---

## Procedimento de Emergencia

Se uma acao causar inconsistencia grave no estoque:

1. **Pare imediatamente** qualquer operacao que dependa do sistema de estoque
2. **Identifique** o problema no log de auditoria (`GET /api/audit`)
3. **Reverta** manualmente via MongoDB seguindo os passos acima
4. **Valide** os saldos:
   ```javascript
   const totalBalance = await db.stockbalances.aggregate([
     { $match: { store: "<storeId>" } },
     { $group: { _id: null, total: { $sum: "$balance" } } }
   ]);
   ```
5. **Retome** as operacoes normais
6. **Registre** o incidente na documentacao do piloto

## Contatos

- Responsavel tecnico: [Nome] - [email/telefone]
- Acesso ao MongoDB: via string de conexao no .env
- Acesso ao servidor: SSH / terminal local
