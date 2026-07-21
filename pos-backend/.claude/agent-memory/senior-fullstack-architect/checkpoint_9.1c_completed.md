---
name: checkpoint-9-1c-completed
description: Fase 9.1C operational preparation for real sale at Loja Demo - Matriz completed
metadata:
  type: project
---

**Fase 9.1C — Preparacao operacional minima da Loja Demo para venda real — CONCLUIDA**

Completion date: 2026-05-24

**What was done:**
- StockBalances created/validated for 6 ingredients at Loja Demo - Matriz (store: 6a1101372ff5c713c1b1a147, location: 6a1101527a7bf001d8117a4c)
- Hamburguer Artesanal (P) product metadata updated (sellableType, stockImpactRule) and Recipe updated with correct variation/SKU and ingredient quantities (Carne Bovina 180g, Pao Hamburguer 1un, Queijo 50g, Alface 1un, Tomate 40g)
- Taxa de Servico product created (no_stock_impact)
- Cross-store filtering fixed (MenuContainer now passes storeId in getProducts query)
- findRecipeForItem improved to search by sku first, then variation, then fallback
- Bill.jsx updated: stock failure shows backend reason, no auto-clear cart on hard error, error variant with 10s duration
- orderController updated: saves order.failed status outside transaction after abort, creates OperationalAlert for hard errors
- All-or-nothing policy documented in orderCheckoutService.js
- Test scenario JSON created at scripts/test-scenario-phase9-1c.json
- Backend tests 19/19 passed, frontend build succeeded
- Report published to Notion page 36a457fd-4753-81ae-a5e7-d1a703bc69fc

**Decision:** Ready for next controlled real sale using the test scenario (1 Hamburguer Artesanal P + 2 Refrigerante Teste + 1 Taxa de Servico).
