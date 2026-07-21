---
name: phase-932-fix-complete
description: Phase 9.3D-FIX — PDV entry and navigation unification implemented for pos-frontend
metadata:
  type: project
---

Phase 9.3D-FIX COMPLETE (2026-05-25): all changes build without errors.

## Changes made to pos-frontend:

1. **Login.jsx** (line 33): Post-login redirect changed from `navigate("/")` to `navigate("/menu")` so operators land directly on the PDV.

2. **Home.jsx**: Transformed into operational launcher dashboard.
   - Added launcher panel at top of left column with:
     - "Abrir PDV" (primary CTA, full-width blue button) → `/menu`
     - "Balcao" → dispatches `setOrderType('counter')`, `updateTable({ table: null })`, navigates to `/menu`
     - "Mesas" → `/tables`
     - "Pedidos" → `/orders`
   - Replaced `BottomNav` with `PdvFooterActions` for unified navigation
   - KPIs (Ganhos Totais, Em Preparo), RecentOrders, PopularDishes, Greetings preserved

3. **Orders.jsx**: Replaced `BottomNav` with `PdvFooterActions`.

4. **Tables.jsx**: Replaced `BottomNav` with `PdvFooterActions`.

## Navigation matrix after fix:
- `/` (Home) → PdvFooterActions (Funcoes, Comanda, Mesas, Balcao, Sair)
- `/menu` → PdvFooterActions (same)
- `/orders` → PdvFooterActions (same)
- `/tables` → PdvFooterActions (same)

## Critical: NOT changed
- Auth flow, store, role, orderType, paymentStatus, closeStatus
- Counter mode, table mode, accumulated bill, table closing
- New order on occupied table, KDS sync, stock/CMV
- Observations, search, Menu page, PdvFooterActions component
