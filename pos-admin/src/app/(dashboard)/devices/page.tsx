"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle, XCircle } from "lucide-react";
import { ErrorState } from "@/components/shared/ErrorState";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { devicesService } from "@/services/api/devices";

export default function DevicesPage() {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["devices"],
    queryFn: () => devicesService.getAll().then((r) => r.data.data),
  });

  const { data: stats } = useQuery({
    queryKey: ["device-stats"],
    queryFn: () => devicesService.getStats().then((r) => r.data.data),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => devicesService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Dispositivo aprovado");
    },
    onError: () => toast.error("Erro ao aprovar dispositivo"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => devicesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Dispositivo removido");
      setDeleteId(null);
    },
    onError: () => toast.error("Erro ao remover dispositivo"),
  });

  const columns = [
    {
      key: "nickname",
      header: "Nome",
      cell: (row: unknown) => ((row as Record<string, unknown>).nickname as string) || "Sem nome",
    },
    {
      key: "deviceInfo",
      header: "Dispositivo",
      cell: (row: unknown): React.ReactNode => {
        const info = (row as Record<string, unknown>).deviceInfo as Record<string, string> | undefined;
        return info ? `${info.browser || ""} / ${info.os || ""}` : "—";
      },
    },
    {
      key: "store",
      header: "Loja",
      cell: (row: unknown) => {
        const s = (row as Record<string, unknown>).store as { name?: string } | undefined;
        return (s?.name || "—") as React.ReactNode;
      },
    },
    {
      key: "isApproved",
      header: "Status",
      cell: (row: unknown) => (
        <StatusBadge
          status={((row as Record<string, unknown>).isApproved as boolean) ? "active" : "pending"}
          label={((row as Record<string, unknown>).isApproved as boolean) ? "Aprovado" : "Pendente"}
        />
      ),
    },
    {
      key: "lastActiveAt",
      header: "Última Atividade",
      cell: (row: unknown) => {
        const d = (row as Record<string, unknown>).lastActiveAt as string;
        return d ? new Date(d).toLocaleString("pt-BR") : "Nunca";
      },
    },
  ];

  const devices = data || [];
  const statsData = stats as Record<string, number> | undefined;
  const total = statsData?.total || devices.length;
  const approved = statsData?.approved || devices.filter((d) => d.isApproved).length;
  const pending = statsData?.pending || devices.filter((d) => !d.isApproved).length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dispositivos</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Gerencie dispositivos e terminais PDV</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold text-foreground mt-1">{total}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground">Aprovados</p>
          <p className="text-2xl font-bold text-success mt-1">{approved}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground">Pendentes</p>
          <p className="text-2xl font-bold text-warning mt-1">{pending}</p>
        </div>
      </div>

      {isError ? (
        <ErrorState
          message="Falha ao carregar dispositivos"
          description="Verifique se o servidor backend está rodando e tente novamente."
          onRetry={refetch}
        />
      ) : (
      <DataTable
        columns={columns}
        data={devices}
        loading={isLoading}
        searchKey="nickname"
        searchPlaceholder="Pesquisar dispositivos..."
        emptyMessage="Nenhum dispositivo encontrado."
        onEdit={(id) => approveMutation.mutate(id)}
        onDelete={(id) => setDeleteId(id)}
      />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Revogar Dispositivo"
        description="Tem certeza que deseja revogar este dispositivo? Ele perderá o acesso ao sistema."
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        confirmLabel="Revogar"
        variant="destructive"
      />
    </div>
  );
}
