---
name: checkpoint-8-4-2-completed
description: Checkpoint Runtime Fase 8.4.2 completed successfully, all 11 criteria met, Fase 8.5 approved
metadata:
  type: project
---

Checkpoint Runtime Fase 8.4.2 executed on 2026-05-23. All 11 acceptance criteria met.

**Key findings:**
1. Stock deduction endpoint: `POST /api/order/:id/process-stock-deduction` (singular) — frontend calls same URL, no divergence.
2. Route ordering bug in `recipeRoute.js`: static routes (`/without-recipe`, `/sellable`, `/non-sellable`) were placed AFTER `/:id`, causing CastError. FIXED by reordering.
3. Scenario A (product with active recipe): stock deducted, CMV calculated (R$ 17.20), StockMovement created, no false alerts.
4. Scenario B (product without recipe): status `no_recipes`, alert `sale_without_stock_deduction` (critical) generated, `product_without_recipe` alert (high) available via dedicated endpoint.
5. Scenario C (resale product with 1-ingredient recipe): exactly 1 unit deducted per item, CMV calculated, no false alerts.
6. Double deduction: idempotent — second call returns "Stock already deducted" with no balance change.
7. Backend tests: 19/19 pass. pos-admin build: OK. pos-frontend build: OK.
8. Seed data issue: "Pao de hamburguer PHASE7B" had no stock in "Loja Demo - Matriz" despite being referenced by the seeded recipe. Stock had to be created manually.
9. Ingredient costs: all 79 ingredients have `costPerUnit = null`, meaning CMV values may not reflect real costs.

**Decision:** Fase 8.5 may proceed.
