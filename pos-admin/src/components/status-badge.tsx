import { cn } from "@/lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Circle,
  Info,
  Package,
  XCircle,
  LucideIcon,
} from "lucide-react";

const statusStyles: Record<string, string> = {
  // Original statuses (backward compatible)
  active: "bg-emerald-500/10 text-emerald-400",
  inactive: "bg-zinc-500/10 text-zinc-400",
  pending: "bg-amber-500/10 text-amber-400",
  approved: "bg-blue-500/10 text-blue-400",
  rejected: "bg-red-500/10 text-red-400",
  completed: "bg-emerald-500/10 text-emerald-400",
  cancelled: "bg-red-500/10 text-red-400",
  open: "bg-blue-500/10 text-blue-400",
  closed: "bg-zinc-500/10 text-zinc-400",
  "in_progress": "bg-brand-muted text-brand",
  ready: "bg-emerald-500/10 text-emerald-400",
  preparing: "bg-amber-500/10 text-amber-400",
  low: "bg-amber-500/10 text-amber-400",

  // Operational states (new)
  stockout: "bg-red-500/10 text-red-400",
  critical: "bg-red-500/10 text-red-400",
  ok: "bg-emerald-500/10 text-emerald-400",
  excess: "bg-blue-500/10 text-blue-400",
  no_policy: "bg-zinc-500/10 text-zinc-400",
  resolved: "bg-emerald-500/10 text-emerald-400",
  dismissed: "bg-zinc-500/10 text-zinc-400",
  high: "bg-red-500/10 text-red-400",
  medium: "bg-amber-500/10 text-amber-400",
};

const statusLabels: Record<string, string> = {
  stockout: "Ruptura",
  critical: "Critico",
  low: "Baixo",
  ok: "Normal",
  excess: "Excesso",
  no_policy: "Sem politica",
  resolved: "Resolvido",
  dismissed: "Ignorado",
  pending: "Pendente",
  high: "Alta prioridade",
  medium: "Media prioridade",
};

const statusIcons: Record<string, LucideIcon | undefined> = {
  stockout: XCircle,
  critical: AlertCircle,
  low: AlertTriangle,
  ok: CheckCircle,
  excess: Info,
  no_policy: Circle,
  resolved: CheckCircle,
  dismissed: Circle,
  pending: AlertTriangle,
  high: AlertCircle,
  medium: AlertTriangle,
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  /** Optional icon. If true, uses default icon for known statuses. If LucideIcon, uses that icon. */
  icon?: boolean | LucideIcon;
}

export function StatusBadge({ status, label, icon }: StatusBadgeProps) {
  const displayLabel = label || statusLabels[status] || status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const style = statusStyles[status] || "bg-zinc-500/10 text-zinc-400";

  const IconComponent = typeof icon === "boolean" && icon
    ? statusIcons[status]
    : typeof icon === "function"
      ? icon
      : undefined;

  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium", style)}>
      {IconComponent && <IconComponent className="h-3 w-3 shrink-0" />}
      {displayLabel}
    </span>
  );
}
