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
import { categoriesService } from "@/services/api/categories";

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ _id?: string; name: string; description: string } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesService.getAll().then((r) => r.data.data),
  });

  const mutation = useMutation({
    mutationFn: (vars: { method: "post" | "put"; id?: string; data: { name: string; description?: string } }) => {
      if (vars.method === "post") return categoriesService.create(vars.data);
      return categoriesService.update(vars.id!, vars.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Categoria salva com sucesso");
      setEditing(null);
    },
    onError: () => toast.error("Erro ao salvar categoria"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoriesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Categoria excluída");
      setDeleteId(null);
    },
    onError: () => toast.error("Erro ao excluir categoria"),
  });

  const columns = [
    { key: "name", header: "Nome" },
    { key: "description", header: "Descrição" },
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
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Categorias</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie as categorias do catalogo</p>
        </div>
        <Button onClick={() => setEditing({ name: "", description: "" })}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Categoria
        </Button>
      </div>

      {isError ? (
        <ErrorState
          message="Falha ao carregar categorias"
          description="Verifique se o servidor backend está rodando e tente novamente."
          onRetry={refetch}
        />
      ) : (
      <DataTable
        columns={columns}
        data={data || []}
        loading={isLoading}
        searchKey="name"
        searchPlaceholder="Pesquisar categorias..."
        emptyMessage="Nenhuma categoria encontrada."
        onEdit={(id) => {
          const cat = (data || []).find((c: { _id: string }) => c._id === id);
          if (cat) setEditing({ _id: cat._id, name: cat.name, description: cat.description || "" });
        }}
        onDelete={(id) => setDeleteId(id)}
      />
      )}

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?._id ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
            <DialogDescription>Preencha os dados da categoria</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Nome</Label>
              <Input
                id="cat-name"
                value={editing?.name || ""}
                onChange={(e) => setEditing((prev) => prev ? { ...prev, name: e.target.value } : null)}
                placeholder="Ex: Bebidas, Sobremesas..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Descricao</Label>
              <Input
                id="cat-desc"
                value={editing?.description || ""}
                onChange={(e) => setEditing((prev) => prev ? { ...prev, description: e.target.value } : null)}
                placeholder="Descricao opcional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={mutation.isPending}>Cancelar</Button>
            <Button
              disabled={mutation.isPending || !editing?.name}
              onClick={() => {
                if (!editing) return;
                mutation.mutate({
                  method: editing._id ? "put" : "post",
                  id: editing._id,
                  data: { name: editing.name, description: editing.description },
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
        title="Excluir Categoria"
        description="Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita."
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        confirmLabel="Excluir"
        variant="destructive"
      />
    </div>
  );
}
