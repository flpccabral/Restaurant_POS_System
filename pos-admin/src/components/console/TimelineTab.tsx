"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCapabilities } from "@/hooks/useCapabilities";
import { observabilityService } from "@/services/api/observability";
import { StatusBadge } from "@/components/status-badge";
import { FilterPills } from "@/components/shared/FilterPills";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUpFromLine,
  ArrowDownToLine,
  ArrowLeftRight,
  Factory,
  AlertTriangle,
  Plus,
  Minus,
} from "lucide-react";
import type { TimelineEvent } from "@/types";

const eventTypeIcons: Record<string, React.ReactNode> = {
  addition: <Plus className="h-4 w-4 text-success" />,
  deduction: <Minus className="h-4 w-4 text-critical" />,
  transfer_in: <ArrowDownToLine className="h-4 w-4 text-info" />,
  transfer_out: <ArrowUpFromLine className="h-4 w-4 text-warning" />,
  production_completed: <Factory className="h-4 w-4 text-[#a29bfe]" />,
  stockout: <AlertTriangle className="h-4 w-4 text-critical" />,
  critical_stock: <AlertTriangle className="h-4 w-4 text-warning" />,
  movement: <ArrowLeftRight className="h-4 w-4 text-info" />,
  production: <Factory className="h-4 w-4 text-[#a29bfe]" />,
  alert: <AlertTriangle className="h-4 w-4 text-warning" />,
};

const typeFilters = [
  { value: "movement", label: "Movimentacoes" },
  { value: "production", label: "Producoes" },
  { value: "alert", label: "Alertas" },
];

export function TimelineTab() {
  const { storeId } = useCapabilities();
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["timeline", storeId],
    queryFn: () => observabilityService.getTimeline({ limit: 100 }),
    enabled: !!storeId,
    staleTime: 60_000,
  });

  if (!storeId) {
    return <EmptyState title="Nenhuma loja" description="Nenhuma loja associada ao usuario." />;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message="Falha ao carregar timeline operacional."
        onRetry={refetch}
      />
    );
  }

  const events: TimelineEvent[] = data?.data?.events ?? [];

  const filtered =
    !typeFilter || typeFilter === "all"
      ? events
      : events.filter((e) => e.type === typeFilter);

  if (events.length === 0) {
    return <EmptyState title="Nenhum evento" description="Nenhum evento operacional registrado." />;
  }

  return (
    <div className="space-y-4">
      <FilterPills
        options={typeFilters}
        selected={typeFilter}
        onChange={setTypeFilter}
        allLabel="Todos"
      />

      {filtered.length === 0 ? (
        <EmptyState title="Nenhum evento" description="Nenhum evento com este filtro." />
      ) : (
        <div className="space-y-2">
          {filtered.map((event, idx) => {
            const icon =
              eventTypeIcons[event.eventType] ??
              eventTypeIcons[event.type] ?? (
                <div className="h-4 w-4 rounded-full bg-muted-foreground/30" />
              );
            const timestamp = new Date(event.timestamp).toLocaleString("pt-BR");

            return (
              <div
                key={`${event.type}-${idx}-${event.timestamp}`}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="mt-0.5 shrink-0">{icon}</div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground/90">
                      {(event.eventType || event.type).replace(/_/g, " ")}
                    </span>
                    {event.severity && (
                      <StatusBadge status={event.severity} />
                    )}
                    {event.ingredient && (
                      <span className="text-xs text-muted-foreground">
                        {event.ingredient}
                      </span>
                    )}
                  </div>

                  {event.type === "movement" && (
                    <div className="text-xs text-muted-foreground space-x-3">
                      <span>
                        Qtd:{" "}
                        <span className="text-foreground/70 font-medium">
                          {event.quantity}{event.unit}
                        </span>
                      </span>
                      {event.location && <span>{event.location}</span>}
                      {event.reason && (
                        <span className="text-muted-foreground/60">{event.reason}</span>
                      )}
                    </div>
                  )}

                  {event.type === "production" && (
                    <div className="text-xs text-muted-foreground">
                      <span>
                        Outputs:{" "}
                        {event.outputs
                          ?.map((o) => `${o.ingredient} (${o.quantity}${o.unit})`)
                          .join(", ") || "-"}
                      </span>
                      {event.user && (
                        <span className="ml-3 text-muted-foreground/60">
                          por {event.user}
                        </span>
                      )}
                    </div>
                  )}

                  {event.type === "alert" && event.message && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {event.message}
                    </p>
                  )}

                  <span className="text-xs text-muted-foreground/50 block mt-0.5">
                    {timestamp}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
