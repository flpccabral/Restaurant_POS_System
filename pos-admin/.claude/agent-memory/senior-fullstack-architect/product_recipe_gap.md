---
name: product-recipe-gap
description: Phase 8.4.2 COMPLETE — Product-Recipe-POS-Governance implemented. MVP Recipe UI, POS stock deduction pipeline, alerts all wired.
metadata:
  type: project
---

# Phase 8.4.2 Complete — Governance Product x Recipe x Stock Deduction

## Summary
Phase 8.4.2 has been fully implemented (2026-05-23). The critical gap between Product, Recipe, POS sale, and stock deduction has been addressed with minimum governance.

## What was built
- **Recipe status column** in pos-admin products table with green/red badges
- **FilterPills** to filter products "Com receita" / "Sem receita"
- **Warning toast** when saving product without recipe (does not block save)
- **"Criar receita"** action button linking to `/recipes/new?productId=<id>`
- **Recipe API service** (`pos-admin/src/services/api/recipes.ts`) — all backend endpoints mapped
- **MVP Recipe UI** at `/recipes` — list, create/edit dialog, detail dialog, ingredient management, validation
- **POS stock deduction** — new endpoint `POST /api/orders/:id/process-stock-deduction`, wired from POS `Bill.jsx`
- **product_without_recipe alerts** — `POST /api/observability/alerts/check-products-without-recipe`
- **sale_without_stock_deduction alerts** — automatic in `orderCheckoutService.js` when items have no recipe
- **Sidebar** — "Fichas Tecnicas" menu item added

## Key architectural decisions
- Product and Recipe remain SEPARATE models (Recipe -> Product, not Product -> Recipe)
- Product without recipe CAN exist but is now VISIBLE (risk shown, not hidden)
- Sales without recipe are NOT blocked — instead: sale proceeds, failure logged, alert generated
- POS integration uses non-blocking call after order creation (does not break existing flow)
- Recipe simple (1 ingredient) for resale/ready-to-consume products like soda

## Build status
- Backend: 78/78 tests pass
- Admin: Next.js 16 build successful (16 routes)
- Frontend: Vite build successful (588 modules)

## Impact on Phase 8.5
Phase 8.5 (Console migration) can begin. CMV historical is NOT available — only future orders will have correct CMV via the pipeline. The Console should show product recipe status, alerts, and stock data that is now reliable.
