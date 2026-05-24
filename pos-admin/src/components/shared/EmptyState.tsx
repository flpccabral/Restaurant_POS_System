"use client";

import {
  Inbox,
  Search,
  SearchX,
  Package,
  ScrollText,
  Bell,
  CheckCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Variant icons and their visual identity.
 * Each variant maps to a default icon and a color scheme.
 */
const variantConfig: Record<
  string,
  { icon: LucideIcon; circleBg: string; iconColor: string }
> = {
  default: {
    icon: Inbox,
    circleBg: "bg-zinc-800",
    iconColor: "text-zinc-500",
  },
  search: {
    icon: Search,
    circleBg: "bg-blue-500/10",
    iconColor: "text-blue-400",
  },
  empty: {
    icon: Package,
    circleBg: "bg-zinc-800",
    iconColor: "text-zinc-500",
  },
  inventory: {
    icon: Package,
    circleBg: "bg-brand/10",
    iconColor: "text-brand",
  },
  recipe: {
    icon: ScrollText,
    circleBg: "bg-purple-500/10",
    iconColor: "text-purple-400",
  },
  alert: {
    icon: Bell,
    circleBg: "bg-warning/10",
    iconColor: "text-warning",
  },
  success: {
    icon: CheckCircle,
    circleBg: "bg-success/10",
    iconColor: "text-success",
  },
};

interface EmptyStateProps {
  /** Title text (required) */
  title: string;
  /** Optional description */
  description?: string;
  /**
   * Visual variant. Controls the default icon and color scheme.
   * - `default`: generic inbox icon
   * - `search`: search / no results
   * - `empty`: empty box / nothing here yet
   * - `inventory`: stock/inventory context
   * - `recipe`: recipe/formula context
   * - `alert`: notification / alert context
   * - `success`: positive / completion state
   *
   * @default "default"
   */
  variant?: keyof typeof variantConfig;
  /** Optional icon component override (takes precedence over variant default) */
  icon?: LucideIcon;
  /** Optional CTA button label */
  actionLabel?: string;
  /** Optional CTA click handler */
  onAction?: () => void;
  /** Optional children rendered inside CardContent (below description, above CTA) */
  children?: React.ReactNode;
  /** Additional className for the wrapper div */
  className?: string;
  /** Minimum height for the wrapper. @default "min-h-[300px]" */
  minHeight?: string;
}

/**
 * EmptyState — displays a centered empty state card with icon, title,
 * optional description, optional children, and optional CTA button.
 *
 * Supports visual variants via the `variant` prop for contextual iconography.
 * Includes a subtle fade-in animation on mount.
 *
 * @example
 * ```tsx
 * <EmptyState
 *   title="Nenhum produto encontrado"
 *   description="Cadastre seu primeiro produto para comecar."
 *   variant="empty"
 *   actionLabel="Novo Produto"
 *   onAction={() => setCreating(true)}
 * />
 * ```
 */
export function EmptyState({
  title,
  description,
  variant = "default",
  icon,
  actionLabel,
  onAction,
  children,
  className,
  minHeight = "min-h-[300px]",
}: EmptyStateProps) {
  const config = variantConfig[variant] ?? variantConfig.default;
  const Icon = icon ?? config.icon;

  return (
    <div
      className={cn(
        "flex items-center justify-center animate-in fade-in duration-300",
        minHeight,
        className,
      )}
    >
      <Card className="bg-zinc-900 border-zinc-800 w-full max-w-md">
        <CardHeader>
          <div className="flex flex-col items-center text-center gap-4">
            <div
              className={cn(
                "p-4 rounded-full transition-transform duration-300 group-hover:scale-105",
                config.circleBg,
              )}
            >
              <Icon className={cn("h-8 w-8", config.iconColor)} strokeWidth={1.5} />
            </div>
            <CardTitle className="text-zinc-200 text-lg">{title}</CardTitle>
          </div>
        </CardHeader>
        {(description || children) && (
          <CardContent className="space-y-4">
            {description && (
              <p className="text-sm text-zinc-400 text-center leading-relaxed max-w-sm mx-auto">
                {description}
              </p>
            )}
            {children}
          </CardContent>
        )}
        {actionLabel && onAction && (
          <CardFooter className="justify-center pt-0">
            <Button
              variant="outline"
              onClick={onAction}
              className="border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              {actionLabel}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
