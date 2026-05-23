import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  resolveAlert as resolveAlertApi,
  dismissAlert as dismissAlertApi,
  executeCentralTransfer as executeCentralTransferApi,
  executeInterStoreTransfer as executeInterStoreTransferApi,
  markPurchaseNeeded as markPurchaseNeededApi,
} from "../https";

/**
 * Custom hook that wraps all operational action mutations using React Query.
 *
 * Provides:
 *   resolveAlert, dismissAlert, executeCentralTransfer,
 *   executeInterStoreTransfer, markPurchaseNeeded
 *
 * Each function returns a Promise from the mutation's mutateAsync.
 * After any successful mutation, relevant React Query caches are invalidated
 * (stockHealth, alerts, recommendations, timeline).
 *
 * Double-click protection is inherent via mutation.isLoading.
 */
const useOperationalActions = () => {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  // Shared invalidation after any action
  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["stockHealth"] });
    queryClient.invalidateQueries({ queryKey: ["alerts"] });
    queryClient.invalidateQueries({ queryKey: ["alerts-all"] });
    queryClient.invalidateQueries({ queryKey: ["networkRecommendations"] });
    queryClient.invalidateQueries({ queryKey: ["timeline"] });
  };

  // Resolve alert
  const resolveAlertMutation = useMutation({
    mutationFn: ({ alertId, notes }) => resolveAlertApi(alertId, { notes }),
    onSuccess: (data) => {
      enqueueSnackbar(data?.data?.message || "Alerta resolvido com sucesso!", {
        variant: "success",
      });
      invalidateQueries();
    },
    onError: (error) => {
      const msg =
        error?.response?.data?.message || "Erro ao resolver alerta.";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  // Dismiss alert
  const dismissAlertMutation = useMutation({
    mutationFn: ({ alertId, reason }) =>
      dismissAlertApi(alertId, { reason }),
    onSuccess: (data) => {
      enqueueSnackbar(data?.data?.message || "Alerta ignorado com sucesso!", {
        variant: "success",
      });
      invalidateQueries();
    },
    onError: (error) => {
      const msg =
        error?.response?.data?.message || "Erro ao ignorar alerta.";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  // Central to store transfer
  const centralTransferMutation = useMutation({
    mutationFn: (transferData) => executeCentralTransferApi(transferData),
    onSuccess: (data) => {
      enqueueSnackbar(
        data?.data?.message || "Transferencia concluida com sucesso!",
        { variant: "success" }
      );
      invalidateQueries();
    },
    onError: (error) => {
      const msg =
        error?.response?.data?.message || "Erro ao executar transferencia.";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  // Inter-store transfer
  const interStoreTransferMutation = useMutation({
    mutationFn: (transferData) =>
      executeInterStoreTransferApi(transferData),
    onSuccess: (data) => {
      enqueueSnackbar(
        data?.data?.message || "Transferencia entre lojas concluida!",
        { variant: "success" }
      );
      invalidateQueries();
    },
    onError: (error) => {
      const msg =
        error?.response?.data?.message ||
        "Erro ao executar transferencia entre lojas.";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  // Purchase registration
  const purchaseNeededMutation = useMutation({
    mutationFn: (purchaseData) => markPurchaseNeededApi(purchaseData),
    onSuccess: (data) => {
      enqueueSnackbar(
        data?.data?.message || "Compra registrada com sucesso!",
        { variant: "success" }
      );
      invalidateQueries();
    },
    onError: (error) => {
      const msg =
        error?.response?.data?.message || "Erro ao registrar compra.";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  return {
    resolveAlert: resolveAlertMutation.mutateAsync,
    dismissAlert: dismissAlertMutation.mutateAsync,
    executeCentralTransfer: centralTransferMutation.mutateAsync,
    executeInterStoreTransfer: interStoreTransferMutation.mutateAsync,
    markPurchaseNeeded: purchaseNeededMutation.mutateAsync,
    isLoading:
      resolveAlertMutation.isPending ||
      dismissAlertMutation.isPending ||
      centralTransferMutation.isPending ||
      interStoreTransferMutation.isPending ||
      purchaseNeededMutation.isPending,
  };
};

export default useOperationalActions;
