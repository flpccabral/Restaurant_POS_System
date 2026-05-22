import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400",
  inactive: "bg-zinc-500/10 text-zinc-400",
  pending: "bg-yellow-500/10 text-yellow-400",
  approved: "bg-blue-500/10 text-blue-400",
  rejected: "bg-red-500/10 text-red-400",
  completed: "bg-emerald-500/10 text-emerald-400",
  cancelled: "bg-red-500/10 text-red-400",
  open: "bg-blue-500/10 text-blue-400",
  closed: "bg-zinc-500/10 text-zinc-400",
  "in_progress": "bg-orange-500/10 text-orange-400",
  ready: "bg-emerald-500/10 text-emerald-400",
  preparing: "bg-amber-500/10 text-amber-400",
  low: "bg-red-500/10 text-red-400",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const displayLabel = label || status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const style = statusStyles[status] || "bg-zinc-500/10 text-zinc-400";

  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", style)}>
      {displayLabel}
    </span>
  );
}
