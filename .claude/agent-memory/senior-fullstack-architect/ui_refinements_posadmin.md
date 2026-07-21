---
name: ui-refinements-posadmin
description: Phase 9 — UI refinements for pos-admin layout (dark theme, shadows, KPI accents, sidebar glow, hover lift)
metadata:
  type: project
---

2026-05-23: Implemented 5 visual refinements to the pos-admin layout:

1. **Card depth (shadow-card + shadow-elevated)**: Custom shadow tokens using `--shadow-card-value` CSS variable, themed differently for light (`:root`) and dark (`.dark`) modes. Dark mode shadows use white glow (`rgba(255 255 255 / 0.03)`) for elevation effect. Applied to the base shadcn `Card` component.

2. **KPI Card colored accents**: Each metric card now has a thin colored top bar via an absolutely positioned `<span>` with `style={{ backgroundColor: 'var(--${colorName})' }}`. Color is derived from the `color` prop (e.g., `text-brand` -> `var(--brand)`). Icon container backgrounds also match the card type.

3. **Sidebar refinements**: Section labels got a decorative horizontal rule (`flex-1 h-px bg-sidebar-border/30`) and increased opacity (30% -> 45%). Active indicator is now thicker (w-1 instead of w-0.5) with `shadow-[0_0_8px_rgba(255,180,0,0.35)]` glow. Hover items have a subtle inner shadow highlight.

4. **Hover lift on cards**: `hover:shadow-elevated hover:-translate-y-0.5` with `transition-all duration-200` on all Card components.

5. **Dashboard gradient glow**: A positioned `bg-brand/5 rounded-full blur-[120px]` pseudo-element behind the page header area creates a warm ambient glow.

Key learnings:
- Tailwind v4 CSS-first: `@theme inline` with `var()` references works for shadow tokens (following same pattern as colors)
- `@layer utilities` fallback ensures shadow classes work regardless of Tailwind's utility generation
- Inline styles for dynamic CSS variables (like `var(--brand)`) are cleaner than attempting dynamic Tailwind class construction
- Dark mode shadows need white glow at very low opacity (1-5%) to create elevation; black-only shadows are invisible on dark backgrounds

Related: [[phase8_hardening]]
