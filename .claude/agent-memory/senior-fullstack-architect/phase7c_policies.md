---
name: phase7c-policies
description: Phase 7C — Policy tab with full CRUD, PolicyFormModal, usePolicyActions hook, inter-store transfer bugfix
metadata:
  type: project
---

Phase 7C implemented on 2026-05-22. Adds 6th "Politicas" tab to the Operational Console (`/console`) with full CRUD for StockPolicy management.

## Files created
- `pos-frontend/src/components/console/PolicyTab.jsx` — Tab with table of policies, filter pills (priority, active/inactive), search by ingredient, create/edit/delete buttons. Uses useQuery for fetch, LoadingState/ErrorState/EmptyState.
- `pos-frontend/src/components/console/PolicyFormModal.jsx` — Generic modal for create/edit. Form fields: store (select or disabled for non-master-admin), location (filtered by store), ingredient (auto-populates unit), min/reorder/ideal/max, unit, priority, isActive. Client-side validation: all required, non-negative, hierarchical min<=reorder<=ideal<=max. framer-motion animation.
- `pos-frontend/src/hooks/usePolicyActions.js` — useMutation for create/update/delete stock policies. Invalidates stockPolicies, stockHealth, alerts, recommendations, timeline queries on success. Snackbar notifications via notistack.

## Files modified
- `pos-backend/services/interStoreTransferService.js` — Fixed bug where originStore/destStore names were swapped. Changed `Store.find({ $in: [...] })` (no order guarantee) to `Promise.all([Store.findById(...), Store.findById(...)])` for deterministic assignment.
- `pos-frontend/src/https/index.js` — Added `createStockPolicy`, `updateStockPolicy`, `deleteStockPolicy`, `getIngredients`, `getStores`, `getLocations` API functions.
- `pos-frontend/src/pages/OperationalConsole.jsx` — Added "Politicas" (MdGavel) tab and PolicyTab rendering.

## Key architectural decisions
- PolicyFormModal fetches stores via `GET /api/store`, locations via `GET /api/stock/locations?type=STORE`, ingredients via `GET /api/ingredient?isActive=true`
- For non-master-admin users, the store field is disabled and auto-set to the user's store from Redux
- The delete API is a soft-delete (sets isActive=false on the backend)
- Validation exists on both client (before submit) and server (mongoose schema pre-validate hook)
