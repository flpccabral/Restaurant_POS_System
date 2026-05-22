"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownCircle, ArrowUpCircle, AlertTriangle } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { inventoryService } from "@/services/api/inventory";

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [stockInOpen, setStockInOpen] = useState(false);
  const [stockOutOpen, setStockOutOpen] = useState(false);
  const [stockForm, setStockForm] = useState({ ingredientId: "", quantity: "", reason: "" });

  const { data: balance, isLoading } = useQuery({
    queryKey: ["stock-balance"],
    queryFn: () => inventoryService.getBalance().then((r) => r.data.data),
  });

  const { data: alerts } = useQuery({
    queryKey: ["stock-alerts"],
    queryFn: () => inventoryService.getAlerts().then((r) => r.data.data),
  });

  const stockInMutation = useMutation({
    mutationFn: (data: { ingredientId: string; quantity: number; unitCost?: number; notes?: string }) =>
      inventoryService.stockIn(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-balance"] });
      toast.success("Entrada de estoque registrada");
      setStockInOpen(false);
      setStockForm({ ingredientId: "", quantity: "", reason: "" });
    },
    onError: () => toast.error("Erro ao registrar entrada"),
  });

  const stockOutMutation = useMutation({
    mutationFn: (data: { ingredientId: string; quantity: number; reason: string }) =>
      inventoryService.stockOut(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-balance"] });
      toast.success("Saída de estoque registrada");
      setStockOutOpen(false);
      setStockForm({ ingredientId: "", quantity: "", reason: "" });
    },
    onError: () => toast.error("Erro ao registrar saída"),
  });

  const columns = [
    {
      key: "ingredient",
      header: "Ingrediente",
      cell: (row: unknown) => {
        const ing = (row as Record<string, unknown>).ingredient as { name: string; unit: string } | undefined;
        return ing?.name || "—";
      },
    },
    {
      key: "balance",
      header: "Saldo Atual",
      cell: (row: unknown) => {
        const d = row as Record<string, unknown>;
        return `${d.balance} ${d.unit || ""}`;
      },
    },
    { key: "reserved", header: "Reservado" },
    {
      key: "available",
      header: "Disponível",
      cell: (row: unknown) => {
        const d = row as Record<string, unknown>;
        return `${d.available ?? (Number(d.balance) - Number(d.reserved))}`;
      },
    },
    { key: "minimumStock", header: "Mínimo" },
    {
      key: "lastPurchasePrice",
      header: "Últ. Preço",
      cell: (row: unknown) => {
        const p = (row as Record<string, unknown>).lastPurchasePrice;
        return p ? `R$ ${Number(p).toFixed(2)}` : "—";
      },
    },
    {
      key: "alert",
      header: "Alerta",
      cell: (row: unknown) => {
        const d = row as Record<string, unknown>;
        const isLow = Number(d.balance) <= Number(d.minimumStock);
        return isLow ? <StatusBadge status="low" label="Baixo" /> : <StatusBadge status="active" label="OK" />;
      },
    },
  ];

  const balanceData = balance as Record<string, unknown> | undefined;
  const stockItems = Array.isArray(balanceData?.items) ? balanceData.items as unknown[] : [];
  const totalValue = (balanceData?.totalValue as number) || 0;
  const alertCount = (alerts as unknown[])?.length || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Estoque</h1>
          <p className="text-zinc-400 text-sm mt-1">Gerencie níveis de estoque, entradas e saídas</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setStockInOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <ArrowDownCircle className="h-4 w-4 mr-2" />
            Entrada
          </Button>
          <Button onClick={() => setStockOutOpen(true)} variant="destructive">
            <ArrowUpCircle className="h-4 w-4 mr-2" />
            Saída
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle className="text-zinc-200 text-sm">Valor em Estoque</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-white">R$ {Number(totalValue).toFixed(2)}</p></CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle className="text-zinc-200 text-sm">Itens Cadastrados</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-white">{stockItems.length}</p></CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-200 text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-500">{alertCount}</p></CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={stockItems}
        loading={isLoading}
        searchKey="ingredient"
        searchPlaceholder="Pesquisar no estoque..."
        emptyMessage="Nenhum item em estoque."
        onSearchField={(row: unknown, term: string) => {
          const ing = (row as Record<string, unknown>).ingredient as { name?: string } | undefined;
          return ing?.name?.toLowerCase().includes(term.toLowerCase()) ?? false;
        }}
      />

      {/* Stock In Dialog */}
      <Dialog open={stockInOpen} onOpenChange={setStockInOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Entrada de Estoque</DialogTitle>
            <DialogDescription className="text-zinc-400">Registrar entrada de mercadoria</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Ingrediente (ID)</Label>
              <Input value={stockForm.ingredientId} onChange={(e) => setStockForm((p) => ({ ...p, ingredientId: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" placeholder="ID do ingrediente" />
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input type="number" value={stockForm.quantity} onChange={(e) => setStockForm((p) => ({ ...p, quantity: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div>
              <Label>Observação</Label>
              <Input value={stockForm.reason} onChange={(e) => setStockForm((p) => ({ ...p, reason: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" placeholder="Motivo da entrada" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockInOpen(false)}>Cancelar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={!stockForm.ingredientId || !stockForm.quantity} onClick={() => stockInMutation.mutate({ ingredientId: stockForm.ingredientId, quantity: parseFloat(stockForm.quantity), notes: stockForm.reason })}>
              Registrar Entrada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Out Dialog */}
      <Dialog open={stockOutOpen} onOpenChange={setStockOutOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Saída de Estoque</DialogTitle>
            <DialogDescription className="text-zinc-400">Registrar saída de mercadoria</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Ingrediente (ID)</Label>
              <Input value={stockForm.ingredientId} onChange={(e) => setStockForm((p) => ({ ...p, ingredientId: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" placeholder="ID do ingrediente" />
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input type="number" value={stockForm.quantity} onChange={(e) => setStockForm((p) => ({ ...p, quantity: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div>
              <Label>Motivo</Label>
              <Select value={stockForm.reason || ""} onValueChange={(v) => setStockForm((p) => ({ ...p, reason: v || "" }))}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectItem value="uso">Uso em produção</SelectItem>
                  <SelectItem value="desperdicio">Desperdício</SelectItem>
                  <SelectItem value="devolucao">Devolução</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockOutOpen(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={!stockForm.ingredientId || !stockForm.quantity || !stockForm.reason} onClick={() => stockOutMutation.mutate({ ingredientId: stockForm.ingredientId, quantity: parseFloat(stockForm.quantity), reason: stockForm.reason })}>
              Registrar Saída
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
