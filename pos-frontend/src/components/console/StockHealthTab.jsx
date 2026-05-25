import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { getStockHealth } from "../../https";
import StatusBadge from "./StatusBadge";
import LoadingState from "./LoadingState";
import ErrorState from "./ErrorState";
import EmptyState from "./EmptyState";

const STORE_ID_PLACEHOLDER = "000000000000000000000000";

const StockHealthTab = () => {
  const user = useSelector((state) => state.user);
  const storeId = user.store?._id || STORE_ID_PLACEHOLDER;

  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["stockHealth", storeId],
    queryFn: () => getStockHealth(storeId),
    staleTime: 60_000,
  });

  const ingredients = data?.data?.ingredients || [];
  const statusSummary = data?.data?.statusSummary || {};

  const filtered = useMemo(() => {
    return ingredients.filter((i) => {
      const name = i.ingredient?.name?.toLowerCase() || "";
      const matchSearch = name.includes(filter.toLowerCase());
      const matchStatus =
        statusFilter === "all" || i.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [ingredients, filter, statusFilter]);

  if (!storeId) {
    return <EmptyState message="Nenhuma loja associada ao usuário." />;
  }

  if (isLoading) return <LoadingState rows={8} />;
  if (isError)
    return (
      <ErrorState
        message="Falha ao carregar saúde do estoque."
        onRetry={refetch}
      />
    );

  if (ingredients.length === 0) {
    return <EmptyState message="Nenhum ingrediente com saldo cadastrado." />;
  }

  const statusTabs = [
    { value: "all", label: `Todos (${ingredients.length})` },
    { value: "stockout", label: `Ruptura (${statusSummary.stockout || 0})` },
    { value: "critical", label: `Crítico (${statusSummary.critical || 0})` },
    { value: "low", label: `Baixo (${statusSummary.low || 0})` },
    { value: "excess", label: `Excesso (${statusSummary.excess || 0})` },
    { value: "no_policy", label: `Sem Política (${statusSummary.noPolicy || 0})` },
    { value: "ok", label: `Normal (${statusSummary.ok || 0})` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
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
      </div>

      <input
        type="text"
        placeholder="Buscar ingrediente..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full bg-[#1a1a1a] text-[#f5f5f5] text-sm px-4 py-2 rounded-lg outline-none placeholder-[#666]"
      />

      {filtered.length === 0 ? (
        <EmptyState message="Nenhum ingrediente encontrado com este filtro." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-[#ababab] text-xs uppercase border-b border-[#333]">
                <th className="py-3 pr-4">Ingrediente</th>
                <th className="py-3 px-4">Saldo</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Cons. 24h</th>
                <th className="py-3 px-4">Média Diária</th>
                <th className="py-3 px-4">Dias p/ Ruptura</th>
                <th className="py-3 px-4">Política (Min / Ressuprimento / Max)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {filtered.map((item) => {
                const p = item.policy;
                return (
                  <tr key={item.ingredient?.id} className="text-[#f5f5f5]">
                    <td className="py-3 pr-4 font-medium">
                      {item.ingredient?.name}
                    </td>
                    <td className="py-3 px-4">
                      {item.balance}
                      {item.unit}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge value={item.status} />
                    </td>
                    <td className="py-3 px-4 text-[#ababab]">
                      {item.consumption?.last24h?.netConsumption || 0}
                      {item.unit}
                    </td>
                    <td className="py-3 px-4 text-[#ababab]">
                      {item.consumption?.avgDailyConsumption || "-"}
                      {item.consumption?.avgDailyConsumption ? item.unit : ""}
                    </td>
                    <td className="py-3 px-4">
                      {item.daysUntilStockout != null ? (
                        <span
                          className={
                            item.daysUntilStockout <= 3
                              ? "text-[#ff6b6b]"
                              : item.daysUntilStockout <= 7
                              ? "text-[#feca57]"
                              : "text-[#2ed573]"
                          }
                        >
                          {item.daysUntilStockout} dias
                        </span>
                      ) : (
                        <span className="text-[#555]">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[#ababab]">
                      {p
                        ? `${p.minQuantity || "-"} / ${p.reorderPoint || "-"} / ${p.maxQuantity || "-"}`
                        : "Sem política"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StockHealthTab;
