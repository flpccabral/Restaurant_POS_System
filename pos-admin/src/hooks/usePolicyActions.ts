"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { stockPoliciesService } from "@/services/api/stock-policies";
import { toast } from "sonner";

/**
 * Hook that wraps all StockPolicy CRUD mutations using React Query.
 *
 * Provides:
 *   createPolicy, updatePolicy, deletePolicy
 *
 * Each function returns a Promise from the mutation's mutateAsync.
 * After any successful mutation, relevant caches are invalidated.
 */
export function usePolicyActions() {
  const queryClient = useQueryClient();

  // Shared invalidation after any policy mutation
  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["stockPolicies"] });
    queryClient.invalidateQueries({ queryKey: ["stockHealth"] });
    queryClient.invalidateQueries({ queryKey: ["alerts"] });
    queryClient.invalidateQueries({ queryKey: ["networkRecommendations"] });
    queryClient.invalidateQueries({ queryKey: ["timeline"] });
    queryClient.invalidateQueries({ queryKey: ["console-overview"] });
  };

  // Create policy
  const createPolicyMutation = useMutation({
    mutationFn: (data: {
      storeId: string;
      locationId: string;
      ingredientId: string;
      minQuantity: number;
      reorderPoint: number;
      idealQuantity: number;
      maxQuantity: number;
      unit: string;
      priority: "high" | "medium" | "low";
      isActive: boolean;
    }) => stockPoliciesService.create(data),
    onSuccess: () => {
      toast.success("Politica de estoque criada com sucesso!");
      invalidateQueries();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao criar politica de estoque.");
    },
  });

  // Update policy
  const updatePolicyMutation = useMutation({
    mutationFn: ({
      policyId,
      data,
    }: {
      policyId: string;
      data: Parameters<typeof stockPoliciesService.update>[1];
    }) => stockPoliciesService.update(policyId, data),
    onSuccess: () => {
      toast.success("Politica de estoque atualizada com sucesso!");
      invalidateQueries();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao atualizar politica de estoque.");
    },
  });

  // Delete (deactivate) policy
  const deletePolicyMutation = useMutation({
    mutationFn: (policyId: string) => stockPoliciesService.delete(policyId),
    onSuccess: () => {
      toast.success("Politica de estoque desativada com sucesso!");
      invalidateQueries();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao desativar politica de estoque.");
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
}
