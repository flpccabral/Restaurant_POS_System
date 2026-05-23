import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getNetworkRecommendations } from "../../https";
import useOperationalActions from "../../hooks/useOperationalActions";
import { useCapabilities } from "../../hooks/useCapabilities";
import ConfirmActionModal from "./ConfirmActionModal";
import StatusBadge from "./StatusBadge";
import LoadingState from "./LoadingState";
import ErrorState from "./ErrorState";
import EmptyState from "./EmptyState";
import { HiArrowsRightLeft } from "react-icons/hi2";
import { MdLocalShipping, MdShoppingCart } from "react-icons/md";

const typeConfig = {
  central_to_store: {
    label: "Central -> Loja",
    icon: <MdLocalShipping className="text-[#54a0ff]" />,
  },
  inter_store_transfer: {
    label: "Entre Lojas",
    icon: <HiArrowsRightLeft className="text-[#feca57]" />,
  },
  purchase_needed: {
    label: "Compra",
    icon: <MdShoppingCart className="text-[#ff6b6b]" />,
  },
};

const RecommendationsTab = () => {
  const { can } = useCapabilities();

  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRec, setSelectedRec] = useState(null);

  const {
    isLoading: isActionsLoading,
    executeCentralTransfer,
    executeInterStoreTransfer,
    markPurchaseNeeded,
  } = useOperationalActions();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["networkRecommendations"],
    queryFn: getNetworkRecommendations,
    staleTime: 120_000,
  });

  const canTransfer = can("inventory", "transfer");
  const canAdjust = can("inventory", "adjust");

  if (isLoading) return <LoadingState rows={6} />;
  if (isError)
    return (
      <ErrorState
        message="Falha ao carregar recomendacoes da rede."
        onRetry={refetch}
      />
    );

  const recommendations = data?.data?.recommendations || [];

  const filtered = recommendations.filter((rec) => {
    const matchPriority =
      priorityFilter === "all" || rec.priority === priorityFilter;
    const matchType = typeFilter === "all" || rec.type === typeFilter;
    return matchPriority && matchType;
  });

  const handleOpenModal = (rec) => {
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
            originLocationId: selectedRec.source?.locationId,
            destinationLocationId: selectedRec.destinationLocationId,
            ingredientId: selectedRec.ingredient?.id,
            quantity: selectedRec.suggestedQuantity,
            unit: selectedRec.unit,
            reason: selectedRec.justification,
          });
          break;

        case "inter_store_transfer":
          await executeInterStoreTransfer({
            originStoreId: selectedRec.source?.storeId,
            destinationStoreId: selectedRec.storeId,
            originLocationId: selectedRec.source?.locationId,
            destinationLocationId: selectedRec.destinationLocationId,
            ingredientId: selectedRec.ingredient?.id,
            quantity: selectedRec.suggestedQuantity,
            unit: selectedRec.unit,
            reason: selectedRec.justification,
          });
          break;

        case "purchase_needed":
          await markPurchaseNeeded({
            ingredientId: selectedRec.ingredient?.id,
            ingredientName: selectedRec.ingredient?.name,
            quantity: selectedRec.suggestedQuantity,
            unit: selectedRec.unit,
            notes: selectedRec.justification,
          });
          break;

        default:
          break;
      }
      handleCloseModal();
    } catch {
      // Error is handled by the hook via snackbar
    }
  };

  const getModalDetails = () => {
    if (!selectedRec) return null;
    const details = {
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
        selectedRec.source?.locationName ||
        selectedRec.source?.storeName ||
        "N/A";
      details.destination = selectedRec.storeName || "N/A";
    }

    if (selectedRec.type === "central_to_store") {
      details.risks = `Central warehouse will reduce stock by ${selectedRec.suggestedQuantity}${selectedRec.unit}.`;
    } else if (selectedRec.type === "inter_store_transfer") {
      details.risks = selectedRec.risks?.join("; ") || "Verify store compatibility before proceeding.";
    }

    return details;
  };

  const getActionButtonLabel = (type) => {
    if (type === "purchase_needed") return "Registrar Compra";
    return "Executar";
  };

  const canExecuteAction = (type) => {
    if (type === "purchase_needed") return canAdjust;
    return canTransfer;
  };

  if (recommendations.length === 0) {
    return (
      <EmptyState message="Nenhuma recomendacao no momento. A rede esta com estoques saudaveis." />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { value: "all", label: "Todas" },
          { value: "critical", label: "Critico" },
          { value: "high", label: "Alto" },
          { value: "medium", label: "Medio" },
          { value: "low", label: "Baixo" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setPriorityFilter(tab.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              priorityFilter === tab.value
                ? "bg-[#333] text-[#f5f5f5]"
                : "bg-[#1a1a1a] text-[#ababab] hover:bg-[#262626]"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <span className="text-[#555] mx-2">|</span>
        {[
          { value: "all", label: "Todos os tipos" },
          { value: "central_to_store", label: "Central -> Loja" },
          { value: "inter_store_transfer", label: "Entre Lojas" },
          { value: "purchase_needed", label: "Compra" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setTypeFilter(tab.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              typeFilter === tab.value
                ? "bg-[#333] text-[#f5f5f5]"
                : "bg-[#1a1a1a] text-[#ababab] hover:bg-[#262626]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="Nenhuma recomendacao com este filtro." />
      ) : (
        <div className="space-y-3">
          {filtered.map((rec, idx) => {
            const tConfig = typeConfig[rec.type] || {};
            const buttonLabel = getActionButtonLabel(rec.type);
            const hasPermission = canExecuteAction(rec.type);
            return (
              <div
                key={`${rec.storeId}-${rec.ingredient?.id}-${idx}`}
                className="bg-[#1a1a1a] rounded-lg p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5">{tConfig.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <StatusBadge type="severity" value={rec.priority} />
                      <span className="text-[#ababab] text-xs">
                        {tConfig.label || rec.type}
                      </span>
                      <span className="text-[#f5f5f5] text-sm font-medium">
                        {rec.ingredient?.name}
                      </span>
                      {rec.storeName && (
                        <span className="text-[#666] text-xs">
                          ({rec.storeName})
                        </span>
                      )}
                    </div>

                    <p className="text-[#f5f5f5] text-sm mb-1">
                      {rec.justification || rec.actionSuggested}
                    </p>

                    <div className="flex flex-wrap gap-4 text-xs text-[#ababab]">
                      <span>
                        Qtd sugerida:{" "}
                        <span className="text-[#f5f5f5]">
                          {rec.suggestedQuantity}
                          {rec.unit}
                        </span>
                      </span>
                      <span>
                        Saldo atual:{" "}
                        <span className="text-[#f5f5f5]">
                          {rec.currentBalance}
                          {rec.unit}
                        </span>
                      </span>
                      {rec.source && (
                        <span>
                          Origem:{" "}
                          <span className="text-[#f5f5f5]">
                            {rec.source.locationName ||
                              rec.source.storeName}
                          </span>
                          {rec.source.availableQuantity != null &&
                            ` (${rec.source.availableQuantity}${rec.unit})`}
                        </span>
                      )}
                    </div>
                  </div>

                  {hasPermission ? (
                    <button
                      onClick={() => handleOpenModal(rec)}
                      disabled={isActionsLoading}
                      className={`shrink-0 bg-[#1a3a1a] text-[#2ed573] px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        isActionsLoading
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-[#2a5a2a]"
                      }`}
                    >
                      {buttonLabel}
                    </button>
                  ) : (
                    <span
                      className="shrink-0 text-[#555] text-xs italic px-3 py-1.5"
                      title="Sem permissao para executar esta acao"
                    >
                      Sem permissao
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmActionModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirm}
        actionType={selectedRec?.type}
        details={getModalDetails()}
        isLoading={isActionsLoading}
      />
    </div>
  );
};

export default RecommendationsTab;
