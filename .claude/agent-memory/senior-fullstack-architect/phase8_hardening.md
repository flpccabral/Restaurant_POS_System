---
name: phase8-hardening
description: Phase 8 — Hardening Operacional e Preparação para Piloto. Permission model, audit logging, UX hardening, pilot docs.
metadata:
  type: project
---

Phase 8 implemented hardening for pilot readiness:

**Permission model** (Tasks 1-4):
- Backend `GET /api/user` now populates `role` so permissions reach the frontend
- `userSlice.js` stores `rolePermissions` (nested permission object from Role model) and `isMasterAdmin`
- `useCapabilities` hook created at `pos-frontend/src/hooks/useCapabilities.js` with `can(module, action)` that checks `user.rolePermissions[module][action]`, with admin/masterAdmin bypass
- Applied to: `OperationalConsole` (tab filtering), `AlertsTab` (Resolver/Ignorar visibility), `RecommendationsTab` (transfer vs purchase button visibility), `PolicyTab` (Criar/Editar/Excluir visibility)

**Audit logging** (Task 5):
- Model: `pos-backend/models/operationalAuditLogModel.js` — 9 action types, stores user/store/ingredient/entity before/after/metadata
- Service: `pos-backend/services/auditService.js` — `logAction()` never throws, `queryLogs()` with filters/date range
- Route: `pos-backend/routes/auditRoute.js` — GET /api/audit with inventory:read guard
- Wired into observabilityController (resolveAlert, dismissAlert, registerPurchase), stockPolicyController (create/update/delete), transferController (central), interStoreTransferController (inter-store)

**Pilot docs** (Tasks 7-8):
- `pos-backend/PILOT_GUIDE.md` — quick reference for console usage
- `pos-backend/PILOT_CHECKLIST.md` — 70+ item validation checklist in Portuguese
