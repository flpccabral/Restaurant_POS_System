import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { getStockHealth, getAlerts } from "../../https";
import MetricCard from "./MetricCard";
import StatusBadge from "./StatusBadge";
import LoadingState from "./LoadingState";
import ErrorState from "./ErrorState";
import EmptyState from "./EmptyState";
import { MdInventory, MdWarning, MdCheckCircle, MdTrendingDown } from "react-icons/md";

const OverviewTab = () => {
  const user = useSelector((state) => state.user);
  const storeId = user.store?._id;

  const {
    data: healthData,
    isLoading: healthLoading,
    isError: healthError,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ["stockHealth", storeId],
    queryFn: () => getStockHealth(storeId),
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
    queryFn: () => getAlerts({ limit: 5 }),
    enabled: !!storeId,
    staleTime: 60_000,
  });

  if (!storeId) {
    return <EmptyState message="Nenhuma loja associada ao usuário." />;
  }

  const isLoading = healthLoading || alertsLoading;
  const isError = healthError || alertsError;

  if (isLoading) return <LoadingState type="cards" />;
  if (isError)
    return (
      <ErrorState
        message="Falha ao carregar dados do console."
        onRetry={() => {
          refetchHealth();
          refetchAlerts();
        }}
      />
    );

  const summary = healthData?.data?.statusSummary || {};
  const alerts = alertsData?.data?.alerts || [];

  const metrics = [
    {
      label: "Total Ingredientes",
      value: healthData?.data?.ingredientCount || 0,
      icon: <MdInventory className="text-[#54a0ff]" />,
    },
    {
      label: "Ruptura",
      value: summary.stockout || 0,
      icon: <MdTrendingDown className="text-[#ff6b6b]" />,
      color: "text-[#ff6b6b]",
    },
    {
      label: "Crítico",
      value: summary.critical || 0,
      icon: <MdWarning className="text-[#ff9f43]" />,
      color: "text-[#ff9f43]",
    },
    {
      label: "Normal",
      value: summary.ok || 0,
      icon: <MdCheckCircle className="text-[#2ed573]" />,
      color: "text-[#2ed573]",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {alerts.length > 0 && (
        <div>
          <h3 className="text-[#f5f5f5] text-sm font-semibold mb-3 uppercase tracking-wide">
            Alertas Recentes
          </h3>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert._id}
                className="bg-[#1a1a1a] rounded-lg p-3 flex items-center gap-3"
              >
                <StatusBadge type="severity" value={alert.severity} />
                <span className="text-[#f5f5f5] text-sm flex-1">
                  {alert.message}
                </span>
                <StatusBadge value={alert.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OverviewTab;
