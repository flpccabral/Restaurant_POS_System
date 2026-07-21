---
name: pos-observabilidade
description: >-
  Use quando precisar analisar logs do sistema, monitorar eventos em tempo real via Socket.io,
  consultar registros de auditoria operacional (`operationalAuditLogModel`), verificar alertas
  de estoque (`stockAlertModel`) ou avaliar métricas de saúde do sistema durante a operação.
---

# Observabilidade — Restaurant POS System

## Quando usar

- Consultar logs de auditoria operacional em `/api/audit`
- Analisar alertas de ruptura ou nível crítico de estoque (`operationalAlertModel`)
- Acompanhar emissão de eventos Socket.io no backend
- Avaliar métricas do piloto registrado em `PILOT_METRICS.md`
- Implementar novos eventos de log estruturado ou auditoria

## Quando não usar

- Depurar falhas de código local sem foco em dados de auditoria/logs (→ `pos-playbook-de-depuracao`)

---

## Fontes de Observabilidade do Sistema

### 1. Audit Log Operacional (`auditService.js`)

Registra ações críticas sem bloquear o fluxo da aplicação.

- **Coleção:** `operationalauditlogs`
- **Rotas de Consulta:** `/api/audit/daily-report`, `/api/audit/logs`
- **Tipos de Ação Registrados:** `stock_deduction`, `stock_reversal`, `transfer`, `purchase_order`, `cash_session_open`, `cash_session_close`, `device_approved`, `role_updated`.

```javascript
// Exemplo de consulta no MongoDB
db.operationalauditlogs.find({ store: ObjectId("<STORE_ID>") }).sort({ createdAt: -1 })
```

---

### 2. Alertas Operacionais de Estoque (`observabilityService.js`)

O sistema monitora continuadamente os insumos que atingem o nível mínimo configurado.

- **Coleção:** `stockalerts`
- **Rotas de Consulta:** `/api/observability/stock-health`, `/api/observability/alerts`
- **Severidades:** `low`, `critical`, `out_of_stock`

---

### 3. Eventos em Tempo Real (Socket.io)

O servidor emite eventos em tempo real direcionados à room da loja (`store:<storeId>`):

- `order:created`: Novo pedido recebido.
- `order:status`: Atualização do status de preparo.
- `order:paid`: Pedido pago e fechado.
- `kds:item-updated`: Item atualizado no visor da cozinha.

---

## Skills Relacionadas

- `pos-playbook-de-depuracao` — solução de problemas identificados pela observabilidade
- `pos-seguranca` — auditoria de acesso e eventos de segurança

## Proveniência e Manutenção

- Verificado em: 2026-07-20
- Fontes primárias:
  - `pos-backend/services/auditService.js`
  - `pos-backend/services/observabilityService.js`
  - `pos-backend/services/websocketService.js`
  - `PILOT_METRICS.md`
