---
name: Phase 9.0A Conceptual Review
description: Audit of Product x Stock x Production x POS models, taxonomy proposal, and migration plan for Phase 9.1
metadata:
  type: project
---

## Phase 9.0A — Conceptual Review Complete

**Completed:** 2026-05-24
**Report published to:** Notion page 36a457fd-4753-815b-8c56-c2abc4fd378c

### Key Findings

1. **Product model has no stock impact awareness** — no sellableType, stockImpactRule, or directStockItem fields. Product is purely a POS/sales entity.

2. **`hasActiveRecipe` is binary and computed at query time** (productController.js:165-175 and :220-224) — not a stored field. Products without Recipe generate alerts but cannot use "direct stock deduction" for industrialized resale items.

3. **Recipe serves two conflicting purposes**: (a) sale consumption recipe (what stock to deduct when selling), and (b) production template (referenced by ProductionBatch.productionRecipe).

4. **GlobalIngredient** has the most evolved model (itemType, productionState, isByproduct from Phase 5.1A) but these fields are NOT exposed in the pos-admin ingredients UI.

5. **No production page exists in pos-admin** — ProductionBatch is API-only.

6. **Checkout is hard-dependent on Recipe** — no fallback for direct deduction, no_stock_impact, or combo recursion.

### Recommended Architecture Decision

**Option A — Evolve existing models** (not Option B "new entity" or Option C "force everything as Recipe"):

- Add `sellableType` (prepared_product, industrialized_resale, combo, service_fee) to Product
- Add `stockImpactRule` (recipe_composition, stock_item_direct, no_stock_impact, combo_components) to Product
- Add `directStockItem` (ref GlobalIngredient) to Product for direct deduction items
- Replace `hasActiveRecipe` with computed `productReadinessStatus` enum
- Add `type` field ('sale' | 'production') to Recipe to disambiguate
- Expand `GlobalIngredient.itemType` enum to include 'industrialized' and 'service'

**Why:** Best cost-benefit ratio. Full backward compatibility. Medium complexity. Fixes the core gap without introducing a new entity (Option B) or polluting the domain (Option C).

### Phase 9.1 Recommended Scope
1. Model changes (sellableType, stockImpactRule, directStockItem)
2. productReadinessStatus computed field (replaces hasActiveRecipe)
3. Checkout support for stock_item_direct and no_stock_impact
4. GlobalIngredient.itemType expansion
5. NOT included: combo recursion, ProductionRecipe model, full UI reform

### Migration Strategy
- Products WITH active Recipe -> prepared_product + recipe_composition
- Products WITHOUT Recipe -> keep recipe_composition (becomes ready_missing_recipe)
- Refrigerante -> industrialized_resale + stock_item_direct + new GlobalIngredient "Refrigerante"
- Keep hasActiveRecipe as deprecated computed field for backward compatibility

See [[phase8_hardening]] for the prior hardening phase context.
