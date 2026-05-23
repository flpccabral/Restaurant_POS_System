"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { observabilityService } from "@/services/api/observability";
import { transferService } from "@/services/api/transfer";
import { toast } from "sonner";

/**
 * Hook that wraps all operational action mutations using React Query.
 *
 * Provides:
 *   resolveAlert, dismissAlert, executeCentralTransfer,
 *   executeInterStoreTransfer, registerPurchase
 *
 * Each function returns a Promise from the mutation's mutateAsync.
 * After any successful mutation, relevant React Query caches are invalidated.
 */
export function useOperationalActions() {
  const queryClient = useQueryClient();

  // Shared invalidation after any action
  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["stockHealth"] });
    queryClient.invalidateQueries({ queryKey: ["alerts"] });
    queryClient.invalidateQueries({ queryKey: ["networkRecommendations"] });
    queryClient.invalidateQueries({ queryKey: ["timeline"] });
    queryClient.invalidateQueries({ queryKey: ["console-overview"] });
  };

  // Resolve alert
  const resolveAlertMutation = useMutation({
    mutationFn: ({ alertId, notes }: { alertId: string; notes?: string }) =>
      observabilityService.resolveAlert(alertId, { notes }),
    onSuccess: () => {
      toast.success("Alerta resolvido com sucesso!");
      invalidateQueries();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao resolver alerta.");
    },
  });

  // Dismiss alert
  const dismissAlertMutation = useMutation({
    mutationFn: ({ alertId, reason }: { alertId: string; reason?: string }) =>
      observabilityService.dismissAlert(alertId, { reason }),
    onSuccess: () => {
      toast.success("Alerta ignorado com sucesso!");
      invalidateQueries();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao ignorar alerta.");
    },
  });

  // Central to store transfer
  const centralTransferMutation = useMutation({
    mutationFn: (data: {
      originLocationId: string;
      destinationLocationId: string;
      ingredientId: string;
      quantity: number;
      unit: string;
      reason?: string;
    }) => transferService.centralToStore(data),
    onSuccess: () => {
      toast.success("Transferencia concluida com sucesso!");
      invalidateQueries();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao executar transferencia.");
    },
  });

  // Inter-store transfer
  const interStoreTransferMutation = useMutation({
    mutationFn: (data: {
      originStoreId: string;
      destinationStoreId: string;
      originLocationId: string;
      destinationLocationId: string;
      ingredientId: string;
      quantity: number;
      unit: string;
      reason?: string;
    }) => transferService.interStoreTransfer(data),
    onSuccess: () => {
      toast.success("Transferencia entre lojas concluida!");
      invalidateQueries();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao executar transferencia entre lojas.");
    },
  });

  // Register purchase
  const registerPurchaseMutation = useMutation({
    mutationFn: (data: {
      ingredientId: string;
      ingredientName?: string;
      quantity: number;
      unit: string;
      notes?: string;
    }) => observabilityService.registerPurchase(data),
    onSuccess: () => {
      toast.success("Compra registrada com sucesso!");
      invalidateQueries();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao registrar compra.");
    },
  });

  return {
    resolveAlert: resolveAlertMutation.mutateAsync,
    dismissAlert: dismissAlertMutation.mutateAsync,
    executeCentralTransfer: centralTransferMutation.mutateAsync,
    executeInterStoreTransfer: interStoreTransferMutation.mutateAsync,
    registerPurchase: registerPurchaseMutation.mutateAsync,
    isLoading:
      resolveAlertMutation.isPending ||
      dismissAlertMutation.isPending ||
      centralTransferMutation.isPending ||
      interStoreTransferMutation.isPending ||
      registerPurchaseMutation.isPending,
  };
}
