"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, CheckCircle, XCircle, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { kdsService } from "@/services/api/kds";

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pendente", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  preparing: { label: "Preparando", color: "text-brand", bg: "bg-brand-muted border-brand/20" },
  partially_ready: { label: "Parcialmente Pronto", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  ready: { label: "Pronto", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  served: { label: "Entregue", color: "text-zinc-400", bg: "bg-zinc-500/10 border-zinc-500/20" },
  cancelled: { label: "Cancelado", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
};

export default function KDSPage() {
  const queryClient = useQueryClient();

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["kds-tickets"],
    queryFn: () => kdsService.getTickets().then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  const { data: stats } = useQuery({
    queryKey: ["kds-stats"],
    queryFn: () => kdsService.getStationStats().then((r) => r.data.data).catch(() => null),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => kdsService.acceptOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kds-tickets"] });
      toast.success("Pedido aceito");
    },
    onError: () => toast.error("Erro ao aceitar pedido"),
  });

  const readyMutation = useMutation({
    mutationFn: (id: string) => kdsService.markReady(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kds-tickets"] });
      toast.success("Pedido marcado como pronto");
    },
    onError: () => toast.error("Erro ao marcar como pronto"),
  });

  const servedMutation = useMutation({
    mutationFn: (id: string) => kdsService.markServed(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kds-tickets"] });
      toast.success("Pedido entregue");
    },
    onError: () => toast.error("Erro ao marcar como entregue"),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => kdsService.cancelOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kds-tickets"] });
      toast.success("Pedido cancelado");
    },
    onError: () => toast.error("Erro ao cancelar pedido"),
  });

  const ticketsList = ((tickets || []) as unknown as Record<string, unknown>[]);
  const activeTickets = ticketsList.filter((t) => !["served", "cancelled"].includes(t.status as string));
  const completedTickets = ticketsList.filter((t) => ["served", "cancelled"].includes(t.status as string));

  const elapsed = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    return mins < 60 ? `${mins}min` : `${Math.floor(mins / 60)}h ${mins % 60}min`;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-zinc-400">Carregando pedidos...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cozinha (KDS)</h1>
          <p className="text-zinc-400 text-sm mt-1">Gestão de pedidos em tempo real para a cozinha</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle className="text-zinc-200 text-sm">Pendentes</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-500">{activeTickets.filter((t) => t.status === "pending" || t.status === "accepted").length}</p></CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle className="text-zinc-200 text-sm">Preparando</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-brand">{activeTickets.filter((t) => t.status === "preparing").length}</p></CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle className="text-zinc-200 text-sm">Prontos</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-emerald-500">{activeTickets.filter((t) => t.status === "ready").length}</p></CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle className="text-zinc-200 text-sm">Total Hoje</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-white">{ticketsList.length}</p></CardContent>
        </Card>
      </div>

      {/* Active Tickets */}
      {activeTickets.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-brand" />
            Pedidos Ativos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTickets.map((ticket) => {
              const items = (ticket.items as Record<string, unknown>[]) || [];
              const status = ticket.status as string;
              const cfg = statusConfig[status] || statusConfig.pending;

              return (
                <Card key={ticket._id as string} className={`bg-zinc-900 border ${cfg.bg}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-zinc-200 text-sm">
                        {String(ticket.orderNumber || '#' + String(ticket.kdsOrderId || ticket._id).slice(-6))}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-zinc-500" />
                        <span className={`text-xs ${cfg.color}`}>{elapsed(ticket.createdAt as string)}</span>
                      </div>
                    </div>
                    <CardDescription>
                      <Badge className={`${cfg.bg} ${cfg.color} text-xs`}>{cfg.label}</Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Fase 9.3C: Show order observations/metadata */}
                    {(() => {
                      const meta = ticket.metadata as Record<string, string> | null | undefined;
                      const notes = meta?.notes;
                      return notes ? (
                        <p className="text-xs text-yellow-400 italic">
                          Obs pedido: {String(notes)}
                        </p>
                      ) : null;
                    })()}
                    <div className="space-y-1">
                      {items.map((item, i) => {
                        const it = item as Record<string, unknown>;
                        const itemNotes = it.notes as string;
                        return (
                        <div key={i} className="flex flex-col">
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-300">{String(it.quantity)}x {String(it.productName || it.name)}</span>
                            <span className="text-zinc-500 text-xs">{String(it.status)}</span>
                          </div>
                          {/* Fase 9.3C: Item notes */}
                          {itemNotes && (
                            <p className="text-xs text-yellow-400/70 italic mt-0.5">
                              Obs: {itemNotes}
                            </p>
                          )}
                        </div>
                        );
                      })}
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-zinc-800">
                      {status === "pending" && (
                        <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => acceptMutation.mutate(ticket.kdsOrderId as string)}>
                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Aceitar
                        </Button>
                      )}
                      {(status === "preparing" || status === "partially_ready") && (
                        <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => readyMutation.mutate(ticket.kdsOrderId as string)}>
                          <ChefHat className="h-3.5 w-3.5 mr-1" /> Pronto
                        </Button>
                      )}
                      {status === "ready" && (
                        <Button size="sm" className="flex-1 bg-brand hover:bg-brand-muted text-brand-foreground" onClick={() => servedMutation.mutate(ticket.kdsOrderId as string)}>
                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Entregue
                        </Button>
                      )}
                      {status === "pending" && (
                        <Button size="sm" variant="destructive" onClick={() => cancelMutation.mutate(ticket.kdsOrderId as string)}>
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed Tickets */}
      {completedTickets.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Concluídos / Cancelados</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedTickets.map((ticket) => {
              const items = (ticket.items as Record<string, unknown>[]) || [];
              const status = ticket.status as string;
              const cfg = statusConfig[status] || statusConfig.served;

              return (
                <Card key={ticket._id as string} className="bg-zinc-900 border-zinc-800 opacity-60">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-zinc-400 text-sm">
                        {String(ticket.orderNumber || '#' + String(ticket.kdsOrderId || ticket._id).slice(-6))}
                      </CardTitle>
                      <Badge className={`${cfg.bg} ${cfg.color} text-xs`}>{cfg.label}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {items.map((item, i) => {
                        const it = item as Record<string, unknown>;
                        return (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-zinc-500">{String(it.quantity)}x {String(it.productName || it.name)}</span>
                        </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {ticketsList.length === 0 && (
        <div className="text-center py-16">
          <ChefHat className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-500">Nenhum pedido na cozinha</p>
          <p className="text-zinc-600 text-sm">Os pedidos aparecerão aqui quando forem enviados pelo PDV</p>
        </div>
      )}
    </div>
  );
}
