---
name: brand-tokens-pattern
description: "pos-admin uses @theme inline + CSS vars for brand colors. Brand = amber/gold oklch(0.68 0.16 70). Semantic tokens: success, warning, critical, info."
metadata:
  type: reference
---

**Design tokens location:** `pos-admin/src/app/globals.css`

**Pattern:** Tailwind v4 uses `@theme inline { --color-brand: var(--brand); }` mapping, with actual values in `:root` and `.dark` blocks.

**Brand color:** `--brand: oklch(0.68 0.16 70)` (amber/gold, not generic orange). Tailwind classes: `bg-brand`, `text-brand`, `bg-brand-muted`, etc.

**Semantic colors:** `--success` (green), `--warning` (amber, reuses brand), `--critical` (red), `--info` (blue) — each with `-foreground` pair.

**Opacity variants:** Use `/10` or define pre-computed `--brand-muted: oklch(0.68 0.16 70 / 0.1)` for consistent 10% backgrounds.

**Charts:** Recharts accept `var(--brand)` as CSS custom property for `fill`/`stroke` attributes in SVG.

Never use `bg-orange-*`/`text-orange-*` classes — use `bg-brand`/`text-brand` instead.
