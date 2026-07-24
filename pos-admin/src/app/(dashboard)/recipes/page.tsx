"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, FileText, AlertTriangle, CheckCircle, XCircle, Eye } from "lucide-react";
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
import type { Product } from "@/types";
import { recipesService, type Recipe } from "@/services/api/recipes";
import { productsService } from "@/services/api/products";
import { ingredientsService } from "@/services/api/ingredients";
import { useStoreContext } from "@/contexts/StoreContext";

export default function RecipesPage() {
  const { storeId } = useStoreContext();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    _id?: string;
    name: string;
    sku: string;
    product: string;
    productName: string;
    variation: string;
    store: string;
    yieldQuantity: string;
    preparationTime: string;
    instructions: string;
    isActive: boolean;
    ingredients: Array<{
      ingredientId: string;
      ingredientName: string;
      netQuantity: string;
      unit: string;
      lossFactor: string;
    }>;
  } | null>(null);

  const [showDetail, setShowDetail] = useState<Recipe | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["recipes", storeId],
    queryFn: () => recipesService.getAll().then((r) => r.data.data),
  });

  const { data: products } = useQuery({
    queryKey: ["products", storeId],
    queryFn: () => productsService.getAll().then((r) => r.data.data).catch(() => []),
  });

  const { data: ingredients } = useQuery({
    queryKey: ["ingredients", storeId],
    queryFn: () => ingredientsService.getAll().then((r) => r.data.data).catch(() => []),
  });

  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!statusFilter) return data;
    if (statusFilter === "active") return data.filter((r: Recipe) => r.isActive === true);
    if (statusFilter === "inactive") return data.filter((r: Recipe) => r.isActive === false);
    return data;
  }, [data, statusFilter]);

  // Get available variations for the selected product
  const selectedProductId = editing?.product;
  const selectedProductVariations = useMemo(() => {
    if (!selectedProductId || !products) return [];
    const p = (products as Product[]).find((x) => x._id === selectedProductId);
    return (p?.variations as Array<{ _id: string; name: string; sku: string; price: number }> | undefined) || [];
  }, [selectedProductId, products]);

  const mutation = useMutation({
    mutationFn: (vars: { method: "post" | "put"; id?: string; data: Record<string, unknown> }) => {
      if (vars.method === "post") return recipesService.create(vars.data as unknown as Parameters<typeof recipesService.create>[0]);
      return recipesService.update(vars.id!, vars.data as unknown as Parameters<typeof recipesService.update>[1]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes", storeId] });
      queryClient.invalidateQueries({ queryKey: ["products", storeId] }); // Products may show recipe status
      toast.success("Receita salva com sucesso");
      setEditing(null);
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro ao salvar receita";
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => recipesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes", storeId] });
      queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      toast.success("Receita excluida");
      setDeleteId(null);
    },
    onError: () => toast.error("Erro ao excluir receita"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      recipesService.toggleStatus(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes", storeId] });
      queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      toast.success("Status da receita atualizado");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const columns = [
    {
      key: "product",
      header: "Produto",
      cell: (row: unknown) => {
        const r = row as Record<string, unknown>;
        const p = r.product;
        if (typeof p === "object" && p !== null) {
          return (p as { name?: string }).name || "—";
        }
        return String(p || "—");
      },
    },
    {
      key: "name",
      header: "Nome da Receita",
    },
    {
      key: "ingredients",
      header: "Ingredientes",
      cell: (row: unknown) => {
        const ings = (row as Record<string, unknown>).ingredients as Array<unknown> | undefined;
        return ings ? `${ings.length} item(ns)` : "0";
      },
    },
    {
      key: "totalCost",
      header: "Custo",
      cell: (row: unknown) => {
        const cost = (row as Record<string, unknown>).totalCost as number | undefined;
        return cost != null ? `R$ ${Number(cost).toFixed(2)}` : "—";
      },
    },
    {
      key: "isActive",
      header: "Status",
      cell: (row: unknown) => (
        <StatusBadge status={((row as Record<string, unknown>).isActive as boolean) ? "ok" : "inactive"}
          label={((row as Record<string, unknown>).isActive as boolean) ? "Ativa" : "Inativa"}
          icon={((row as Record<string, unknown>).isActive as boolean) ? CheckCircle : XCircle}
        />
      ),
    },
  ];

  const handleEdit = (id: string) => {
    const r = (data || []).find((x: { _id: string }) => x._id === id);
    if (!r) return;
    const prod = r.product;
    const productId = typeof prod === "object" && prod !== null ? (prod as { _id?: string })._id || "" : "";
    const productName = typeof prod === "object" && prod !== null ? (prod as { name?: string }).name || "" : String(prod);
    setEditing({
      _id: r._id,
      name: r.name,
      sku: r.sku,
      product: productId,
      productName,
      variation: r.variation || "",
      store: r.store || "",
      yieldQuantity: String(r.yieldQuantity || 1),
      preparationTime: String(r.preparationTime || 0),
      instructions: r.instructions || "",
      isActive: r.isActive ?? true,
      ingredients: (r.ingredients || []).map((ing: Record<string, unknown>) => ({
        ingredientId: typeof ing.ingredient === "object" && ing.ingredient !== null
          ? (ing.ingredient as { _id?: string })._id || ""
          : String(ing.ingredient || ""),
        ingredientName: typeof ing.ingredient === "object" && ing.ingredient !== null
          ? (ing.ingredient as { name?: string }).name || ""
          : "",
        netQuantity: String(ing.netQuantity ?? ""),
        unit: String(ing.unit || ""),
        lossFactor: String(ing.lossFactor ?? 0),
      })),
    });
  };

  const handleViewDetail = (id: string) => {
    const r = (data || []).find((x: { _id: string }) => x._id === id);
    if (r) setShowDetail(r);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Fichas Técnicas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Gerencie receitas para controle de estoque e CMV
          </p>
        </div>
        <Button onClick={() =>
          setEditing({
            name: "", sku: "", product: "", productName: "", variation: "",
            store: "", yieldQuantity: "1", preparationTime: "0", instructions: "",
            isActive: true, ingredients: [],
          })
        }>
          <Plus className="h-4 w-4 mr-2" />
          Nova Receita
        </Button>
      </div>

      <FilterPills
        options={[
          { value: "active", label: "Ativas" },
          { value: "inactive", label: "Inativas" },
        ]}
        selected={statusFilter}
        onChange={setStatusFilter}
        allLabel="Todas"
      />

      {isError ? (
        <ErrorState
          message="Falha ao carregar receitas"
          description="Verifique se o servidor backend está rodando e tente novamente."
          onRetry={refetch}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredData}
          loading={isLoading}
          searchKey="name"
          searchPlaceholder="Pesquisar receitas..."
          emptyMessage="Nenhuma ficha técnica encontrada."
          onEdit={handleEdit}
          onDelete={(id) => setDeleteId(id)}
          customActions={(row: unknown) => {
            const r = row as Record<string, unknown>;
            return (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleViewDetail(String(r._id))}
                title="Ver detalhes"
              >
                <Eye className="h-3.5 w-3.5" />
                <span className="sr-only">Detalhes</span>
              </Button>
            );
          }}
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={!!editing && !showDetail} onOpenChange={(open) => { if (!open) { setEditing(null); } } }>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?._id ? "Editar Receita" : "Nova Receita"}</DialogTitle>
            <DialogDescription>
              {editing?._id
                ? "Atualize os dados da ficha técnica"
                : "Crie uma ficha técnica para vincular ingredientes ao produto"
              }
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-5 py-2">
              {/* Product selection */}
              <div className="space-y-2">
                <Label>Produto *</Label>
                <Select
                  value={editing.product}
                  onValueChange={(v) => setEditing((p) => p ? {
                    ...p,
                    product: v ?? "",
                    productName: (products || []).find((x: { _id: string }) => x._id === v)?.name || "",
                    variation: "",
                  } : null)}
                >
                  <SelectTrigger>
                    {editing.product ? (
                      <span>{(products || []).find((x: { _id: string; name: string }) => x._id === editing.product)?.name || "—"}</span>
                    ) : (
                      <SelectValue placeholder="Selecione um produto" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {(products || []).map((p: Product) => {
                      const rule = p.stockImpactRule || 'recipe_composition';
                      const needsRecipe = rule === 'recipe_composition';
                      return (
                        <SelectItem key={p._id} value={p._id}>
                          {p.name} {needsRecipe ? '' : '(sem receita)'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {editing.product && (() => {
                  const selectedP = (products || []).find((p: Product) => p._id === editing.product) as Product | undefined;
                  const rule = selectedP?.stockImpactRule || 'recipe_composition';
                  if (rule === 'stock_item_direct') {
                    return (
                      <p className="text-xs text-amber-400 mt-1">
                        Este produto usa baixa direta de estoque — nao necessita de ficha tecnica.
                      </p>
                    );
                  }
                  if (rule === 'no_stock_impact') {
                    return (
                      <p className="text-xs text-blue-400 mt-1">
                        Este produto nao baixa estoque — nao necessita de ficha tecnica.
                      </p>
                    );
                  }
                  if (rule === 'combo_components') {
                    return (
                      <p className="text-xs text-red-400 mt-1">
                        Combo nao implementado — nao e possivel criar receita para este produto.
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Recipe name */}
              <div className="space-y-2">
                <Label>Nome da Receita *</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing((p) => p ? { ...p, name: e.target.value } : null)}
                  placeholder="Ex: Preparo do Hamburguer"
                />
              </div>

              {/* SKU */}
              <div className="space-y-2">
                <Label>SKU *</Label>
                <Input
                  value={editing.sku}
                  onChange={(e) => setEditing((p) => p ? { ...p, sku: e.target.value } : null)}
                  placeholder="Ex: HAMB-001"
                  disabled={!!editing._id}
                />
              </div>

              {/* Variation */}
              <div className="space-y-2">
                <Label>Variacao / SKU da Variacao *</Label>
                <Select
                  value={editing.variation}
                  onValueChange={(v) => setEditing((p) => p ? { ...p, variation: v ?? "" } : null)}
                  disabled={!editing.product}
                >
                  <SelectTrigger>
                    {editing.variation && selectedProductVariations.length > 0 ? (
                      <span>{selectedProductVariations.find((v: { sku: string; name: string }) => v.sku === editing.variation)?.name || editing.variation}</span>
                    ) : (
                      <SelectValue placeholder={!editing.product ? "Selecione um produto primeiro" : "Selecione uma variacao"} />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProductVariations.map((v: { sku: string; name: string }) => (
                      <SelectItem key={v.sku} value={v.sku}>{v.name} ({v.sku})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Yield */}
              <div className="space-y-2">
                <Label>Rendimento (porcoes)</Label>
                <Input
                  type="number" min="1"
                  value={editing.yieldQuantity}
                  onChange={(e) => setEditing((p) => p ? { ...p, yieldQuantity: e.target.value } : null)}
                />
              </div>

              {/* Prep time */}
              <div className="space-y-2">
                <Label>Tempo de Preparo (min)</Label>
                <Input
                  type="number" min="0"
                  value={editing.preparationTime}
                  onChange={(e) => setEditing((p) => p ? { ...p, preparationTime: e.target.value } : null)}
                />
              </div>

              {/* Instructions */}
              <div className="col-span-2 space-y-2">
                <Label>Instrucoes</Label>
                <Input
                  value={editing.instructions}
                  onChange={(e) => setEditing((p) => p ? { ...p, instructions: e.target.value } : null)}
                  placeholder="Modo de preparo (opcional)"
                />
              </div>

              {/* Ingredients Section */}
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base font-semibold">Ingredientes</Label>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => setEditing((p) => p ? {
                      ...p,
                      ingredients: [...p.ingredients, { ingredientId: "", ingredientName: "", netQuantity: "", unit: "g", lossFactor: "0" }]
                    } : null)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar
                  </Button>
                </div>

                {editing.ingredients.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                    Nenhum ingrediente adicionado. Adicione pelo menos um ingrediente.
                  </p>
                )}

                {editing.ingredients.map((ing, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                    <div className="col-span-4">
                      <Label className="text-xs">Ingrediente</Label>
                      <Select
                        value={ing.ingredientId}
                        onValueChange={(v) => {
                          const val = v ?? "";
                          const ingName = (ingredients || []).find((i: { _id: string }) => i._id === val)?.name || "";
                          setEditing((p) => {
                            if (!p) return null;
                            const ings = [...p.ingredients];
                            ings[idx] = { ...ings[idx], ingredientId: val, ingredientName: ingName };
                            return { ...p, ingredients: ings };
                          });
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          {ing.ingredientId ? (
                            <span className="text-xs">{(ingredients || []).find((i: { _id: string; name: string }) => i._id === ing.ingredientId)?.name || "—"}</span>
                          ) : (
                            <SelectValue placeholder="Selecione" />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {(ingredients || []).map((i: { _id: string; name: string; baseUnit?: string }) => (
                            <SelectItem key={i._id} value={i._id}>
                              {i.name} ({i.baseUnit || "un"})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Qtd.</Label>
                      <Input
                        type="number" step="0.01" min="0.01"
                        className="h-9 text-xs"
                        value={ing.netQuantity}
                        onChange={(e) => {
                          setEditing((p) => {
                            if (!p) return null;
                            const ings = [...p.ingredients];
                            ings[idx] = { ...ings[idx], netQuantity: e.target.value };
                            return { ...p, ingredients: ings };
                          });
                        }}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Unidade</Label>
                      <Select
                        value={ing.unit}
                        onValueChange={(v) => {
                          setEditing((p) => {
                            if (!p) return null;
                            const ings = [...p.ingredients];
                            ings[idx] = { ...ings[idx], unit: v ?? "" };
                            return { ...p, ingredients: ings };
                          });
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["g", "kg", "ml", "L", "unidade", "colher_sopa", "xicara", "fatia", "pacote"].map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Perda %</Label>
                      <Input
                        type="number" min="0" max="100"
                        className="h-9 text-xs"
                        value={ing.lossFactor}
                        onChange={(e) => {
                          setEditing((p) => {
                            if (!p) return null;
                            const ings = [...p.ingredients];
                            ings[idx] = { ...ings[idx], lossFactor: e.target.value };
                            return { ...p, ingredients: ings };
                          });
                        }}
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-2 flex gap-1">
                      <Button
                        variant="ghost" size="sm"
                        className="text-red-400 h-9 px-2"
                        onClick={() => {
                          setEditing((p) => {
                            if (!p) return null;
                            return { ...p, ingredients: p.ingredients.filter((_, i) => i !== idx) };
                          });
                        }}
                        disabled={editing.ingredients.length <= 1}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              disabled={mutation.isPending || !editing}
              onClick={async () => {
                if (!editing) return;
                try {
                  const result = await recipesService.validate({
                    sku: editing.sku,
                    product: editing.product,
                    variation: editing.variation,
                    name: editing.name,
                    ingredients: editing.ingredients.map(i => ({
                      ingredientId: i.ingredientId,
                      netQuantity: parseFloat(i.netQuantity) || 0,
                      unit: i.unit,
                      lossFactor: parseFloat(i.lossFactor) || 0,
                    })),
                    yieldQuantity: parseInt(editing.yieldQuantity) || 1,
                  });
                  if (result.data.data.valid) {
                    toast.success("Receita valida!");
                  } else {
                    toast.error(result.data.data.errors.join(", "));
                  }
                } catch {
                  toast.error("Erro ao validar receita");
                }
              }}
            >
              Validar
            </Button>
            <Button
              disabled={mutation.isPending || !editing?.name || !editing?.sku || !editing?.product || !editing?.variation || editing?.ingredients.length === 0}
              onClick={() => {
                if (!editing) return;

                // Verificar se o produto precisa de receita
                const selectedP = (products || []).find((p: Product) => p._id === editing.product) as Product | undefined;
                const rule = selectedP?.stockImpactRule || 'recipe_composition';
                if (rule !== 'recipe_composition') {
                  toast.error(`Produto com regra "${rule}" nao necessita de ficha tecnica. Altere a regra de impacto em estoque do produto para recipe_composition.`);
                  return;
                }

                mutation.mutate({
                  method: editing._id ? "put" : "post",
                  id: editing._id,
                  data: {
                    name: editing.name,
                    sku: editing.sku,
                    product: editing.product,
                    variation: editing.variation,
                    yieldQuantity: parseInt(editing.yieldQuantity) || 1,
                    preparationTime: parseInt(editing.preparationTime) || 0,
                    instructions: editing.instructions,
                    isActive: editing.isActive,
                    ingredients: editing.ingredients.map(i => ({
                      ingredientId: i.ingredientId,
                      netQuantity: parseFloat(i.netQuantity) || 0,
                      unit: i.unit,
                      lossFactor: parseFloat(i.lossFactor) || 0,
                    })),
                  },
                });
              }}
            >
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!showDetail} onOpenChange={(open) => { if (!open) setShowDetail(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Receita</DialogTitle>
          </DialogHeader>
          {showDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Produto</Label>
                  <p className="text-sm font-medium">
                    {(() => {
                      const p = showDetail.product;
                      return typeof p === "object" && p !== null ? (p as { name?: string }).name || "—" : "—";
                    })()}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Nome da Receita</Label>
                  <p className="text-sm font-medium">{String(showDetail.name || "")}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">SKU</Label>
                  <p className="text-sm font-medium">{String(showDetail.sku || "")}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Variacao</Label>
                  <p className="text-sm font-medium">{String(showDetail.variation || "—")}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Rendimento</Label>
                  <p className="text-sm font-medium">{String(showDetail.yieldQuantity || 1)} porcao(oes)</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Custo Total</Label>
                  <p className="text-sm font-medium">
                    R$ {Number(showDetail.totalCost || 0).toFixed(2)}
                  </p>
                </div>
                {showDetail.instructions && (
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Instrucoes</Label>
                    <p className="text-sm">{String(showDetail.instructions)}</p>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground block mb-1">Ingredientes</Label>
                <div className="border rounded-lg divide-y">
                  {(showDetail.ingredients as Array<Record<string, unknown>> || []).map((ing, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="font-medium">
                        {typeof ing.ingredient === "object" && ing.ingredient !== null
                          ? (ing.ingredient as { name?: string }).name || "—"
                          : "—"}
                      </span>
                      <span className="text-muted-foreground">
                        {String(ing.netQuantity ?? "?")} {String(ing.unit || "")}
                        {Number(ing.lossFactor || 0) > 0 && ` (perda: ${ing.lossFactor}%)`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">Status</span>
                <StatusBadge
                  status={showDetail.isActive ? "ok" : "inactive"}
                  label={showDetail.isActive ? "Ativa" : "Inativa"}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetail(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Excluir Receita"
        description="Tem certeza que deseja excluir esta ficha tecnica? Esta acao nao pode ser desfeita."
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        confirmLabel="Excluir"
        variant="destructive"
      />
    </div>
  );
}
