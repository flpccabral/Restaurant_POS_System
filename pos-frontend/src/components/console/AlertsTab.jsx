import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { getAlerts } from "../../https";
import StatusBadge from "./StatusBadge";
import LoadingState from "./LoadingState";
import ErrorState from "./ErrorState";
import EmptyState from "./EmptyState";

const DISABLED_TOOLTIP = "Ações serão habilitadas na Fase 7B";

const AlertsTab = () => {
  const user = useSelector((state) => state.user);
  const storeId = user.store?._id;

  const [statusFilter, setStatusFilter] = useState("new");
  const [severityFilter, setSeverityFilter] = useState("all");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["alerts-all", storeId, statusFilter, severityFilter],
    queryFn: () =>
      getAlerts({
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(severityFilter !== "all" && { severity: severityFilter }),
        limit: 50,
      }),
    staleTime: 60_000,
  });

  if (!storeId) {
    return <EmptyState message="Nenhuma loja associada ao usuário." />;
  }

  if (isLoading) return <LoadingState rows={6} />;
  if (isError)
    return (
      <ErrorState
        message="Falha ao carregar alertas."
        onRetry={refetch}
      />
    );

  const alerts = data?.data?.alerts || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { value: "all", label: "Todos" },
          { value: "new", label: "Novos" },
          { value: "resolved", label: "Resolvidos" },
          { value: "dismissed", label: "Ignorados" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              statusFilter === tab.value
                ? "bg-[#333] text-[#f5f5f5]"
                : "bg-[#1a1a1a] text-[#ababab] hover:bg-[#262626]"
            }`}
          >
            {tab.label}
          </button>
        ))}

        <span className="text-[#555] mx-2">|</span>

        {[
          { value: "all", label: "Todas" },
          { value: "critical", label: "Crítico" },
          { value: "high", label: "Alto" },
          { value: "medium", label: "Médio" },
          { value: "low", label: "Baixo" },
          { value: "info", label: "Info" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setSeverityFilter(tab.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              severityFilter === tab.value
                ? "bg-[#333] text-[#f5f5f5]"
                : "bg-[#1a1a1a] text-[#ababab] hover:bg-[#262626]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {alerts.length === 0 ? (
        <EmptyState message="Nenhum alerta encontrado." />
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert._id}
              className="bg-[#1a1a1a] rounded-lg p-4 flex items-start gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge type="severity" value={alert.severity} />
                  <span className="text-[#ababab] text-xs uppercase">
                    {alert.type}
                  </span>
                  {alert.ingredient?.name && (
                    <span className="text-[#f5f5f5] text-sm font-medium">
                      {alert.ingredient.name}
                    </span>
                  )}
                </div>
                <p className="text-[#f5f5f5] text-sm">{alert.message}</p>
                {alert.currentValue != null && (
                  <p className="text-[#ababab] text-xs mt-1">
                    Valor atual: {alert.currentValue}
                    {alert.thresholdValue != null &&
                      ` | Limite: ${alert.thresholdValue}`}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge value={alert.status} />
                <button
                  disabled
                  title={DISABLED_TOOLTIP}
                  className="bg-[#1a3a1a] text-[#2ed573] px-3 py-1 rounded text-xs font-medium opacity-50 cursor-not-allowed"
                >
                  Resolver
                </button>
                <button
                  disabled
                  title={DISABLED_TOOLTIP}
                  className="bg-[#2a2a2a] text-[#ababab] px-3 py-1 rounded text-xs font-medium opacity-50 cursor-not-allowed"
                >
                  Ignorar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AlertsTab;
