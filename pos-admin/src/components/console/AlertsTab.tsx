"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useOperationalActions } from "@/hooks/useOperationalActions";
import { observabilityService } from "@/services/api/observability";
import { StatusBadge } from "@/components/status-badge";
import { FilterPills } from "@/components/shared/FilterPills";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmActionModal } from "./ConfirmActionModal";
import type { OperationalAlert } from "@/types";

const statusFilters = [
  { value: "new", label: "Novos" },
  { value: "resolved", label: "Resolvidos" },
  { value: "dismissed", label: "Ignorados" },
];

const severityFilters = [
  { value: "critical", label: "Critico" },
  { value: "high", label: "Alto" },
  { value: "medium", label: "Medio" },
  { value: "low", label: "Baixo" },
  { value: "info", label: "Info" },
];

export function AlertsTab() {
  const { storeId, can } = useCapabilities();
  const { isLoading: isActionsLoading, resolveAlert, dismissAlert } = useOperationalActions();

  const [statusFilter, setStatusFilter] = useState<string | null>("new");
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<OperationalAlert | null>(null);
  const [actionType, setActionType] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["alerts-all", storeId, statusFilter, severityFilter],
    queryFn: () =>
      observabilityService.getAlerts({
        ...(statusFilter && statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(severityFilter && severityFilter !== "all" ? { severity: severityFilter } : {}),
        limit: 50,
      }),
    staleTime: 60_000,
  });

  const canAdjust = can("inventory", "adjust");

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
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Falha ao carregar alertas." onRetry={refetch} />;
  }

  const alerts: OperationalAlert[] = data?.data?.alerts ?? [];

  const handleOpenModal = (alert: OperationalAlert, action: string) => {
    setSelectedAlert(alert);
    setActionType(action);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedAlert(null);
    setActionType(null);
  };

  const handleConfirm = async () => {
    if (!selectedAlert || !actionType) return;
    try {
      if (actionType === "resolve") {
        await resolveAlert({ alertId: selectedAlert._id });
      } else if (actionType === "dismiss") {
        await dismissAlert({ alertId: selectedAlert._id });
      }
      handleCloseModal();
    } catch {
      // handled by hook
    }
  };

  const isNewOrAcknowledged = (alert: OperationalAlert) =>
    alert.status === "new" || alert.status === "acknowledged";

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPills
          options={statusFilters}
          selected={statusFilter}
          onChange={setStatusFilter}
          allLabel="Todos"
        />
        <span className="text-muted-foreground/50 mx-1">|</span>
        <FilterPills
          options={severityFilters}
          selected={severityFilter}
          onChange={setSeverityFilter}
          allLabel="Todas"
        />
      </div>

      {/* Alert list */}
      {alerts.length === 0 ? (
        <EmptyState title="Nenhum alerta" description="Nenhum alerta encontrado com os filtros atuais." />
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert._id}
              className="flex items-start gap-4 rounded-lg border border-border bg-card p-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={alert.severity} />
                  <span className="text-xs text-muted-foreground uppercase font-medium">
                    {alert.type}
                  </span>
                  {alert.ingredient?.name && (
                    <span className="text-sm font-medium text-foreground/90">
                      {alert.ingredient.name}
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground/80">{alert.message}</p>
                {alert.currentValue != null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Valor atual: {alert.currentValue}
                    {alert.thresholdValue != null && ` | Limite: ${alert.thresholdValue}`}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={alert.status} />
                {canAdjust ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-success border-success/30 hover:bg-success/10"
                      onClick={() => handleOpenModal(alert, "resolve")}
                      disabled={!isNewOrAcknowledged(alert) || isActionsLoading}
                    >
                      Resolver
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenModal(alert, "dismiss")}
                      disabled={!isNewOrAcknowledged(alert) || isActionsLoading}
                    >
                      Ignorar
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground italic">
                    Sem permissao
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmActionModal
        open={modalOpen}
        onOpenChange={handleCloseModal}
        onConfirm={handleConfirm}
        actionType={actionType}
        details={
          selectedAlert
            ? {
                ingredient: selectedAlert.ingredient?.name ?? "N/A",
                quantity: selectedAlert.currentValue,
                justification: selectedAlert.message,
                risks:
                  actionType === "dismiss"
                    ? "O alerta continuara gerando se a condicao persistir."
                    : undefined,
              }
            : null
        }
        isLoading={isActionsLoading}
      />
    </div>
  );
}
