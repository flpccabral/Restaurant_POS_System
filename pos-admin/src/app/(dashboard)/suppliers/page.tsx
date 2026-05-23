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
import { suppliersService } from "@/services/api/suppliers";

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    _id?: string; name: string; tradeName: string; document: string;
    email: string; phone: string; city: string; state: string;
    rating: string; notes: string;
  } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => suppliersService.getAll().then((r) => r.data.data),
  });

  const mutation = useMutation({
    mutationFn: (vars: { method: "post" | "put"; id?: string; data: Record<string, unknown> }) => {
      if (vars.method === "post") return suppliersService.create(vars.data);
      return suppliersService.update(vars.id!, vars.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Fornecedor salvo com sucesso");
      setEditing(null);
    },
    onError: () => toast.error("Erro ao salvar fornecedor"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => suppliersService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Fornecedor excluído");
      setDeleteId(null);
    },
    onError: () => toast.error("Erro ao excluir fornecedor"),
  });

  const columns = [
    { key: "name", header: "Nome" },
    { key: "tradeName", header: "Nome Fantasia" },
    {
      key: "contact",
      header: "Contato",
      cell: (row: unknown) => {
        const c = (row as Record<string, unknown>).contact as Record<string, string> | undefined;
        return c?.phone || "—";
      },
    },
    {
      key: "rating",
      header: "Avaliação",
      cell: (row: unknown) => {
        const r = (row as Record<string, unknown>).rating as number;
        return r ? "⭐".repeat(r) : "—";
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
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Fornecedores</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie fornecedores e contatos</p>
        </div>
        <Button
          onClick={() => setEditing({ name: "", tradeName: "", document: "", email: "", phone: "", city: "", state: "", rating: "3", notes: "" })}
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Fornecedor
        </Button>
      </div>

      {isError ? (
        <ErrorState
          message="Falha ao carregar fornecedores"
          description="Verifique se o servidor backend está rodando e tente novamente."
          onRetry={refetch}
        />
      ) : (
      <DataTable
        columns={columns}
        data={data || []}
        loading={isLoading}
        searchKey="name"
        searchPlaceholder="Pesquisar fornecedores..."
        emptyMessage="Nenhum fornecedor encontrado."
        onEdit={(id) => {
          const s = (data || []).find((x: { _id: string }) => x._id === id);
          if (s) {
            const c = s.contact as Record<string, string> | undefined;
            const a = s.address as Record<string, string> | undefined;
            setEditing({
              _id: s._id,
              name: s.name || "",
              tradeName: s.tradeName || "",
              document: s.document || "",
              email: c?.email || "",
              phone: c?.phone || "",
              city: a?.city || "",
              state: a?.state || "",
              rating: String(s.rating || 3),
              notes: s.notes || "",
            });
          }
        }}
        onDelete={(id) => setDeleteId(id)}
      />
      )}

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?._id ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
            <DialogDescription>Preencha os dados do fornecedor</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-5 py-2">
            <div className="col-span-2 space-y-2">
              <Label>Nome / Razao Social</Label>
              <Input value={editing?.name || ""} onChange={(e) => setEditing((p) => p ? { ...p, name: e.target.value } : null)} placeholder="Nome do fornecedor" />
            </div>
            <div className="space-y-2">
              <Label>Nome Fantasia</Label>
              <Input value={editing?.tradeName || ""} onChange={(e) => setEditing((p) => p ? { ...p, tradeName: e.target.value } : null)} placeholder="Nome fantasia" />
            </div>
            <div className="space-y-2">
              <Label>CNPJ/CPF</Label>
              <Input value={editing?.document || ""} onChange={(e) => setEditing((p) => p ? { ...p, document: e.target.value } : null)} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={editing?.email || ""} onChange={(e) => setEditing((p) => p ? { ...p, email: e.target.value } : null)} placeholder="fornecedor@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={editing?.phone || ""} onChange={(e) => setEditing((p) => p ? { ...p, phone: e.target.value } : null)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={editing?.city || ""} onChange={(e) => setEditing((p) => p ? { ...p, city: e.target.value } : null)} placeholder="Sao Paulo" />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input value={editing?.state || ""} onChange={(e) => setEditing((p) => p ? { ...p, state: e.target.value } : null)} placeholder="SP" />
            </div>
            <div className="space-y-2">
              <Label>Avaliacao (1-5)</Label>
              <Input type="number" min={1} max={5} value={editing?.rating || "3"} onChange={(e) => setEditing((p) => p ? { ...p, rating: e.target.value } : null)} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Observacoes</Label>
              <Input value={editing?.notes || ""} onChange={(e) => setEditing((p) => p ? { ...p, notes: e.target.value } : null)} placeholder="Observacoes opcionais" />
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
                  data: {
                    name: editing.name,
                    tradeName: editing.tradeName || undefined,
                    document: editing.document || undefined,
                    contact: { email: editing.email, phone: editing.phone },
                    address: { city: editing.city, state: editing.state },
                    rating: parseInt(editing.rating) || 3,
                    notes: editing.notes || undefined,
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
        title="Excluir Fornecedor"
        description="Tem certeza que deseja excluir este fornecedor? Esta ação não pode ser desfeita."
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        confirmLabel="Excluir"
        variant="destructive"
      />
    </div>
  );
}
