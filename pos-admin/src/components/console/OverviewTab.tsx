"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Package,
  AlertTriangle,
  TrendingDown,
  CheckCircle,
  ShoppingCart,
  FileWarning,
  Lightbulb,
} from "lucide-react";
import { useCapabilities } from "@/hooks/useCapabilities";
import { observabilityService } from "@/services/api/observability";
import { KpiCard } from "@/components/kpi-card";
import { StatusBadge } from "@/components/status-badge";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";

export function OverviewTab() {
  const { storeId } = useCapabilities();

  const {
    data: stockHealth,
    isLoading: healthLoading,
    isError: healthError,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ["stockHealth", storeId],
    queryFn: () => observabilityService.getStockHealth(storeId || ""),
    enabled: !!storeId,
    staleTime: 60_000,
  });

  const {
    data: alertsData,
    isLoading: alertsLoading,
    isError: alertsError,
    refetch: refetchAlerts,
  } = useQuery({
    queryKey: ["alerts", storeId],
    queryFn: () => observabilityService.getAlerts({ limit: 5 }),
    staleTime: 60_000,
  });

  if (!storeId) {
    return <EmptyState title="Nenhuma loja" description="Nenhuma loja associada ao usuario." />;
  }

  const isLoading = healthLoading || alertsLoading;
  const isError = healthError || alertsError;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[132px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message="Falha ao carregar dados do console."
        onRetry={() => { refetchHealth(); refetchAlerts(); }}
      />
    );
  }

  const summary = stockHealth?.data?.statusSummary ?? {};
  const alerts = alertsData?.data?.alerts ?? [];

  const metrics = [
    {
      title: "Total Ingredientes",
      value: stockHealth?.data?.ingredientCount ?? 0,
      icon: Package,
      color: "text-brand",
    },
    {
      title: "Ruptura",
      value: (summary as Record<string, number>).stockout ?? 0,
      icon: TrendingDown,
      color: "text-critical",
      trend: (summary as Record<string, number>).stockout > 0
        ? { value: "Itens sem estoque", positive: false }
        : undefined,
    },
    {
      title: "Critico",
      value: (summary as Record<string, number>).critical ?? 0,
      icon: AlertTriangle,
      color: "text-warning",
      trend: (summary as Record<string, number>).critical > 0
        ? { value: "Abaixo do minimo", positive: false }
        : undefined,
    },
    {
      title: "Normal",
      value: (summary as Record<string, number>).ok ?? 0,
      icon: CheckCircle,
      color: "text-success",
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <KpiCard key={m.title} {...m} />
        ))}
      </div>

      {/* Alertas Recentes */}
      {alerts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
            Alertas Recentes
          </h3>
          <div className="space-y-2">
            {alerts.map((alert: { _id: string; severity: string; message: string; status: string }) => (
              <div
                key={alert._id}
                className="flex items-center gap-3 rounded-lg bg-card border border-border p-3"
              >
                <StatusBadge status={alert.severity} />
                <span className="flex-1 text-sm text-foreground/90">{alert.message}</span>
                <StatusBadge status={alert.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {alerts.length === 0 && (
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          Nenhum alerta recente.
        </div>
      )}
    </div>
  );
}
