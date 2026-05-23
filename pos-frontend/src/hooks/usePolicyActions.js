import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  createStockPolicy as createStockPolicyApi,
  updateStockPolicy as updateStockPolicyApi,
  deleteStockPolicy as deleteStockPolicyApi,
} from "../https";

/**
 * Custom hook that wraps all StockPolicy CRUD mutations using React Query.
 *
 * Provides:
 *   createPolicy, updatePolicy, deletePolicy
 *
 * Each function returns a Promise from the mutation's mutateAsync.
 * After any successful mutation, relevant React Query caches are invalidated
 * (stockPolicies, stockHealth, alerts, recommendations, timeline).
 *
 * Double-click protection is inherent via mutation.isPending.
 */
const usePolicyActions = () => {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  // Shared invalidation after any policy mutation
  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["stockPolicies"] });
    queryClient.invalidateQueries({ queryKey: ["stockHealth"] });
    queryClient.invalidateQueries({ queryKey: ["alerts"] });
    queryClient.invalidateQueries({ queryKey: ["alerts-all"] });
    queryClient.invalidateQueries({ queryKey: ["networkRecommendations"] });
    queryClient.invalidateQueries({ queryKey: ["timeline"] });
  };

  // Create policy
  const createPolicyMutation = useMutation({
    mutationFn: (policyData) => createStockPolicyApi(policyData),
    onSuccess: (data) => {
      enqueueSnackbar(
        data?.data?.message || "Politica de estoque criada com sucesso!",
        { variant: "success" }
      );
      invalidateQueries();
    },
    onError: (error) => {
      const msg =
        error?.response?.data?.message || "Erro ao criar politica de estoque.";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  // Update policy
  const updatePolicyMutation = useMutation({
    mutationFn: ({ policyId, data }) =>
      updateStockPolicyApi(policyId, data),
    onSuccess: (data) => {
      enqueueSnackbar(
        data?.data?.message || "Politica de estoque atualizada com sucesso!",
        { variant: "success" }
      );
      invalidateQueries();
    },
    onError: (error) => {
      const msg =
        error?.response?.data?.message ||
        "Erro ao atualizar politica de estoque.";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  // Delete (deactivate) policy
  const deletePolicyMutation = useMutation({
    mutationFn: (policyId) => deleteStockPolicyApi(policyId),
    onSuccess: (data) => {
      enqueueSnackbar(
        data?.data?.message || "Politica de estoque desativada com sucesso!",
        { variant: "success" }
      );
      invalidateQueries();
    },
    onError: (error) => {
      const msg =
        error?.response?.data?.message ||
        "Erro ao desativar politica de estoque.";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  return {
    createPolicy: createPolicyMutation.mutateAsync,
    updatePolicy: updatePolicyMutation.mutateAsync,
    deletePolicy: deletePolicyMutation.mutateAsync,
    isLoading:
      createPolicyMutation.isPending ||
      updatePolicyMutation.isPending ||
      deletePolicyMutation.isPending,
  };
};

export default usePolicyActions;
