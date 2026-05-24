"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, FileText, AlertTriangle } from "lucide-react";
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
import { productsService } from "@/services/api/products";
import { categoriesService } from "@/services/api/categories";

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    _id?: string; name: string; description: string; price: string; category: string;
  } | null>(null);
  const [recipeFilter, setRecipeFilter] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsService.getAll().then((r) => r.data.data),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesService.getAll().then((r) => r.data.data).catch(() => []),
  });

  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!recipeFilter) return data;
    if (recipeFilter === "without_recipe") {
      return data.filter((p: Product) => p.hasActiveRecipe === false);
    }
    if (recipeFilter === "with_recipe") {
      return data.filter((p: Product) => p.hasActiveRecipe === true);
    }
    return data;
  }, [data, recipeFilter]);

  const mutation = useMutation({
    mutationFn: (vars: { method: "post" | "put"; id?: string; data: Record<string, unknown> }) => {
      if (vars.method === "post") return productsService.create(vars.data);
      return productsService.update(vars.id!, vars.data);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto salvo com sucesso");

      // Check if saved product has no recipe — show warning (TASK 4)
      const isActive = vars.data.isActive !== false;
      if (!vars.data.hasActiveRecipe && isActive) {
        toast.warning(
          "Produto salvo, mas ainda não possui ficha técnica ativa. Cadastre uma receita para garantir baixa de estoque e CMV corretos.",
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
      toast.success("Produto excluído");
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
      cell: (row: unknown) => `R$ ${Number((row as Record<string, unknown>).price).toFixed(2)}`,
    },
    {
      key: "hasActiveRecipe",
      header: "Ficha Tecnica",
      cell: (row: unknown) => {
        const has = (row as Record<string, unknown>).hasActiveRecipe as boolean;
        return has ? (
          <StatusBadge status="ok" label="Com receita" />
        ) : (
          <StatusBadge status="critical" label="Sem receita" icon={AlertTriangle} />
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Produtos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie o catalogo de produtos</p>
        </div>
        <Button onClick={() => setEditing({ name: "", description: "", price: "0", category: "" })}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      {/* Filter pills for recipe status (TASK 3) */}
      <FilterPills
        options={[
          { value: "without_recipe", label: "Sem receita" },
          { value: "with_recipe", label: "Com receita" },
        ]}
        selected={recipeFilter}
        onChange={setRecipeFilter}
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
          if (p) {
            const cat = p.category;
            setEditing({
              _id: p._id,
              name: p.name,
              description: p.description || "",
              price: String(p.price || 0),
              category: typeof cat === "string" ? cat : (cat as { _id?: string })?._id || "",
            });
          }
        }}
        onDelete={(id) => setDeleteId(id)}
        customActions={(row: unknown) => {
          const r = row as Record<string, unknown>;
          const hasRecipe = r.hasActiveRecipe as boolean;
          if (!hasRecipe) {
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
          return null;
        }}
      />
      )}

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?._id ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            <DialogDescription>Preencha os dados do produto</DialogDescription>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={mutation.isPending}>Cancelar</Button>
            <Button disabled={mutation.isPending || !editing?.name} onClick={() => { if (!editing) return; mutation.mutate({ method: editing._id ? "put" : "post", id: editing._id, data: { name: editing.name, description: editing.description, price: parseFloat(editing.price) || 0, categoryId: editing.category || undefined } }) }}>
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
