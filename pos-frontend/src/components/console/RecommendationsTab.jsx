import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getNetworkRecommendations } from "../../https";
import StatusBadge from "./StatusBadge";
import LoadingState from "./LoadingState";
import ErrorState from "./ErrorState";
import EmptyState from "./EmptyState";
import { HiArrowsRightLeft } from "react-icons/hi2";
import { MdLocalShipping, MdShoppingCart } from "react-icons/md";

const DISABLED_TOOLTIP = "Ações serão habilitadas na Fase 7B";

const typeConfig = {
  central_to_store: {
    label: "Central → Loja",
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
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["networkRecommendations"],
    queryFn: getNetworkRecommendations,
    staleTime: 120_000,
  });

  if (isLoading) return <LoadingState rows={6} />;
  if (isError)
    return (
      <ErrorState
        message="Falha ao carregar recomendações da rede."
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

  if (recommendations.length === 0) {
    return <EmptyState message="Nenhuma recomendação no momento. A rede está com estoques saudáveis." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { value: "all", label: "Todas" },
          { value: "critical", label: "Crítico" },
          { value: "high", label: "Alto" },
          { value: "medium", label: "Médio" },
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
          { value: "central_to_store", label: "Central → Loja" },
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
        <EmptyState message="Nenhuma recomendação com este filtro." />
      ) : (
        <div className="space-y-3">
          {filtered.map((rec, idx) => {
            const tConfig = typeConfig[rec.type] || {};
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

                  <button
                    disabled
                    title={DISABLED_TOOLTIP}
                    className="shrink-0 bg-[#1a3a1a] text-[#2ed573] px-3 py-1.5 rounded text-xs font-medium opacity-50 cursor-not-allowed"
                  >
                    Executar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RecommendationsTab;
