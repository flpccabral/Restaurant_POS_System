"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, Smartphone, Receipt, Wallet, Check, AlertCircle, Store, Save, RotateCcw, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { storesService } from "@/services/api/stores";
import { useStoreContext } from "@/contexts/StoreContext";
import { useCapabilities } from "@/hooks/useCapabilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import type { PaymentProcessingSettings } from "@/types";

const PAYMENT_METHODS = [
  { value: "cash", label: "Dinheiro", icon: Wallet },
  { value: "credit_card", label: "Crédito", icon: CreditCard },
  { value: "debit_card", label: "Débito", icon: CreditCard },
  { value: "pix", label: "Pix", icon: Smartphone },
  { value: "voucher", label: "Voucher", icon: Receipt },
] as const;

const DEFAULT_SETTINGS: PaymentProcessingSettings = {
  paymentMode: "gateway",
  gatewayProvider: "mercadopago",
  requireOfflineDocument: true,
  allowedMethods: ["cash", "credit_card", "debit_card", "pix", "voucher"],
};

export default function SettingsPage() {
  const { storeId, isLoading: storeCtxLoading } = useStoreContext();
  const { can, isLoading: authLoading } = useCapabilities();
  const queryClient = useQueryClient();

  const canManageSettings = can("settings", "update");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["store-current", storeId],
    queryFn: () => storesService.getCurrent().then((r) => r.data.data),
    enabled: !!storeId && canManageSettings,
  });

  const current = data?.settings?.paymentProcessing ?? DEFAULT_SETTINGS;

  // Estado local modelado como overrides (draft) em cima dos dados do servidor.
  // Isso evita setState síncrono em useEffect e mantém o formulário sempre
  // sincronizado com GET /store/current, mesmo quando a query demora a retornar.
  const [draft, setDraft] = useState<Partial<PaymentProcessingSettings>>({});

  const form = useMemo<PaymentProcessingSettings>(
    () => ({
      ...current,
      ...draft,
      allowedMethods:
        draft.allowedMethods ?? current.allowedMethods ?? DEFAULT_SETTINGS.allowedMethods ?? [],
    }),
    [current, draft]
  );

  const isDirty = useMemo(() => {
    const keys = Object.keys(draft) as Array<keyof PaymentProcessingSettings>;
    if (keys.length === 0) return false;

    return keys.some((key) => {
      if (key === "allowedMethods") {
        const a = draft.allowedMethods ?? current.allowedMethods ?? DEFAULT_SETTINGS.allowedMethods ?? [];
        const b = current.allowedMethods ?? DEFAULT_SETTINGS.allowedMethods ?? [];
        const normalize = (arr: string[]) => [...arr].sort();
        return JSON.stringify(normalize(a)) !== JSON.stringify(normalize(b));
      }
      return draft[key] !== current[key];
    });
  }, [draft, current]);

  const resetForm = () => setDraft({});

  const mutation = useMutation({
    mutationFn: (payload: PaymentProcessingSettings) =>
      storesService.updatePaymentProcessing(payload),
    onSuccess: () => {
      toast.success("Configuração de pagamento atualizada");
      setDraft({});
      queryClient.invalidateQueries({ queryKey: ["store-current", storeId] });
    },
    onError: (err: unknown) => {
      const msg =
        (err instanceof Error ? err.message : null) ||
        (err && typeof err === "object" && "response" in err
          ? ((err.response as { data?: { message?: string } })?.data?.message ?? null)
          : null) ||
        "Erro ao atualizar configuração";
      toast.error(msg);
    },
  });

  const handleModeChange = (mode: "gateway" | "offline_pos") => {
    setDraft((prev) => ({
      ...prev,
      paymentMode: mode,
      gatewayProvider: mode === "gateway" ? "mercadopago" : "none",
    }));
  };

  const toggleMethod = (method: string) => {
    setDraft((prev) => {
      const allowed = prev.allowedMethods ?? current.allowedMethods ?? DEFAULT_SETTINGS.allowedMethods ?? [];
      const next = allowed.includes(method)
        ? allowed.filter((m) => m !== method)
        : [...allowed, method];
      return { ...prev, allowedMethods: next };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  if (authLoading || storeCtxLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!canManageSettings) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState
          variant="alert"
          title="Sem permissão"
          description="Você não tem permissão para gerenciar configurações. Contate o administrador."
        />
      </div>
    );
  }

  if (!storeId) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState
          variant="empty"
          title="Selecione uma loja"
          description="Selecione uma loja para gerenciar as configurações de pagamento."
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Configurações</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ajustes administrativos do sistema
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Store className="h-3.5 w-3.5" />
          <span className="truncate max-w-[200px] sm:max-w-xs" title={data?.name}>{data?.name || "Loja selecionada"}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Main configuration column */}
        <div className="xl:col-span-2 space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-brand-muted shrink-0">
                  <CreditCard className="h-5 w-5 text-brand" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-lg">Processamento de Pagamentos</CardTitle>
                  <CardDescription className="text-sm">
                    Defina se os pagamentos digitais são processados pelo sistema ou por maquininha externa.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {isError ? (
                <EmptyState
                  variant="alert"
                  title="Falha ao carregar configuração"
                  description="Verifique se o servidor backend está rodando e tente novamente."
                  actionLabel="Tentar novamente"
                  onAction={refetch}
                />
              ) : (
                <>
                  {/* Mode selection */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Modo de pagamento digital</Label>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handleModeChange("gateway")}
                        disabled={isLoading}
                        className={`relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all ${
                          form.paymentMode === "gateway"
                            ? "border-brand bg-brand-muted/60 ring-1 ring-brand/30"
                            : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-muted shrink-0">
                            <Smartphone className="h-4 w-4 text-brand" />
                          </div>
                          <span className="font-semibold text-sm">Gateway Mercado Pago</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Pix e cartões são processados dentro do sistema. Dinheiro continua registrado no caixa.
                        </p>
                        {form.paymentMode === "gateway" && (
                          <Badge variant="secondary" className="absolute top-3 right-3 gap-1">
                            <Check className="h-3 w-3" />
                            Ativo
                          </Badge>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleModeChange("offline_pos")}
                        disabled={isLoading}
                        className={`relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all ${
                          form.paymentMode === "offline_pos"
                            ? "border-warning bg-warning/10 ring-1 ring-warning/40"
                            : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-warning/10 shrink-0">
                            <CreditCard className="h-4 w-4 text-warning" />
                          </div>
                          <span className="font-semibold text-sm">Offline / Maquininha externa</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Pagamento ocorre fora do sistema. Exija NSU/TXID/documento POS quando configurado.
                        </p>
                        {form.paymentMode === "offline_pos" && (
                          <Badge className="absolute top-3 right-3 gap-1 bg-warning text-warning-foreground hover:bg-warning">
                            <Check className="h-3 w-3" />
                            Ativo
                          </Badge>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Offline document toggle */}
                  {form.paymentMode === "offline_pos" && (
                    <div className="flex items-start gap-3 rounded-xl bg-muted/60 border border-border/60 p-4">
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          id="requireOfflineDocument"
                          type="checkbox"
                          checked={form.requireOfflineDocument}
                          onChange={(e) => {
                            setDraft((p) => ({ ...p, requireOfflineDocument: e.target.checked }));
                          }}
                          disabled={isLoading}
                          className="peer sr-only"
                        />
                        <span
                          className={cn(
                            "block w-10 h-6 rounded-full transition-colors",
                            form.requireOfflineDocument ? "bg-brand" : "bg-muted-foreground/25"
                          )}
                        />
                        <span
                          className={cn(
                            "absolute top-1 left-1 block w-4 h-4 rounded-full bg-white transition-transform shadow-sm",
                            form.requireOfflineDocument ? "translate-x-4" : "translate-x-0"
                          )}
                        />
                      </label>
                      <div className="space-y-1 min-w-0">
                        <Label htmlFor="requireOfflineDocument" className="cursor-pointer text-sm font-medium">
                          Exigir número do documento/comprovante POS
                        </Label>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Obriga o operador a informar o comprovante ao registrar pagamentos offline. Reduz erros de conciliação.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Allowed methods */}
                  {form.paymentMode === "offline_pos" && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Métodos habilitados no PDV</Label>
                      <div className="flex flex-wrap gap-2">
                        {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => {
                          const active = (form.allowedMethods || []).includes(value);
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => toggleMethod(value)}
                              disabled={isLoading}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                                active
                                  ? "border-brand bg-brand-muted text-brand-foreground"
                                  : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/40"
                              }`}
                            >
                              <Icon className={cn("h-3.5 w-3.5", active ? "text-brand" : "text-muted-foreground")} />
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {isLoading && !isDirty && (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  )}
                </>
              )}
            </CardContent>

            {!isError && (
              <CardFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-t bg-muted/50 px-4 sm:px-6 py-4 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={isLoading || !isDirty}
                  className="gap-1.5"
                >
                  <RotateCcw className="h-4 w-4" />
                  Restaurar
                </Button>
                <Button
                  type="submit"
                  disabled={mutation.isPending || isLoading || !isDirty}
                  className="gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  {mutation.isPending ? "Salvando..." : "Salvar configuração"}
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>

        {/* Operational impact sidebar */}
        <div className="space-y-4">
          <Card className="border-border/60 bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand" />
                Impacto operacional
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground">Caixa / PDV</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {form.paymentMode === "gateway"
                    ? "Recebimentos digitais registram fechamento automaticamente no caixa. Dinheiro continua em espécie."
                    : "Recebimentos digitais não alteram o caixa físico. O valor é lançado apenas como comprovante POS/Pix."}
                </p>
              </div>
              <div className="h-px bg-border" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground">Conciliação</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {form.paymentMode === "gateway"
                    ? "Conciliação automática via gateway. Menos trabalho manual no fechamento."
                    : "Requer comprovante/documento para cada pagamento digital. Mais controle, mais passos no PDV."}
                </p>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-3">
                <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-warning-foreground leading-relaxed">
                  Alterar o modo de pagamento afeta diretamente o fluxo do atendente no PDV. Salve para aplicar.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
