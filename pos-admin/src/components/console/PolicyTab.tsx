"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCapabilities } from "@/hooks/useCapabilities";
import { usePolicyActions } from "@/hooks/usePolicyActions";
import { stockPoliciesService } from "@/services/api/stock-policies";
import { StatusBadge } from "@/components/status-badge";
import { FilterPills } from "@/components/shared/FilterPills";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterPillsSkeleton, TableSkeleton } from "@/components/ui/skeleton-loaders";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PolicyFormModal } from "./PolicyFormModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import type { StockPolicy } from "@/types";

const priorityFilters = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baixa" },
];

const activeFilters = [
  { value: "active", label: "Ativas" },
  { value: "inactive", label: "Inativas" },
];

const priorityConfig: Record<string, { label: string; className: string }> = {
  high: { label: "Alta", className: "bg-critical/10 text-critical" },
  medium: { label: "Media", className: "bg-warning/10 text-warning" },
  low: { label: "Baixa", className: "bg-info/10 text-info" },
};

export function PolicyTab() {
  const { can } = useCapabilities();
  const canAdjust = can("inventory", "adjust");
  const { isLoading: isActionsLoading, createPolicy, updatePolicy, deletePolicy } = usePolicyActions();

  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Modal state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<StockPolicy | null>(null);

  // Confirm delete dialog
  const [deleteTarget, setDeleteTarget] = useState<StockPolicy | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["stockPolicies"],
    queryFn: () => stockPoliciesService.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const policies: StockPolicy[] = data?.data ?? [];

  const filtered = useMemo(() => {
    return policies.filter((p) => {
      const matchPriority = !priorityFilter || p.priority === priorityFilter;
      const matchActive =
        !activeFilter ||
        (activeFilter === "active" && p.isActive) ||
        (activeFilter === "inactive" && !p.isActive);
      const name = (p.ingredient as { name?: string } | undefined)?.name?.toLowerCase() ?? "";
      const matchSearch = name.includes(search.toLowerCase());
      return matchPriority && matchActive && matchSearch;
    });
  }, [policies, priorityFilter, activeFilter, search]);

  const handleOpenCreate = () => {
    setEditingPolicy(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (policy: StockPolicy) => {
    setEditingPolicy(policy);
    setFormModalOpen(true);
  };

  const handleCloseFormModal = () => {
    setFormModalOpen(false);
    setEditingPolicy(null);
  };

  const handleSave = async (formData: {
    storeId: string;
    locationId: string;
    ingredientId: string;
    minQuantity: number;
    reorderPoint: number;
    idealQuantity: number;
    maxQuantity: number;
    unit: string;
    priority: "high" | "medium" | "low";
    isActive: boolean;
  }) => {
    try {
      if (editingPolicy) {
        await updatePolicy({
          policyId: editingPolicy._id,
          data: formData,
        });
      } else {
        await createPolicy(formData);
      }
      handleCloseFormModal();
    } catch {
      // handled by hook
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deletePolicy(deleteTarget._id);
      setDeleteTarget(null);
    } catch {
      // handled by hook
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <FilterPillsSkeleton count={4} />
        <TableSkeleton rows={5} columns={11} search />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message="Falha ao carregar politicas de estoque."
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar: filters + create button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterPills
            options={priorityFilters}
            selected={priorityFilter}
            onChange={setPriorityFilter}
            allLabel="Todas"
          />
          <span className="text-muted-foreground/50 mx-1">|</span>
          <FilterPills
            options={activeFilters}
            selected={activeFilter}
            onChange={setActiveFilter}
            allLabel="Todas"
          />
        </div>

        {canAdjust && (
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Criar Politica
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por ingrediente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table or empty state */}
      {policies.length === 0 && !search && !priorityFilter && !activeFilter ? (
        <div className="space-y-4">
          <EmptyState
            variant="inventory"
            title="Nenhuma politica cadastrada"
            description="Crie a primeira politica de estoque para comecar."
            actionLabel={canAdjust ? "Criar Politica" : undefined}
            onAction={canAdjust ? handleOpenCreate : undefined}
          />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          variant="search"
          title="Nenhum resultado"
          description="Nenhuma politica encontrada com este filtro."
        />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loja</TableHead>
                <TableHead>Localizacao</TableHead>
                <TableHead>Ingrediente</TableHead>
                <TableHead className="text-right">Min</TableHead>
                <TableHead className="text-right">Ressuprimento</TableHead>
                <TableHead className="text-right">Ideal</TableHead>
                <TableHead className="text-right">Max</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const pConfig = priorityConfig[p.priority] ?? priorityConfig.medium;
                return (
                  <TableRow key={p._id}>
                    <TableCell className="text-muted-foreground">
                      {(p.store as { name?: string } | undefined)?.name ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {(p.location as { name?: string } | undefined)?.name ?? "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {(p.ingredient as { name?: string } | undefined)?.name ?? "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">{p.minQuantity}</TableCell>
                    <TableCell className="text-right font-mono">{p.reorderPoint}</TableCell>
                    <TableCell className="text-right font-mono">{p.idealQuantity}</TableCell>
                    <TableCell className="text-right font-mono">{p.maxQuantity}</TableCell>
                    <TableCell className="text-muted-foreground">{p.unit}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${pConfig.className}`}>
                        {pConfig.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      {p.isActive ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canAdjust ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleOpenEdit(p)}
                            disabled={isActionsLoading}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Editar</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeleteTarget(p)}
                            disabled={isActionsLoading || !p.isActive}
                            className="text-muted-foreground hover:text-critical hover:bg-critical/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Desativar</span>
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Sem permissao
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Count footer */}
      <p className="text-xs text-muted-foreground text-right">
        {filtered.length} de {policies.length} politicas
      </p>

      {/* Create/Edit Modal */}
      <PolicyFormModal
        open={formModalOpen}
        onOpenChange={handleCloseFormModal}
        onSave={handleSave}
        initialData={editingPolicy}
        isLoading={isActionsLoading}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Desativar Politica"
        description={`Tem certeza que deseja desativar a politica para "${(deleteTarget?.ingredient as { name?: string } | undefined)?.name ?? deleteTarget?._id}"?`}
        onConfirm={handleDeleteConfirm}
        confirmLabel="Desativar"
        variant="destructive"
      />
    </div>
  );
}
