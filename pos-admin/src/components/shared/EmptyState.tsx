"use client";

import { Inbox, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface EmptyStateProps {
  /** Title text (required) */
  title: string;
  /** Optional description */
  description?: string;
  /** Optional icon component. Defaults to Inbox. */
  icon?: LucideIcon;
  /** Optional CTA button label */
  actionLabel?: string;
  /** Optional CTA click handler */
  onAction?: () => void;
}

/**
 * EmptyState — displays a centered empty state card with icon, title,
 * optional description, and optional CTA button.
 *
 * @example
 * ```tsx
 * <EmptyState
 *   title="Nenhum produto encontrado"
 *   description="Cadastre seu primeiro produto para comecar."
 *   actionLabel="Novo Produto"
 *   onAction={() => setCreating(true)}
 * />
 * ```
 */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Card className="bg-zinc-900 border-zinc-800 w-full max-w-md">
        <CardHeader>
          <div className="flex flex-col items-center text-center gap-3">
            <div className="p-3 rounded-full bg-zinc-800">
              <Icon className="h-6 w-6 text-zinc-500" />
            </div>
            <CardTitle className="text-zinc-200 text-lg">{title}</CardTitle>
          </div>
        </CardHeader>
        {description && (
          <CardContent>
            <p className="text-sm text-zinc-400 text-center">{description}</p>
          </CardContent>
        )}
        {actionLabel && onAction && (
          <CardFooter className="justify-center">
            <Button
              variant="outline"
              onClick={onAction}
              className="border-zinc-700 text-zinc-300 hover:text-white"
            >
              {actionLabel}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
