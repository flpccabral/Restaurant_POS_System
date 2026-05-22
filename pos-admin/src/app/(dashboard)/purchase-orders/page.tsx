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
import { purchaseOrdersService } from "@/services/api/purchase-orders";

const statusColors: Record<string, "active" | "inactive" | "pending" | "low"> = {
  draft: "inactive",
  pending: "pending",
  sent: "pending",
  confirmed: "active",
  partially_received: "pending",
  received: "active",
  cancelled: "inactive",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  pending: "Pendente",
  sent: "Enviado",
  confirmed: "Confirmado",
  partially_received: "Parcial",
  received: "Recebido",
  cancelled: "Cancelado",
};

export default function PurchaseOrdersPage() {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ supplierId: "", expectedDate: "", notes: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: () => purchaseOrdersService.getAll().then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => purchaseOrdersService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Pedido de compra criado");
      setCreating(false);
      setForm({ supplierId: "", expectedDate: "", notes: "" });
    },
    onError: () => toast.error("Erro ao criar pedido"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      purchaseOrdersService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Status atualizado");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => purchaseOrdersService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Pedido excluído");
      setDeleteId(null);
    },
    onError: () => toast.error("Erro ao excluir pedido"),
  });

  const columns = [
    {
      key: "orderNumber",
      header: "Nº Pedido",
      cell: (row: unknown) => {
        const r = row as Record<string, unknown>;
        return (r.orderNumber as string) || (String(r._id || "")).slice(-6);
      },
    },
    {
      key: "supplier",
      header: "Fornecedor",
      cell: (row: unknown) => {
        const s = (row as Record<string, unknown>).supplier as { name?: string } | undefined;
        return s?.name || "—";
      },
    },
    {
      key: "total",
      header: "Total",
      cell: (row: unknown) => `R$ ${Number((row as Record<string, unknown>).total).toFixed(2)}`,
    },
    {
      key: "status",
      header: "Status",
      cell: (row: unknown) => {
        const s = (row as Record<string, unknown>).status as string;
        return <StatusBadge status={statusColors[s] || "inactive"} label={statusLabels[s] || s} />;
      },
    },
    {
      key: "expectedDate",
      header: "Prev. Entrega",
      cell: (row: unknown) => {
        const d = (row as Record<string, unknown>).expectedDate as string;
        return d ? new Date(d).toLocaleDateString("pt-BR") : "—";
      },
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pedidos de Compra</h1>
          <p className="text-zinc-400 text-sm mt-1">Gerencie pedidos de compra e aquisições</p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="h-4 w-4 mr-2" />
          Novo Pedido
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data || []}
        loading={isLoading}
        searchKey="orderNumber"
        searchPlaceholder="Pesquisar pedidos..."
        emptyMessage="Nenhum pedido de compra encontrado."
        onEdit={(id) => {
          const po = (data || []).find((x: { _id: string }) => x._id === id);
          if (po) {
            const poData = po as unknown as Record<string, unknown>;
            const nextStatus = poData.status === "pending" ? "confirmed"
              : poData.status === "confirmed" ? "received"
              : undefined;
            if (nextStatus) statusMutation.mutate({ id, status: nextStatus });
          }
        }}
        onDelete={(id) => setDeleteId(id)}
      />

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Novo Pedido de Compra</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Preencha os dados do pedido
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Fornecedor (ID)</Label>
              <Input value={form.supplierId} onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" placeholder="ID do fornecedor" />
            </div>
            <div>
              <Label>Previsão de Entrega</Label>
              <Input type="date" value={form.expectedDate} onChange={(e) => setForm((p) => ({ ...p, expectedDate: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div>
              <Label>Observações</Label>
              <Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button className="bg-orange-500 hover:bg-orange-600" disabled={!form.supplierId} onClick={() => createMutation.mutate({ supplier: form.supplierId, expectedDate: form.expectedDate, notes: form.notes, items: [] })}>
              Criar Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Excluir Pedido"
        description="Tem certeza que deseja excluir este pedido de compra?"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        confirmLabel="Excluir"
        variant="destructive"
      />
    </div>
  );
}
