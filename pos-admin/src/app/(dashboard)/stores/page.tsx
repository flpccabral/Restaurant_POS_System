"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import { storesService } from "@/services/api/stores";

export default function StoresPage() {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    _id?: string; name: string; cnpj: string; email: string; phone: string;
    city: string; state: string; taxRate: string;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["stores"],
    queryFn: () => storesService.getAll().then((r) => r.data.data),
  });

  const mutation = useMutation({
    mutationFn: (vars: { method: "post" | "put"; id?: string; data: Record<string, unknown> }) => {
      if (vars.method === "post") return storesService.create(vars.data);
      return storesService.update(vars.id!, vars.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      toast.success("Loja salva com sucesso");
      setEditing(null);
    },
    onError: () => toast.error("Erro ao salvar loja"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => storesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      toast.success("Loja excluída");
      setDeleteId(null);
    },
    onError: () => toast.error("Erro ao excluir loja"),
  });

  const columns = [
    { key: "name", header: "Nome" },
    { key: "cnpj", header: "CNPJ" },
    { key: "email", header: "E-mail" },
    { key: "phone", header: "Telefone" },
    {
      key: "address",
      header: "Cidade/UF",
      cell: (row: unknown) => {
        const a = (row as Record<string, unknown>).address as Record<string, string> | undefined;
        return a ? `${a.city}/${a.state}` : "—";
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
          <h1 className="text-2xl font-bold text-white">Lojas</h1>
          <p className="text-zinc-400 text-sm mt-1">Gerencie lojas e configurações</p>
        </div>
        <Button onClick={() => setEditing({ name: "", cnpj: "", email: "", phone: "", city: "", state: "", taxRate: "0" })} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="h-4 w-4 mr-2" />
          Nova Loja
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data || []}
        loading={isLoading}
        searchKey="name"
        searchPlaceholder="Pesquisar lojas..."
        emptyMessage="Nenhuma loja encontrada."
        onEdit={(id) => {
          const s = (data || []).find((x: { _id: string }) => x._id === id);
          if (s) {
            const a = s.address as Record<string, string> | undefined;
            const st = s.settings as Record<string, unknown> | undefined;
            setEditing({
              _id: s._id,
              name: s.name,
              cnpj: s.cnpj || "",
              email: s.email,
              phone: s.phone || "",
              city: a?.city || "",
              state: a?.state || "",
              taxRate: String(st?.taxRate || 0),
            });
          }
        }}
        onDelete={(id) => setDeleteId(id)}
      />

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>{editing?._id ? "Editar Loja" : "Nova Loja"}</DialogTitle>
            <DialogDescription className="text-zinc-400">Preencha os dados da loja</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label>Nome</Label>
              <Input value={editing?.name || ""} onChange={(e) => setEditing((p) => p ? { ...p, name: e.target.value } : null)} className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={editing?.cnpj || ""} onChange={(e) => setEditing((p) => p ? { ...p, cnpj: e.target.value } : null)} className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={editing?.email || ""} onChange={(e) => setEditing((p) => p ? { ...p, email: e.target.value } : null)} className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={editing?.phone || ""} onChange={(e) => setEditing((p) => p ? { ...p, phone: e.target.value } : null)} className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div>
              <Label>Taxa de Imposto (%)</Label>
              <Input type="number" value={editing?.taxRate || "0"} onChange={(e) => setEditing((p) => p ? { ...p, taxRate: e.target.value } : null)} className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={editing?.city || ""} onChange={(e) => setEditing((p) => p ? { ...p, city: e.target.value } : null)} className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div>
              <Label>Estado</Label>
              <Input value={editing?.state || ""} onChange={(e) => setEditing((p) => p ? { ...p, state: e.target.value } : null)} className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button className="bg-orange-500 hover:bg-orange-600" disabled={mutation.isPending || !editing?.name} onClick={() => { if (!editing) return; mutation.mutate({ method: editing._id ? "put" : "post", id: editing._id, data: { name: editing.name, cnpj: editing.cnpj, email: editing.email, phone: editing.phone, address: { city: editing.city, state: editing.state }, settings: { taxRate: parseFloat(editing.taxRate) || 0 } } }) }}>
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Excluir Loja"
        description="Tem certeza que deseja excluir esta loja? Esta ação não pode ser desfeita."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        confirmLabel="Excluir"
        variant="destructive"
      />
    </div>
  );
}
