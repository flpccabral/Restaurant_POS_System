---
name: phase-8.4.1-visual-foundation
description: "Fase 8.4.1 — Foundation Visual do pos-admin. Brand amber/gold tokens, orange replacement, Tabs, DataTable pagination, StatusBadge, ConfirmDialog async, EmptyState, FilterPills."
metadata:
  type: project
---

Phase 8.4.1 is complete. The pos-admin now has a visual foundation for the Console (Phase 8.5).

**Brand tokens (globals.css):** `--brand` (oklch(0.68 0.16 70) = amber/gold), `--brand-foreground`, `--brand-muted`, `--success`, `--warning`, `--critical`, `--info` with foreground pairs. All in @theme inline block for Tailwind v4 classes.

**Orange replacement:** All ~30 files using `bg-orange-500`, `text-orange-500`, `hover:bg-orange-600`, `bg-orange-500/10` replaced with `bg-brand`, `text-brand`, `bg-brand-muted` etc. Zero orange refs remain in src/.

**Why:** The project needed a distinct brand identity (not generic orange) before Console migration.

**Components created:**
- `pos-admin/src/components/ui/tabs.tsx` — using @base-ui/react/tabs, accessible, dark mode, icon+label
- `pos-admin/src/components/shared/FilterPills.tsx` — small rounded toggle buttons for Console filters
- `pos-admin/src/components/shared/EmptyState.tsx` — icon + title + description + optional CTA

**Components modified:**
- `pos-admin/src/components/data-table.tsx` — added `pageSize` prop, pagination (prev/next, page indicator, total count)
- `pos-admin/src/components/status-badge.tsx` — 11 operational states with PT-BR labels, optional icons
- `pos-admin/src/components/confirm-dialog.tsx` — async onConfirm, loading spinner, error display, prevents double-click
- `pos-admin/src/components/kpi-card.tsx` — default color changed to brand

**Key learnings for Phase 8.5:**
- ConfirmDialog's `onConfirm` typing: `() => void | Promise<void>` requires callers to handle null properly
- base-ui Select's `onValueChange` can pass `string | null` — need null coalescing
- Charts (Recharts) accept `var(--brand)` as CSS custom property for fill/stroke
- Build commands: `cd /Users/felipe/Projetos/Restaurant_POS_System/pos-admin && npm run build`
- Notion page ID for Fase 8.4.1 report: `369457fd-4753-81fc-8f07-fc207cf96332`

**Ready for Phase 8.5:** Yes, with reservations (KpiCard may need compact variant, DataTable lacks sorting).
