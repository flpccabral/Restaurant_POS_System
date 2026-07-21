---
name: phase-842-complete
description: Phase 8.4.2 — Governance Product x Recipe x Stock Deduction complete. All builds pass, Notion report published.
metadata:
  type: project
---

# Phase 8.4.2 Complete

**Date**: 2026-05-23
**Status**: All 13 tasks implemented, builds pass, Notion report published at page `369457fd-4753-81e8-8b68-c5c709fc6a36`.

## Key facts
- Backend `productController.js` already has `hasActiveRecipe` in `getProducts` and `getProductById`
- `POST /api/orders/:id/process-stock-deduction` is the new lightweight endpoint for POS stock deduction (not `/api/pdv/payment` which also creates payments)
- POS `Bill.jsx` calls this endpoint non-blockingly after `addOrder` succeeds
- `sale_without_stock_deduction` alerts fire in `orderCheckoutService.js` (outside transaction, non-blocking)
- `product_without_recipe` alerts fire via `POST /api/observability/alerts/check-products-without-recipe`

## Why this approach
- Avoids coupling Product to Recipe (separate models)
- Avoids hard-blocking sales (business decision)
- Makes invisible risk visible (badge + filter + toast)
- POS integration is non-blocking to preserve existing UX

## Impact on Phase 8.5
Console migration can start. CMV data is reliable only for future orders. Historical CMV is not available.
