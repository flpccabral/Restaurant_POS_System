"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, FileText, AlertTriangle, XCircle, HelpCircle, Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ErrorState } from "@/components/shared/ErrorState";
import { FilterPills } from "@/components/shared/FilterPills";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Product, Ingredient } from "@/types";
import { productsService } from "@/services/api/products";
import { categoriesService } from "@/services/api/categories";
import { ingredientsService } from "@/services/api/ingredients";

// Readiness badge config
const READINESS_CONFIG: Record<string, { status: string; label: string; icon?: LucideIcon }> = {
  ready_for_sale: { status: "ok", label: "Pronto (receita)" },
  ready_direct_ok: { status: "ok", label: "Pronto (baixa direta)", icon: Package },
  ready_no_stock_impact: { status: "ok", label: "Sem impacto" },
  ready_missing_recipe: { status: "critical", label: "Sem receita", icon: AlertTriangle },
  ready_missing_direct: { status: "warning", label: "Sem config. direta", icon: AlertTriangle },
  incomplete_config: { status: "inactive", label: "Config. incompleta", icon: XCircle },
};

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    _id?: string;
    name: string;
    description: string;
    price: string;
    category: string;
    sellableType: string;
    stockImpactRule: string;
    directStockItem: string;
    directStockQuantity: string;
    directStockUnit: string;
  } | null>(null);
  const [readinessFilter, setReadinessFilter] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsService.getAll().then((r) => r.data.data),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesService.getAll().then((r) => r.data.data).catch(() => []),
  });

  const { data: ingredients } = useQuery({
    queryKey: ["ingredients"],
    queryFn: () => ingredientsService.getAll().then((r) => r.data.data).catch(() => []),
  });

  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!readinessFilter) return data;
    return data.filter((p: Product) => {
      const status = p.productReadinessStatus || "incomplete_config";
      if (readinessFilter === "ready") {
        return status.startsWith("ready_");
      }
      if (readinessFilter === "missing") {
        return status === "ready_missing_recipe" || status === "ready_missing_direct";
      }
      if (readinessFilter === "incomplete") {
        return status === "incomplete_config";
      }
      return true;
    });
  }, [data, readinessFilter]);

  const mutation = useMutation({
    mutationFn: (vars: { method: "post" | "put"; id?: string; data: Record<string, unknown> }) => {
      if (vars.method === "post") return productsService.create(vars.data);
      return productsService.update(vars.id!, vars.data);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto salvo com sucesso");

      // Check readiness via new status
      const readiness = vars.data.productReadinessStatus as string;
      if (readiness === "ready_missing_recipe") {
        toast.warning(
          "Produto salvo, mas ainda nao possui ficha tecnica ativa. Cadastre uma receita para garantir baixa de estoque e CMV corretos.",
          { duration: 6000 }
        );
      } else if (readiness === "ready_missing_direct") {
        toast.warning(
          "Produto salvo, mas regra stock_item_direct sem configuracao completa. Defina item, quantidade e unidade.",
          { duration: 6000 }
        );
      }

      setEditing(null);
    },
    onError: () => toast.error("Erro ao salvar produto"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto excluido");
      setDeleteId(null);
    },
    onError: () => toast.error("Erro ao excluir produto"),
  });

  const columns = [
    { key: "name", header: "Nome" },
    {
      key: "category",
      header: "Categoria",
      cell: (row: unknown) => {
        const c = (row as Record<string, unknown>).category;
        return typeof c === "string" ? c : (c as { name?: string })?.name || "—";
      },
    },
    {
      key: "price",
      header: "Preco",
      cell: (row: unknown) => {
        const r = row as Record<string, unknown>;
        const price = r.price ?? (r.variations as Array<{ price?: number }>)?.[0]?.price ?? 0;
        return `R$ ${Number(price).toFixed(2)}`;
      },
    },
    {
      key: "productReadinessStatus",
      header: "Status Operacional",
      cell: (row: unknown) => {
        const r = row as Record<string, unknown>;
        const status = (r.productReadinessStatus as string) || "incomplete_config";
        const config = READINESS_CONFIG[status] || READINESS_CONFIG.incomplete_config;
        const label = (r.productReadinessLabel as string) || config.label;
        return (
          <StatusBadge status={config.status} label={label} icon={config.icon} />
        );
      },
    },
    {
      key: "stockImpactRule",
      header: "Regra de Estoque",
      cell: (row: unknown) => {
        const rule = (row as Record<string, unknown>).stockImpactRule as string;
        const labels: Record<string, string> = {
          recipe_composition: "Ficha tecnica",
          stock_item_direct: "Baixa direta",
          no_stock_impact: "Sem impacto",
          combo_components: "Combo",
        };
        return (
          <span className="text-sm text-muted-foreground">
            {labels[rule] || rule || "recipe_composition"}
          </span>
        );
      },
    },
    {
      key: "isActive",
      header: "Status",
      cell: (row: unknown) => (
        <StatusBadge status={((row as Record<string, unknown>).isActive as boolean) ? "active" : "inactive"} />
      ),
    },
  ];

  const handleEdit = (product: Product) => {
    const cat = product.category;
    setEditing({
      _id: product._id,
      name: product.name,
      description: product.description || "",
      price: String(product.price || product.variations?.[0]?.price || 0),
      category: typeof cat === "string" ? cat : (cat as { _id?: string })?._id || "",
      sellableType: product.sellableType || "prepared_product",
      stockImpactRule: product.stockImpactRule || "recipe_composition",
      directStockItem: typeof product.directStockItem === "object"
        ? (product.directStockItem as { _id?: string })?._id || ""
        : (product.directStockItem as string) || "",
      directStockQuantity: String(product.directStockQuantity ?? 1),
      directStockUnit: product.directStockUnit || "",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Produtos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie o catalogo de produtos</p>
        </div>
        <Button onClick={() =>
          setEditing({
            name: "", description: "", price: "0", category: "",
            sellableType: "prepared_product", stockImpactRule: "recipe_composition",
            directStockItem: "", directStockQuantity: "1", directStockUnit: "",
          })
        }>
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      {/* Filter pills for readiness status */}
      <FilterPills
        options={[
          { value: "ready", label: "Prontos" },
          { value: "missing", label: "Falta config." },
          { value: "incomplete", label: "Incompletos" },
        ]}
        selected={readinessFilter}
        onChange={setReadinessFilter}
        allLabel="Todos"
      />

      {isError ? (
        <ErrorState
          message="Falha ao carregar produtos"
          description="Verifique se o servidor backend esta rodando e tente novamente."
          onRetry={refetch}
        />
      ) : (
      <DataTable
        columns={columns}
        data={filteredData}
        loading={isLoading}
        searchKey="name"
        searchPlaceholder="Pesquisar produtos..."
        emptyMessage="Nenhum produto encontrado."
        onEdit={(id) => {
          const p = (data || []).find((x: { _id: string }) => x._id === id);
          if (p) handleEdit(p);
        }}
        onDelete={(id) => setDeleteId(id)}
        customActions={(row: unknown) => {
          const r = row as Record<string, unknown>;
          const rule = r.stockImpactRule as string;
          const status = r.productReadinessStatus as string;

          // Show "Criar receita" only for recipe_composition without recipe
          if (rule === "recipe_composition" && status === "ready_missing_recipe") {
            return (
              <Link
                href={`/recipes/new?productId=${r._id}`}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
              >
                <FileText className="h-3 w-3" />
                Criar receita
              </Link>
            );
          }

          // Show "Configurar" for stock_item_direct missing config
          if (rule === "stock_item_direct" && status === "ready_missing_direct") {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-orange-500/10 text-orange-400">
                <AlertTriangle className="h-3 w-3" />
                Config. pendente
              </span>
            );
          }

          return null;
        }}
      />
      )}

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?._id ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            <DialogDescription>Preencha os dados do produto e regra de impacto em estoque</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-5 py-2">
            <div className="col-span-2 space-y-2">
              <Label>Nome</Label>
              <Input value={editing?.name || ""} onChange={(e) => setEditing((p) => p ? { ...p, name: e.target.value } : null)} placeholder="Nome do produto" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Descricao</Label>
              <Input value={editing?.description || ""} onChange={(e) => setEditing((p) => p ? { ...p, description: e.target.value } : null)} placeholder="Descricao opcional do produto" />
            </div>
            <div className="space-y-2">
              <Label>Preco (R$)</Label>
              <Input type="number" step="0.01" value={editing?.price || "0"} onChange={(e) => setEditing((p) => p ? { ...p, price: e.target.value } : null)} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={editing?.category || ""}
                onValueChange={(value) => setEditing((p) => p ? { ...p, category: value ?? "" } : null)}
              >
                <SelectTrigger>
                  {editing?.category && (categories || []).find(c => c._id === editing.category) ? (
                    <span>{(categories || []).find(c => c._id === editing.category)!.name}</span>
                  ) : (
                    <SelectValue placeholder="Sem categoria" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem categoria</SelectItem>
                  {(categories || []).map((c: { _id: string; name: string }) => (
                    <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fase 9.1A — Tipo de Produto */}
            <div className="space-y-2">
              <Label>Tipo de Produto</Label>
              <Select
                value={editing?.sellableType || "prepared_product"}
                onValueChange={(value) => setEditing((p) => p ? { ...p, sellableType: value ?? "prepared_product" } : null)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prepared_product">Preparado (ficha tecnica)</SelectItem>
                  <SelectItem value="industrialized_resale">Revenda (industrializado)</SelectItem>
                  <SelectItem value="service_fee">Taxa/Servico</SelectItem>
                  <SelectItem value="combo">Combo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fase 9.1A — Impacto em Estoque */}
            <div className="space-y-2">
              <Label>Impacto em Estoque</Label>
              <Select
                value={editing?.stockImpactRule || "recipe_composition"}
                onValueChange={(value) => setEditing((p) => p ? {
                  ...p,
                  stockImpactRule: value ?? "recipe_composition",
                  directStockItem: "",
                  directStockQuantity: "1",
                  directStockUnit: "",
                } : null)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recipe_composition">Ficha tecnica (receita)</SelectItem>
                  <SelectItem value="stock_item_direct">Baixa direta de estoque</SelectItem>
                  <SelectItem value="no_stock_impact">Sem impacto em estoque</SelectItem>
                  <SelectItem value="combo_components">Combo (nao implementado)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Conditional: stock_item_direct fields */}
            {editing?.stockImpactRule === "stock_item_direct" && (
              <>
                <div className="col-span-2 border-t pt-3 pb-1">
                  <Label className="text-sm font-semibold text-amber-400">
                    <Package className="h-3.5 w-3.5 inline mr-1" />
                    Configuracao de Baixa Direta
                  </Label>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Item de Estoque *</Label>
                  <Select
                    value={editing?.directStockItem || ""}
                    onValueChange={(value) => setEditing((p) => p ? { ...p, directStockItem: value ?? "" } : null)}
                  >
                    <SelectTrigger>
                      {editing?.directStockItem && (ingredients || []).find((i: Ingredient) => i._id === editing.directStockItem) ? (
                        <span>{(ingredients || []).find((i: Ingredient) => i._id === editing.directStockItem)!.name}</span>
                      ) : (
                        <SelectValue placeholder="Selecione um ingrediente" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {(ingredients || []).map((i: Ingredient) => (
                        <SelectItem key={i._id} value={i._id}>
                          {i.name} ({i.baseUnit || "un"}) {i.isSellableDirectly ? " ★" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantidade por unidade</Label>
                  <Input
                    type="number" step="0.01" min="0.01"
                    value={editing?.directStockQuantity || "1"}
                    onChange={(e) => setEditing((p) => p ? { ...p, directStockQuantity: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select
                    value={editing?.directStockUnit || ""}
                    onValueChange={(value) => setEditing((p) => p ? { ...p, directStockUnit: value ?? "" } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {["g", "kg", "ml", "L", "unidade", "pacote", "caixa"].map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Conditional: no_stock_impact notice */}
            {editing?.stockImpactRule === "no_stock_impact" && (
              <div className="col-span-2 rounded-md bg-blue-500/10 border border-blue-500/20 p-3">
                <p className="text-sm text-blue-400 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  Este produto nao baixa estoque e nao gera CMV. Use para taxas, servicos ou produtos sem insumo.
                </p>
              </div>
            )}

            {/* Conditional: recipe_composition hint */}
            {editing?.stockImpactRule === "recipe_composition" && (
              <div className="col-span-2 rounded-md bg-amber-500/10 border border-amber-500/20 p-3">
                <p className="text-sm text-amber-400 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Este produto usa ficha tecnica. Apos salvar, cadastre uma receita para garantir baixa de estoque e CMV.
                </p>
              </div>
            )}

            {/* Conditional: combo notice */}
            {editing?.stockImpactRule === "combo_components" && (
              <div className="col-span-2 rounded-md bg-red-500/10 border border-red-500/20 p-3">
                <p className="text-sm text-red-400 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Combo ainda nao implementado. Vendas deste produto nao baixarao estoque.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={mutation.isPending}>Cancelar</Button>
            <Button
              disabled={mutation.isPending || !editing?.name}
              onClick={() => {
                if (!editing) return;
                const data: Record<string, unknown> = {
                  name: editing.name,
                  description: editing.description,
                  price: parseFloat(editing.price) || 0,
                  categoryId: editing.category || undefined,
                  sellableType: editing.sellableType,
                  stockImpactRule: editing.stockImpactRule,
                };

                if (editing.stockImpactRule === "stock_item_direct") {
                  data.directStockItem = editing.directStockItem || undefined;
                  data.directStockQuantity = parseFloat(editing.directStockQuantity) || 1;
                  data.directStockUnit = editing.directStockUnit || undefined;
                }

                mutation.mutate({
                  method: editing._id ? "put" : "post",
                  id: editing._id,
                  data,
                });
              }}
            >
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Excluir Produto"
        description="Tem certeza que deseja excluir este produto? Esta acao nao pode ser desfeita."
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        confirmLabel="Excluir"
        variant="destructive"
      />
    </div>
  );
}
