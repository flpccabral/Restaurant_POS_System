"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, Clock, CheckCircle, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { subscriptionService } from "@/services/api/subscription";

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: "Ativo", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  trialing: { label: "Teste", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  past_due: { label: "Pendente", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  cancelled: { label: "Cancelado", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  expired: { label: "Expirado", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
};

export default function SubscriptionPage() {
  const queryClient = useQueryClient();

  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: () => subscriptionService.getDetails("").then((r) => r.data.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ plan }: { plan: string }) => subscriptionService.updatePlan("", plan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      toast.success("Plano atualizado com sucesso");
    },
    onError: () => toast.error("Erro ao atualizar plano"),
  });

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      try {
        const r = await subscriptionService.getDetails("");
        return ((r.data as unknown as Record<string, unknown>).plans as unknown[]) || [];
      } catch {
        return [];
      }
    },
  });

  const sub = subscription as Record<string, unknown> | undefined;
  const plan = sub?.plan as Record<string, string> | undefined;
  const status = (sub?.status as string) || "active";
  const cfg = statusConfig[status] || statusConfig.active;
  const periodStart = sub?.currentPeriodStart as string;
  const periodEnd = sub?.currentPeriodEnd as string;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Assinatura</h1>
        <p className="text-zinc-400 text-sm mt-1">Visualize detalhes do plano e histórico de pagamento</p>
      </div>

      {/* Status Card */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-200 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-orange-500" />
            Plano Atual
          </CardTitle>
          <CardDescription>Informações da sua assinatura</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-bold text-white">{plan?.name || "Plano não identificado"}</p>
              <p className="text-sm text-zinc-400 mt-1">{plan?.description || ""}</p>
            </div>
            <Badge className={cfg.color}>{cfg.label}</Badge>
          </div>

          {(sub?.price as number) != null && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-zinc-400">Valor:</span>
              <span className="text-white font-medium">
                R$ {(Number(sub?.price) / 100).toFixed(2)}
                {(sub?.billingCycle as string) === "yearly" ? "/ano" : (sub?.billingCycle as string) === "quarterly" ? "/trimestre" : "/mês"}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {periodStart && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-zinc-500" />
                <span className="text-zinc-400">Início:</span>
                <span className="text-white">{new Date(periodStart).toLocaleDateString("pt-BR")}</span>
              </div>
            )}
            {periodEnd && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-zinc-500" />
                <span className="text-zinc-400">Renovação:</span>
                <span className="text-white">{new Date(periodEnd).toLocaleDateString("pt-BR")}</span>
              </div>
            )}
          </div>

          {/* Usage Limits */}
          {sub?.usage != null && (
            <div className="pt-4 border-t border-zinc-800">
              <p className="text-sm text-zinc-400 mb-2">Limites de Uso</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries((sub.usage as Record<string, number>) || {}).map(([key, value]) => (
                  <div key={key} className="bg-zinc-800 rounded-md p-3">
                    <p className="text-xs text-zinc-500 capitalize">{key}</p>
                    <p className="text-lg font-bold text-white">{Number(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plan Selection */}
          <div className="flex items-center gap-4 pt-4 border-t border-zinc-800">
            <Select onValueChange={(v) => { if (v && typeof v === "string") updateMutation.mutate({ plan: v }) }}>
              <SelectTrigger className="w-48 bg-zinc-800 border-zinc-700 text-white">
                <SelectValue placeholder="Trocar plano" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                {((plans || []) as Array<{ _id: string; name: string }>).map((p) => (
                  <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-zinc-500">
              {updateMutation.isPending ? "Atualizando..." : "Selecione um novo plano"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(["basic", "pro", "enterprise"] as const).map((tier) => (
          <Card key={tier} className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-200 capitalize">{tier}</CardTitle>
              <CardDescription>Plano {tier === "basic" ? "básico" : tier === "pro" ? "profissional" : "empresarial"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-zinc-400">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  {tier === "basic" ? "1 loja" : tier === "pro" ? "Até 5 lojas" : "Lojas ilimitadas"}
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  {tier === "basic" ? "3 usuários" : tier === "pro" ? "15 usuários" : "Usuários ilimitados"}
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  {tier === "enterprise" ? "Suporte prioritário" : "Suporte por e-mail"}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
