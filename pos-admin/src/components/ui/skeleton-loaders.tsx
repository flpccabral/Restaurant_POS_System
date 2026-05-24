import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Deterministic pseudo-random number seeded by an index.
 * Replaces Math.random() to avoid SSR hydration mismatches.
 */
function hash(i: number, seed = 0): number {
  let h = (i + seed) * 2654435761;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h >>> 0) / 4294967296;
}

/* ------------------------------------------------------------------ */
/*  Base Skeleton helper                                               */
/* ------------------------------------------------------------------ */

function Bone({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-zinc-800/60", className)}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  TableSkeleton — mimics a table with header + variable-width rows   */
/* ------------------------------------------------------------------ */

interface TableSkeletonProps {
  /** Number of data rows. @default 5 */
  rows?: number;
  /** Number of columns. @default 4 */
  columns?: number;
  /** Show a search bar above the table. @default false */
  search?: boolean;
  className?: string;
}

/**
 * Renders a skeleton that looks like a table — header row plus body rows
 * with varied column widths for a realistic appearance.
 */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  search: showSearch = false,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {showSearch && <Bone className="h-10 w-72 rounded-md" />}
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="flex gap-4 bg-zinc-900 px-4 py-3 border-b border-zinc-800">
          {Array.from({ length: columns }).map((_, i) => (
            <Bone
              key={`h-${i}`}
              className="h-4 rounded"
              style={{ width: `${50 + hash(i) * 30}%` }}
            />
          ))}
        </div>
        {/* Body rows */}
        <div className="divide-y divide-zinc-800">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={`r-${r}`} className="flex gap-4 px-4 py-3">
              {Array.from({ length: columns }).map((_, c) => (
                <Bone
                  key={`c-${r}-${c}`}
                  className="h-4 rounded"
                  style={{ width: `${40 + hash(r * columns + c) * 50}%` }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CardSkeleton — mimics a KPI / stat card                            */
/* ------------------------------------------------------------------ */

interface CardSkeletonProps {
  className?: string;
}

/**
 * Renders a skeleton that looks like a KPI card — small label area,
 * large value placeholder, and a footer line.
 */
export function CardSkeleton({ className }: CardSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3",
        className,
      )}
    >
      {/* Title row */}
      <div className="flex items-center gap-2">
        <Bone className="h-4 w-4 rounded-full" />
        <Bone className="h-3.5 w-24 rounded" />
      </div>
      {/* Value */}
      <Bone className="h-8 w-20 rounded" />
      {/* Footer / trend */}
      <Bone className="h-3 w-32 rounded" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StatsGridSkeleton — a responsive grid of CardSkeletons             */
/* ------------------------------------------------------------------ */

interface StatsGridSkeletonProps {
  /** Number of cards. @default 4 */
  count?: number;
  /** Grid columns class. @default "grid-cols-2 md:grid-cols-4" */
  columns?: string;
  className?: string;
}

/**
 * Renders a responsive grid of CardSkeleton placeholders.
 * Useful for dashboard KPI rows.
 */
export function StatsGridSkeleton({
  count = 4,
  columns = "grid-cols-2 md:grid-cols-4",
  className,
}: StatsGridSkeletonProps) {
  return (
    <div className={cn("grid gap-4", columns, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FormSkeleton — mimics a form with labelled fields                  */
/* ------------------------------------------------------------------ */

interface FormSkeletonProps {
  /** Number of form fields. @default 4 */
  fields?: number;
  /** Show a submit button at the bottom. @default true */
  submit?: boolean;
  className?: string;
}

/**
 * Renders a skeleton that looks like a form — label + input pairs
 * of varied widths, with an optional submit button.
 */
export function FormSkeleton({
  fields = 4,
  submit: showSubmit = true,
  className,
}: FormSkeletonProps) {
  return (
    <div className={cn("space-y-5", className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Bone className="h-3.5 w-28 rounded" />
          <Bone
            className="h-10 rounded-md"
            style={{ width: `${60 + hash(i) * 40}%` }}
          />
        </div>
      ))}
      {showSubmit && <Bone className="h-10 w-32 rounded-md" />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FilterPillsSkeleton — row of pill-shaped placeholders              */
/* ------------------------------------------------------------------ */

interface FilterPillsSkeletonProps {
  /** Number of pills. @default 4 */
  count?: number;
  className?: string;
}

/**
 * Renders a row of pill-shaped skeleton placeholders to mimic
 * FilterPills / status filter bars.
 */
export function FilterPillsSkeleton({
  count = 4,
  className,
}: FilterPillsSkeletonProps) {
  return (
    <div className={cn("flex gap-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Bone
          key={i}
          className="h-8 rounded-full"
          style={{ width: `${60 + hash(i) * 40}px` }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TimelineSkeleton — mimics a list of timeline / alert events        */
/* ------------------------------------------------------------------ */

interface TimelineSkeletonProps {
  /** Number of event rows. @default 4 */
  rows?: number;
  className?: string;
}

/**
 * Renders a skeleton that looks like a list of timeline events —
 * icon circle, title line, and description line per row.
 */
export function TimelineSkeleton({
  rows = 4,
  className,
}: TimelineSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4"
        >
          {/* Icon placeholder */}
          <Bone className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            {/* Title row */}
            <Bone className="h-4 w-3/5 rounded" />
            {/* Description */}
            <Bone className="h-3 w-full rounded" />
            {/* Timestamp */}
            <Bone className="h-3 w-24 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
