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
  active: { label: "Ativo", color: "bg-success/10 text-success border-success/20" },
  trialing: { label: "Teste", color: "bg-info/10 text-info border-info/20" },
  past_due: { label: "Pendente", color: "bg-warning/10 text-warning border-warning/20" },
  cancelled: { label: "Cancelado", color: "bg-critical/10 text-critical border-critical/20" },
  expired: { label: "Expirado", color: "bg-muted text-muted-foreground border-border" },
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
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Assinatura</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Visualize detalhes do plano e historico de pagamento</p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <CreditCard className="h-5 w-5 text-brand" />
            Plano Atual
          </CardTitle>
          <CardDescription>Informacoes da sua assinatura</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-bold text-foreground">{plan?.name || "Plano nao identificado"}</p>
              <p className="text-sm text-muted-foreground mt-1">{plan?.description || ""}</p>
            </div>
            <Badge className={cfg.color}>{cfg.label}</Badge>
          </div>

          {(sub?.price as number) != null && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Valor:</span>
              <span className="text-foreground font-medium">
                R$ {(Number(sub?.price) / 100).toFixed(2)}
                {(sub?.billingCycle as string) === "yearly" ? "/ano" : (sub?.billingCycle as string) === "quarterly" ? "/trimestre" : "/mes"}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {periodStart && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Inicio:</span>
                <span className="text-foreground">{new Date(periodStart).toLocaleDateString("pt-BR")}</span>
              </div>
            )}
            {periodEnd && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Renovacao:</span>
                <span className="text-foreground">{new Date(periodEnd).toLocaleDateString("pt-BR")}</span>
              </div>
            )}
          </div>

          {/* Usage Limits */}
          {sub?.usage != null && (
            <div className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground mb-2">Limites de Uso</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries((sub.usage as Record<string, number>) || {}).map(([key, value]) => (
                  <div key={key} className="bg-muted rounded-lg p-3">
                    <p className="text-xs text-muted-foreground capitalize">{key}</p>
                    <p className="text-lg font-bold text-foreground">{Number(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plan Selection */}
          <div className="flex items-center gap-4 pt-4 border-t border-border">
            <Select onValueChange={(v) => { if (v && typeof v === "string") updateMutation.mutate({ plan: v }) }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Trocar plano" />
              </SelectTrigger>
              <SelectContent>
                {((plans || []) as Array<{ _id: string; name: string }>).map((p) => (
                  <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {updateMutation.isPending ? "Atualizando..." : "Selecione um novo plano"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(["basic", "pro", "enterprise"] as const).map((tier) => (
          <Card key={tier}>
            <CardHeader>
              <CardTitle className="capitalize">{tier}</CardTitle>
              <CardDescription>Plano {tier === "basic" ? "basico" : tier === "pro" ? "profissional" : "empresarial"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-success shrink-0" />
                  {tier === "basic" ? "1 loja" : tier === "pro" ? "Ate 5 lojas" : "Lojas ilimitadas"}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-success shrink-0" />
                  {tier === "basic" ? "3 usuarios" : tier === "pro" ? "15 usuarios" : "Usuarios ilimitados"}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-success shrink-0" />
                  {tier === "enterprise" ? "Suporte prioritario" : "Suporte por e-mail"}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
