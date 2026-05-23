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
import { Badge } from "@/components/ui/badge";
import { Truck, ArrowLeftRight, ShoppingCart, Lightbulb } from "lucide-react";
import { ConfirmActionModal } from "./ConfirmActionModal";
import type { Recommendation } from "@/types";

const priorityFilters = [
  { value: "critical", label: "Critico" },
  { value: "high", label: "Alto" },
  { value: "medium", label: "Medio" },
  { value: "low", label: "Baixo" },
];

const typeFilters = [
  { value: "central_to_store", label: "Central → Loja" },
  { value: "inter_store_transfer", label: "Entre Lojas" },
  { value: "purchase_needed", label: "Compra" },
];

const typeConfig: Record<string, { label: string; icon: React.ReactNode }> = {
  central_to_store: {
    label: "Central → Loja",
    icon: <Truck className="h-4 w-4 text-info" />,
  },
  inter_store_transfer: {
    label: "Entre Lojas",
    icon: <ArrowLeftRight className="h-4 w-4 text-warning" />,
  },
  purchase_needed: {
    label: "Compra",
    icon: <ShoppingCart className="h-4 w-4 text-critical" />,
  },
};

export function RecommendationsTab() {
  const { can } = useCapabilities();
  const {
    isLoading: isActionsLoading,
    executeCentralTransfer,
    executeInterStoreTransfer,
    registerPurchase,
  } = useOperationalActions();

  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["networkRecommendations"],
    queryFn: () => observabilityService.getNetworkRecommendations(),
    staleTime: 120_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message="Falha ao carregar recomendacoes da rede."
        onRetry={refetch}
      />
    );
  }

  const recommendations: Recommendation[] = data?.data?.recommendations ?? [];

  const filtered = recommendations.filter((rec) => {
    const matchPriority = !priorityFilter || rec.priority === priorityFilter;
    const matchType = !typeFilter || rec.type === typeFilter;
    return matchPriority && matchType;
  });

  const handleOpenModal = (rec: Recommendation) => {
    setSelectedRec(rec);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedRec(null);
  };

  const handleConfirm = async () => {
    if (!selectedRec) return;
    try {
      switch (selectedRec.type) {
        case "central_to_store":
          await executeCentralTransfer({
            originLocationId: selectedRec.source?.locationId ?? "",
            destinationLocationId: selectedRec.destinationLocationId ?? "",
            ingredientId: selectedRec.ingredient?.id ?? "",
            quantity: selectedRec.suggestedQuantity,
            unit: selectedRec.unit,
            reason: selectedRec.justification,
          });
          break;
        case "inter_store_transfer":
          await executeInterStoreTransfer({
            originStoreId: selectedRec.source?.storeId ?? "",
            destinationStoreId: selectedRec.storeId ?? "",
            originLocationId: selectedRec.source?.locationId ?? "",
            destinationLocationId: selectedRec.destinationLocationId ?? "",
            ingredientId: selectedRec.ingredient?.id ?? "",
            quantity: selectedRec.suggestedQuantity,
            unit: selectedRec.unit,
            reason: selectedRec.justification,
          });
          break;
        case "purchase_needed":
          await registerPurchase({
            ingredientId: selectedRec.ingredient?.id ?? "",
            ingredientName: selectedRec.ingredient?.name,
            quantity: selectedRec.suggestedQuantity,
            unit: selectedRec.unit,
            notes: selectedRec.justification,
          });
          break;
      }
      handleCloseModal();
    } catch {
      // handled by hook
    }
  };

  const getModalDetails = () => {
    if (!selectedRec) return null;
    const details: Record<string, unknown> = {
      ingredient: selectedRec.ingredient?.name,
      quantity: selectedRec.suggestedQuantity,
      unit: selectedRec.unit,
      currentBalance: selectedRec.currentBalance,
      justification: selectedRec.justification,
    };
    if (
      selectedRec.type === "central_to_store" ||
      selectedRec.type === "inter_store_transfer"
    ) {
      details.origin =
        selectedRec.source?.locationName ??
        selectedRec.source?.storeName ??
        "N/A";
      details.destination = selectedRec.storeName ?? "N/A";
    }
    if (selectedRec.type === "central_to_store") {
      details.risks = `O almoxarifado central reduzira o estoque em ${selectedRec.suggestedQuantity}${selectedRec.unit}.`;
    } else if (selectedRec.type === "inter_store_transfer") {
      details.risks = selectedRec.risks?.join("; ") ?? "Verifique a compatibilidade entre as lojas antes de prosseguir.";
    }
    return details;
  };

  const canTransfer = can("inventory", "transfer");
  const canAdjust = can("inventory", "adjust");

  const canExecuteAction = (type: string) => {
    if (type === "purchase_needed") return canAdjust;
    return canTransfer;
  };

  if (recommendations.length === 0) {
    return (
      <EmptyState
        title="Nenhuma recomendacao"
        description="A rede esta com estoques saudaveis. Nenhuma recomendacao no momento."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPills
          options={priorityFilters}
          selected={priorityFilter}
          onChange={setPriorityFilter}
          allLabel="Todas"
        />
        <span className="text-muted-foreground/50 mx-1">|</span>
        <FilterPills
          options={typeFilters}
          selected={typeFilter}
          onChange={setTypeFilter}
          allLabel="Todos os tipos"
        />
      </div>

      {/* Recommendation list */}
      {filtered.length === 0 ? (
        <EmptyState title="Nenhuma recomendacao" description="Nenhuma recomendacao com este filtro." />
      ) : (
        <div className="space-y-3">
          {filtered.map((rec, idx) => {
            const tConfig = typeConfig[rec.type] ?? {};
            const hasPermission = canExecuteAction(rec.type);
            return (
              <div
                key={`${rec.storeId}-${rec.ingredient?.id}-${idx}`}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {tConfig.icon ?? <Lightbulb className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={rec.priority} />
                      <span className="text-xs text-muted-foreground">
                        {tConfig.label ?? rec.type}
                      </span>
                      <span className="text-sm font-medium text-foreground/90">
                        {rec.ingredient?.name}
                      </span>
                      {rec.storeName && (
                        <span className="text-xs text-muted-foreground">
                          ({rec.storeName})
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-foreground/80">
                      {rec.justification || rec.actionSuggested}
                    </p>

                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span>
                        Qtd sugerida:{" "}
                        <span className="text-foreground/90 font-medium">
                          {rec.suggestedQuantity}{rec.unit}
                        </span>
                      </span>
                      <span>
                        Saldo atual:{" "}
                        <span className="text-foreground/90 font-medium">
                          {rec.currentBalance}{rec.unit}
                        </span>
                      </span>
                      {rec.source && (
                        <span>
                          Origem:{" "}
                          <span className="text-foreground/90 font-medium">
                            {rec.source.locationName ?? rec.source.storeName}
                          </span>
                          {rec.source.availableQuantity != null &&
                            ` (${rec.source.availableQuantity}${rec.unit})`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {hasPermission ? (
                      <Button
                        size="sm"
                        onClick={() => handleOpenModal(rec)}
                        disabled={isActionsLoading}
                      >
                        {rec.type === "purchase_needed" ? "Registrar Compra" : "Executar"}
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground italic">
                        Sem permissao
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmActionModal
        open={modalOpen}
        onOpenChange={handleCloseModal}
        onConfirm={handleConfirm}
        actionType={selectedRec?.type}
        details={getModalDetails() as Record<string, unknown>}
        isLoading={isActionsLoading}
      />
    </div>
  );
}
