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
import { ingredientsService } from "@/services/api/ingredients";

const categories = ["proteina", "carboidrato", "vegetal", "laticinio", "tempero", "bebida", "outro"];
const units = ["g", "kg", "ml", "L", "unidade"];

export default function IngredientsPage() {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    _id?: string; name: string; category: string; baseUnit: string;
    averageCost: string; minimumStock: string;
  } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["ingredients"],
    queryFn: () => ingredientsService.getAll().then((r) => r.data.data),
  });

  const mutation = useMutation({
    mutationFn: (vars: { method: "post" | "put"; id?: string; data: Record<string, unknown> }) => {
      if (vars.method === "post") return ingredientsService.create(vars.data);
      return ingredientsService.update(vars.id!, vars.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      toast.success("Ingrediente salvo com sucesso");
      setEditing(null);
    },
    onError: () => toast.error("Erro ao salvar ingrediente"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ingredientsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      toast.success("Ingrediente excluído");
      setDeleteId(null);
    },
    onError: () => toast.error("Erro ao excluir ingrediente"),
  });

  const columns = [
    { key: "name", header: "Nome" },
    { key: "category", header: "Categoria" },
    { key: "baseUnit", header: "Unidade" },
    {
      key: "averageCost",
      header: "Custo Médio",
      cell: (row: unknown) => `R$ ${Number((row as Record<string, unknown>).averageCost).toFixed(2)}`,
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
          <h1 className="text-2xl font-bold text-white">Ingredientes</h1>
          <p className="text-zinc-400 text-sm mt-1">Gerencie ingredientes e unidades de medida</p>
        </div>
        <Button
          onClick={() => setEditing({ name: "", category: "outro", baseUnit: "unidade", averageCost: "0", minimumStock: "0" })}
          className="bg-brand hover:bg-brand-muted text-brand-foreground"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Ingrediente
        </Button>
      </div>

      {isError ? (
        <ErrorState
          message="Falha ao carregar ingredientes"
          description="Verifique se o servidor backend está rodando e tente novamente."
          onRetry={refetch}
        />
      ) : (
      <DataTable
        columns={columns}
        data={data || []}
        loading={isLoading}
        searchKey="name"
        searchPlaceholder="Pesquisar ingredientes..."
        emptyMessage="Nenhum ingrediente encontrado."
        onEdit={(id) => {
          const ing = (data || []).find((i: { _id: string }) => i._id === id);
          if (ing) {
            setEditing({
              _id: ing._id,
              name: ing.name,
              category: ing.category || "outro",
              baseUnit: ing.baseUnit || "unidade",
              averageCost: String(ing.averageCost || 0),
              minimumStock: String(ing.minimumStock || 0),
            });
          }
        }}
        onDelete={(id) => setDeleteId(id)}
      />
      )}

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>{editing?._id ? "Editar Ingrediente" : "Novo Ingrediente"}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Preencha os dados do ingrediente
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label>Nome</Label>
              <Input
                value={editing?.name || ""}
                onChange={(e) => setEditing((p) => p ? { ...p, name: e.target.value } : null)}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="Ex: Farinha de trigo, Picanha..."
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={editing?.category || ""} onValueChange={(v) => setEditing((p) => p ? { ...p, category: v || "outro" } : null)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unidade</Label>
              <Select value={editing?.baseUnit || ""} onValueChange={(v) => setEditing((p) => p ? { ...p, baseUnit: v || "unidade" } : null)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                  {units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Custo Médio (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={editing?.averageCost || "0"}
                onChange={(e) => setEditing((p) => p ? { ...p, averageCost: e.target.value } : null)}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div>
              <Label>Estoque Mínimo</Label>
              <Input
                type="number"
                value={editing?.minimumStock || "0"}
                onChange={(e) => setEditing((p) => p ? { ...p, minimumStock: e.target.value } : null)}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              className="bg-brand hover:bg-brand-muted text-brand-foreground"
              disabled={mutation.isPending || !editing?.name}
              onClick={() => {
                if (!editing) return;
                mutation.mutate({
                  method: editing._id ? "put" : "post",
                  id: editing._id,
                  data: {
                    name: editing.name,
                    category: editing.category,
                    baseUnit: editing.baseUnit,
                    averageCost: parseFloat(editing.averageCost) || 0,
                    minimumStock: parseFloat(editing.minimumStock) || 0,
                  },
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
        title="Excluir Ingrediente"
        description="Tem certeza que deseja excluir este ingrediente? Esta ação não pode ser desfeita."
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        confirmLabel="Excluir"
        variant="destructive"
      />
    </div>
  );
}
