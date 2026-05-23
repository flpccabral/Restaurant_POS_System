"use client";

import { cn } from "@/lib/utils";

export interface FilterPillOption {
  value: string;
  label: string;
}

interface FilterPillsProps {
  options: FilterPillOption[];
  selected: string | null;
  onChange: (value: string | null) => void;
  className?: string;
  /** Optional "All" label. Defaults to "Todas". Set to empty string to hide. */
  allLabel?: string;
}

/**
 * FilterPills — small rounded toggle buttons for filtering by status,
 * severity, type, etc. Used in Console tabs.
 *
 * @example
 * ```tsx
 * <FilterPills
 *   options={[
 *     { value: "stockout", label: "Ruptura" },
 *     { value: "low", label: "Baixo" },
 *   ]}
 *   selected={activeFilter}
 *   onChange={setActiveFilter}
 * />
 * ```
 */
export function FilterPills({
  options,
  selected,
  onChange,
  className,
  allLabel = "Todas",
}: FilterPillsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {allLabel !== undefined && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
            selected === null
              ? "bg-brand text-brand-foreground"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          )}
        >
          {allLabel}
        </button>
      )}
      {options.map((option) => {
        const isActive = selected === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(isActive ? null : option.value)}
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
              isActive
                ? "bg-brand text-brand-foreground"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
