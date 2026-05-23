"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, XCircle, TrendingUp, DollarSign, Receipt } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { pdvService } from "@/services/api/pdv";

export default function PDVPage() {
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState<"open" | "close" | null>(null);
  const [form, setForm] = useState({ amount: "" });

  const { data: activeSession } = useQuery({
    queryKey: ["pdv-active-session"],
    queryFn: () => pdvService.getActiveSession().then((r) => r.data.data).catch(() => null),
  });

  const { data: history, isLoading } = useQuery({
    queryKey: ["pdv-history"],
    queryFn: () => pdvService.getHistory().then((r) => r.data.data),
  });

  const { data: summary } = useQuery({
    queryKey: ["pdv-summary"],
    queryFn: () => pdvService.getSummary().then((r) => r.data.data).catch(() => null),
  });

  const openMutation = useMutation({
    mutationFn: (data: { openingBalance: number }) => pdvService.openSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pdv-active-session", "pdv-history"] });
      toast.success("Sessão de caixa aberta");
      setOpenDialog(null);
      setForm({ amount: "" });
    },
    onError: () => toast.error("Erro ao abrir sessão"),
  });

  const closeMutation = useMutation({
    mutationFn: (data: { closingBalance: number }) => pdvService.closeSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pdv-active-session", "pdv-history"] });
      toast.success("Sessão de caixa fechada");
      setOpenDialog(null);
      setForm({ amount: "" });
    },
    onError: () => toast.error("Erro ao fechar sessão"),
  });

  const columns = [
    {
      key: "openedAt",
      header: "Abertura",
      cell: (row: unknown) => new Date((row as Record<string, string>).openedAt).toLocaleString("pt-BR"),
    },
    {
      key: "closedAt",
      header: "Fechamento",
      cell: (row: unknown) => {
        const d = (row as Record<string, string>).closedAt;
        return d ? new Date(d).toLocaleString("pt-BR") : "Aberta";
      },
    },
    {
      key: "openingBalance",
      header: "Abertura",
      cell: (row: unknown) => `R$ ${Number((row as Record<string, number>).openingBalance).toFixed(2)}`,
    },
    {
      key: "closingBalance",
      header: "Fechamento",
      cell: (row: unknown) => {
        const v = (row as Record<string, number>).closingBalance;
        return v != null ? `R$ ${v.toFixed(2)}` : "—";
      },
    },
    {
      key: "status",
      header: "Status",
      cell: (row: unknown) => (
        <StatusBadge
          status={(row as Record<string, string>).status === "open" ? "active" : "inactive"}
          label={(row as Record<string, string>).status === "open" ? "Aberta" : "Fechada"}
        />
      ),
    },
  ];

  const session = activeSession as Record<string, unknown> | undefined;
  const summ = summary as Record<string, unknown> | undefined;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">PDV / Caixa</h1>
          <p className="text-zinc-400 text-sm mt-1">Gerencie sessões de caixa e fechamentos</p>
        </div>
        {!session && (
          <Button onClick={() => { setOpenDialog("open"); setForm({ amount: "0" }); }} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-2" />
            Abrir Caixa
          </Button>
        )}
        {session && (
          <Button onClick={() => { setOpenDialog("close"); setForm({ amount: "0" }); }} variant="destructive">
            <XCircle className="h-4 w-4 mr-2" />
            Fechar Caixa
          </Button>
        )}
      </div>

      {/* Active Session Info */}
      {session && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-200 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              Sessão Ativa
            </CardTitle>
            <CardDescription>Caixa aberto desde {new Date(session.openedAt as string).toLocaleString("pt-BR")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-zinc-400">Saldo de Abertura</p>
                <p className="text-xl font-bold text-white">R$ {Number(session.openingBalance).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-zinc-400">Aberto por</p>
                <p className="text-xl font-bold text-white">{(session.openedBy as Record<string, string>)?.name || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-zinc-400">Status</p>
                <StatusBadge status="active" label="Aberta" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {summ && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle className="text-zinc-200 text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-500" />Total Vendas</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-white">R$ {Number(summ.totalSales || 0).toFixed(2)}</p></CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle className="text-zinc-200 text-sm flex items-center gap-2"><Receipt className="h-4 w-4 text-brand" />Qtd. Pagamentos</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-white">{Number(summ.paymentCount) || 0}</p></CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle className="text-zinc-200 text-sm">Ticket Médio</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-white">R$ {Number(summ.avgTicket || 0).toFixed(2)}</p></CardContent>
          </Card>
        </div>
      )}

      {/* History */}
      <DataTable
        columns={columns}
        data={history || []}
        loading={isLoading}
        searchKey="status"
        searchPlaceholder="Pesquisar sessões..."
        emptyMessage="Nenhuma sessão de caixa encontrada."
      />

      {/* Open Dialog */}
      <Dialog open={openDialog === "open"} onOpenChange={() => setOpenDialog(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Abrir Caixa</DialogTitle>
            <DialogDescription className="text-zinc-400">Informe o saldo de abertura</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Saldo de Abertura (R$)</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ amount: e.target.value })} className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>Cancelar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => openMutation.mutate({ openingBalance: parseFloat(form.amount) || 0 })}>
              Abrir Caixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Dialog */}
      <Dialog open={openDialog === "close"} onOpenChange={() => setOpenDialog(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Fechar Caixa</DialogTitle>
            <DialogDescription className="text-zinc-400">Informe o saldo de fechamento</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Saldo de Fechamento (R$)</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ amount: e.target.value })} className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => closeMutation.mutate({ closingBalance: parseFloat(form.amount) || 0 })}>
              Fechar Caixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
