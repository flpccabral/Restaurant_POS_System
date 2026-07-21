---
name: post-phase9-1c-audit-sale
description: "Auditoria operacional da venda real #1779652479770 pos Fase 9.1C — analise tecnica completa"
metadata:
  type: project
---

**Ordem auditada:** #1779652479770
**Loja:** Loja Demo - Matriz (storeId: 6a1101372ff5c713c1b1a147)
**Contexto:** Primeira venda real apos correcoes da Fase 9.1C (StockBalances minimos, Recipe ativa, filtro cross-store, persistencia de erro, alertas operacionais)

**Referencias de codigo:**
- `pos-backend/controllers/orderController.js` — `processOrderStockDeduction`: endpoint que processa baixa com transacao MongoDB, salva failed status e alerta fora da transacao se hard error
- `pos-backend/services/orderCheckoutService.js` — `processOrderStockDeduction`: orquestra baixa all-or-nothing, resolve recipe por sku primeiro, trata recipe_composition / stock_item_direct / no_stock_impact / combo_components
- `pos-backend/models/orderModel.js` — Order com items contendo recipe, cogs, ingredientCosts, stockDeductionStatus, stockMovements
- `pos-backend/models/stockMovementModel.js` — Inclui `direct_sale_deduction` (Fase 9.1C) e `recipe_deduction`
- `pos-backend/models/operationalAlertModel.js` — `sale_without_stock_deduction` com findOrCreate dedup de 24h
- `pos-backend/controllers/observabilityController.js` — getAlerts, getTimeline, getOverview
- `pos-backend/services/observabilityService.js` — timeline unifica StockMovement + ProductionBatch + OperationalAlert

**Cenario esperado (Phase 9.1C):**
- 1x Hamburguer Artesanal (P) — recipe_composition, productId: 6a123a2b0824a97594d48d7a, sku: hamburguer-artesanal-p
- 1x Refrigerante (ou 2x Refrigerante Teste) — stock_item_direct, productId: 6a11e625f646322a50b7467d
- 1x Taxa de Servico — no_stock_impact, productId: 6a132b0d21b39baba982ac7b
- CMV esperado: R$ 19,88 (1x Hamburguer R$16,38 + 1x Refrigerante R$3,50 + 0) ou R$ 23,38 (2x Refrigerante)
- StockMovements esperados: 5 (recipe) + 1 (direct) = 6
- Saldo Refrigerante apos: 99 un (se 1) ou 98 un (se 2)

**Auditoria a executar:** Verificar 17 pontos: identificacao, origem, itens, recipe_composition, stock_item_direct, no_stock_impact, status baixa, StockMovements, saldos, CMV, alertas, timeline, idempotencia, cross-store, classificacao, decisao PDV, decisao piloto.

**Discrepancia identificada:** O cenario no Notion de auditoria (1x Refrigerante) difere do test-scenario-phase9-1c.json (2x Refrigerante). Confirmar qual foi vendido.
