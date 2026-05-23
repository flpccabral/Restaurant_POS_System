# Metricas Minimas do Piloto Controlado

## Introducao

Este documento define as metricas minimas a serem coletadas durante o piloto,
como extrai-las dos logs de auditoria, alertas e movimentacoes de estoque,
e como interpretar os resultados.

---

## 1. Rupturas Detectadas (Stockouts)

**Definicao:** Numero de ingredientes com saldo zero (balance = 0) em cada loja.

**Como extrair:**
```javascript
// Dashboard / Stock Health
GET /api/observability/stock-health/store/:storeId
// Contar itens com status = "stockout"

// Direto no MongoDB:
db.stockbalances.countDocuments({
  store: <storeId>,
  balance: 0
});
```

**O que esperar:** Ideal = 0 rupturas. Toleravel = 1-2 rupturas em itens nao criticos.

---

## 2. Alertas Gerados

**Definicao:** Numero total de alertas criados pelo sistema durante o periodo.

**Como extrair:**
```javascript
GET /api/observability/alerts?store=<storeId>&status=new
// Contar total

// Log de auditoria:
GET /api/audit?actionType=alert_generated&startDate=2026-05-23

// Direto no MongoDB:
db.operationalalerts.countDocuments({
  createdAt: { $gte: ISODate("2026-05-23"), $lte: ISODate("2026-05-30") }
});
```

**Segmentacao por severidade:**
```javascript
db.operationalalerts.aggregate([
  { $match: { createdAt: { $gte: ISODate("2026-05-23") } } },
  { $group: { _id: "$severity", count: { $sum: 1 } } }
]);
```

---

## 3. Alertas Resolvidos

**Definicao:** Alertas que foram efetivamente resolvidos (acoes corretivas tomadas).

**Como extrair:**
```javascript
GET /api/audit?actionType=alert_resolved

// Direto no MongoDB:
db.operationalalerts.countDocuments({
  status: "resolved",
  resolvedAt: { $gte: ISODate("2026-05-23") }
});
```

---

## 4. Alertas Ignorados (Dismissed)

**Definicao:** Alertas que foram ignorados (falsos positivos ou acao nao necessaria).

**Como extrair:**
```javascript
GET /api/audit?actionType=alert_dismissed

// Direto no MongoDB:
db.operationalalerts.countDocuments({
  status: "dismissed",
  dismissedAt: { $gte: ISODate("2026-05-23") }
});
```

**Interpretacao:** Se mais de 30% dos alertas forem ignorados, as politicas de estoque
precisam ser ajustadas (limiares muito sensiveis).

---

## 5. Taxa de Resolucao de Alertas

**Formula:**
```
Taxa = Alertas Resolvidos / (Alertas Gerados - Alertas Ignorados) * 100
```

**Alvo:** > 70% de taxa de resolucao.

---

## 6. Tempo Medio de Resolucao de Alertas

**Definicao:** Tempo entre a geracao do alerta e sua resolucao.

**Como extrair:**
```javascript
// Direto no MongoDB:
db.operationalalerts.aggregate([
  { $match: { status: "resolved", resolvedAt: { $exists: true } } },
  { $project: {
    tempoHoras: {
      $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 3600000]
    }
  }},
  { $group: { _id: null, mediaHoras: { $avg: "$tempoHoras" } } }
]);
```

**Alvo:** < 4 horas para alertas de alta severidade, < 24 horas para alertas baixos.

---

## 7. Recomendacoes Geradas

**Definicao:** Numero de recomendacoes geradas pelo sistema, segmentadas por tipo.

**Tipos:**
- `central_to_store`: Sugere transferencia do estoque central
- `inter_store`: Sugere transferencia entre lojas
- `purchase`: Sugere registrar necessidade de compra

**Como extrair:**
```javascript
// O sistema gera recomendacoes sob demanda via:
GET /api/observability/recommendations/store/:storeId
GET /api/observability/recommendations/network

// Contar por tipo:
// No codigo, as recomendacoes sao geradas pelo replenishmentService
// e retornadas na resposta JSON como array com campo "type"
```

---

## 8. Recomendacoes Executadas

**Definicao:** Recomendacoes que foram de fato executadas (transferencia feita,
compra registrada).

**Como extrair:**
```javascript
// Transferencias central -> loja executadas:
GET /api/audit?actionType=central_transfer_executed

// Transferencias loja -> loja executadas:
GET /api/audit?actionType=inter_store_transfer_executed

// Compras registradas:
GET /api/audit?actionType=purchase_registered
```

---

## 9. Transferencias Realizadas

**Definicao:** Total de transferencias de estoque executadas.

**Como extrair:**
```javascript
// Central -> loja:
const centralTx = await OperationalAuditLog.countDocuments({
  actionType: "central_transfer_executed",
  createdAt: { $gte: startDate, $lte: endDate }
});

// Loja -> loja:
const storeTx = await OperationalAuditLog.countDocuments({
  actionType: "inter_store_transfer_executed",
  createdAt: { $gte: startDate, $lte: endDate }
});

// Direto do StockMovement:
db.stockmovements.countDocuments({
  type: { $in: ["transfer_in", "transfer_out"] },
  createdAt: { $gte: ISODate("2026-05-23") }
});
```

---

## 10. Compras Registradas

**Definicao:** Numero de registros de compra (purchase_registered) no periodo.

**Como extrair:**
```javascript
GET /api/audit?actionType=purchase_registered
```

---

## 11. Politicas Criadas / Editadas

**Definicao:** Alteracoes nas politicas de estoque durante o piloto.

**Como extrair:**
```javascript
// Politicas criadas:
GET /api/audit?actionType=stock_policy_created

// Politicas atualizadas:
GET /api/audit?actionType=stock_policy_updated

// Politicas desativadas:
GET /api/audit?actionType=stock_policy_deleted
```

---

## 12. Divergencias Percebidas pelos Operadores

**Definicao:** Situacoes onde o operador percebeu que o saldo no sistema
nao correspondia ao estoque fisico real.

**Como extrair:** Relato manual dos operadores (planilha de problemas).
Nao ha metrica automatica para isso.

**Alvo:** < 3 divergencias por loja durante todo o piloto.
Divergencias > 20% do saldo esperado sao consideradas criticas.

---

## 13. Erros Operacionais Encontrados

**Definicao:** Erros de software, travamentos, comportamentos inesperados.

**Como extrair:**
```javascript
// Logs de auditoria com status "failure":
GET /api/audit?status=failure

// Erros no backend (console do servidor):
// Verificar logs do terminal / arquivo de log
```

**Registro manual:** Cada erro deve ser documentado com:
- Data/hora
- Acao que causou o erro
- Mensagem de erro
- Impacto
- Solucao aplicada

---

## 14. Relatorio Diario (Daily Report)

**Endpoint:** `GET /api/audit/daily-report`

**Retorna:**
```json
{
  "date": "2026-05-23",
  "totalActions": 42,
  "byType": {
    "alert_resolved": 10,
    "alert_dismissed": 3,
    "central_transfer_executed": 5,
    "inter_store_transfer_executed": 2,
    "purchase_registered": 8,
    "stock_policy_created": 4,
    "stock_policy_updated": 6,
    "stock_policy_deleted": 0,
    "alert_generated": 4
  },
  "byStore": [
    { "store": "PILOT_Hamburgueria", "count": 15 },
    { "store": "PILOT_Pizzaria", "count": 10 },
    { "store": "PILOT_Arabe", "count": 8 },
    { "store": "PILOT_Bar", "count": 5 },
    { "store": "PILOT_Central", "count": 4 }
  ],
  "failures": 1,
  "recentActions": [ ... ]
}
```

---

## 15. Dashboard Consolidado

Para uma visao geral rapida, use o Dashboard ou execute:

```bash
# Extrair metricas rapidas
node -e "
const mongoose = require('mongoose');
const OperationalAuditLog = require('./models/operationalAuditLogModel');
const OperationalAlert = require('./models/operationalAlertModel');

async function metrics() {
  await mongoose.connect(process.env.MONGODB_URI);
  const start = new Date('2026-05-23');

  console.log('=== METRICAS DO PILOTO ===');
  console.log('Alertas:', {
    total: await OperationalAlert.countDocuments({ createdAt: { \$gte: start } }),
    resolvidos: await OperationalAlert.countDocuments({ status: 'resolved' }),
    ignorados: await OperationalAlert.countDocuments({ status: 'dismissed' }),
    novos: await OperationalAlert.countDocuments({ status: 'new' })
  });

  console.log('Acoes (AuditLog):', {
    total: await OperationalAuditLog.countDocuments({ createdAt: { \$gte: start } }),
    sucesso: await OperationalAuditLog.countDocuments({ status: 'success' }),
    falha: await OperationalAuditLog.countDocuments({ status: 'failure' })
  });

  await mongoose.connection.close();
}
metrics().catch(console.error);
"
```

---

## Resumo dos Indicadores-Chave (KPIs)

| Metrica | Alvo | Como medir |
|---------|------|------------|
| Rupturas ativas | 0 | GET /api/observability/stock-health |
| Taxa de resolucao de alertas | > 70% | Alertas resolvidos / (gerados - ignorados) |
| Tempo medio de resolucao (alto) | < 4h | Agg no OperationalAlert |
| Falsos positivos (ignorados) | < 30% | Alertas ignorados / totais |
| Divergencias percebidas | < 3/loja | Relato manual |
| Erros de software | 0 | Audit log + relato |
| Transferencias executadas | > 5/dia | GET /api/audit/daily-report |
| Compras registradas | > 3/dia | GET /api/audit/daily-report |
