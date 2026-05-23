"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { ErrorState } from "@/components/shared/ErrorState";
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
import { productsService } from "@/services/api/products";
import { categoriesService } from "@/services/api/categories";

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    _id?: string; name: string; description: string; price: string; category: string;
  } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsService.getAll().then((r) => r.data.data),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesService.getAll().then((r) => r.data.data).catch(() => []),
  });

  const mutation = useMutation({
    mutationFn: (vars: { method: "post" | "put"; id?: string; data: Record<string, unknown> }) => {
      if (vars.method === "post") return productsService.create(vars.data);
      return productsService.update(vars.id!, vars.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto salvo com sucesso");
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
      header: "Preço",
      cell: (row: unknown) => `R$ ${Number((row as Record<string, unknown>).price).toFixed(2)}`,
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
          <h1 className="text-2xl font-bold text-white">Produtos</h1>
          <p className="text-zinc-400 text-sm mt-1">Gerencie o catálogo de produtos</p>
        </div>
        <Button onClick={() => setEditing({ name: "", description: "", price: "0", category: "" })} className="bg-brand hover:bg-brand-muted text-brand-foreground">
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      {isError ? (
        <ErrorState
          message="Falha ao carregar produtos"
          description="Verifique se o servidor backend está rodando e tente novamente."
          onRetry={refetch}
        />
      ) : (
      <DataTable
        columns={columns}
        data={data || []}
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
      />
      )}

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>{editing?._id ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            <DialogDescription className="text-zinc-400">Preencha os dados do produto</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label>Nome</Label>
              <Input value={editing?.name || ""} onChange={(e) => setEditing((p) => p ? { ...p, name: e.target.value } : null)} className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div className="col-span-2">
              <Label>Descrição</Label>
              <Input value={editing?.description || ""} onChange={(e) => setEditing((p) => p ? { ...p, description: e.target.value } : null)} className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div>
              <Label>Preço (R$)</Label>
              <Input type="number" step="0.01" value={editing?.price || "0"} onChange={(e) => setEditing((p) => p ? { ...p, price: e.target.value } : null)} className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select
                value={editing?.category || ""}
                onValueChange={(value) => setEditing((p) => p ? { ...p, category: value ?? "" } : null)}
              >
                <SelectTrigger className="w-full bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Sem categoria" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectItem value="">Sem categoria</SelectItem>
                  {(categories || []).map((c: { _id: string; name: string }) => (
                    <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button className="bg-brand hover:bg-brand-muted text-brand-foreground" disabled={mutation.isPending || !editing?.name} onClick={() => { if (!editing) return; mutation.mutate({ method: editing._id ? "put" : "post", id: editing._id, data: { name: editing.name, description: editing.description, price: parseFloat(editing.price) || 0, category: editing.category || undefined } }) }}>
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Excluir Produto"
        description="Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita."
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        confirmLabel="Excluir"
        variant="destructive"
      />
    </div>
  );
}
