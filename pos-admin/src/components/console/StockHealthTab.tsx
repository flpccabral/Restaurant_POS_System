"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStoreContext } from "@/contexts/StoreContext";
import { observabilityService } from "@/services/api/observability";
import { StatusBadge } from "@/components/status-badge";
import { FilterPills } from "@/components/shared/FilterPills";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { Input } from "@/components/ui/input";
import { FilterPillsSkeleton, TableSkeleton } from "@/components/ui/skeleton-loaders";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";
import type { IngredientHealth } from "@/types";

const statusFilters = [
  { value: "stockout", label: "Ruptura" },
  { value: "critical", label: "Critico" },
  { value: "low", label: "Baixo" },
  { value: "excess", label: "Excesso" },
  { value: "no_policy", label: "Sem Politica" },
  { value: "ok", label: "Normal" },
];

export function StockHealthTab() {
  const { storeId } = useStoreContext();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["stockHealth", storeId],
    queryFn: () => observabilityService.getStockHealth(storeId || ""),
    enabled: !!storeId,
    staleTime: 60_000,
  });

  if (!storeId) {
    return <EmptyState variant="empty" title="Nenhuma loja" description="Nenhuma loja associada ao usuario." />;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <FilterPillsSkeleton count={5} />
        <TableSkeleton rows={6} columns={7} search />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message="Falha ao carregar saude do estoque."
        onRetry={refetch}
      />
    );
  }

  const ingredients: IngredientHealth[] = data?.data?.ingredients ?? [];
  const summary = data?.data?.statusSummary ?? {};

  const filtered = useMemo(() => {
    return ingredients.filter((item) => {
      const name = item.ingredient?.name?.toLowerCase() ?? "";
      const matchSearch = name.includes(search.toLowerCase());
      const matchStatus = !statusFilter || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [ingredients, search, statusFilter]);

  if (ingredients.length === 0) {
    return <EmptyState variant="inventory" title="Nenhum ingrediente" description="Nenhum ingrediente com saldo cadastrado." />;
  }

  return (
    <div className="space-y-4">
      {/* Status filters */}
      <FilterPills
        options={statusFilters.map((f) => ({
          ...f,
          label: `${f.label} ({(summary as Record<string, number>)[f.value] ?? 0})`,
        }))}
        selected={statusFilter}
        onChange={setStatusFilter}
        allLabel={`Todos (${ingredients.length})`}
      />

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar ingrediente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState variant="search" title="Nenhum resultado" description="Nenhum ingrediente encontrado com este filtro." />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingrediente</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Cons. 24h</TableHead>
                <TableHead className="text-right">Media Diaria</TableHead>
                <TableHead className="text-right">Dias p/ Ruptura</TableHead>
                <TableHead>Politica (Min / Reorder / Max)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const p = item.policy;
                return (
                  <TableRow key={item.ingredient?.id ?? item.ingredient?.name}>
                    <TableCell className="font-medium">
                      {item.ingredient?.name}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.balance}{item.unit}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.consumption?.last24h?.netConsumption ?? 0}{item.unit}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.consumption?.avgDailyConsumption != null
                        ? `${item.consumption.avgDailyConsumption}${item.unit}`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.daysUntilStockout != null ? (
                        <span
                          className={
                            item.daysUntilStockout <= 3
                              ? "text-critical font-medium"
                              : item.daysUntilStockout <= 7
                              ? "text-warning font-medium"
                              : "text-success font-medium"
                          }
                        >
                          {item.daysUntilStockout} dias
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p
                        ? `${p.minQuantity ?? "-"} / ${p.reorderPoint ?? "-"} / ${p.maxQuantity ?? "-"}`
                        : "Sem politica"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
