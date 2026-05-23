import { api } from "@/lib/api";
import type { ApiResponse } from "./types";
import type { StockPolicy } from "@/types";

/**
 * Stock Policy API service.
 *
 * Consumes backend endpoints mounted at `/api/stock-policies`.
 */
export const stockPoliciesService = {
  /** List all stock policies with optional filters */
  list: (params?: { limit?: number; isActive?: boolean; storeId?: string; ingredientId?: string }) =>
    api.get<ApiResponse<{ data: StockPolicy[] }>>("/stock-policies", { params }).then((r) => r.data),

  /** Get a single stock policy by ID */
  getById: (id: string) =>
    api.get<ApiResponse<StockPolicy>>(`/stock-policies/${id}`).then((r) => r.data),

  /** Create a new stock policy */
  create: (data: {
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
  }) =>
    api.post<ApiResponse<StockPolicy>>("/stock-policies", data).then((r) => r.data),

  /** Update an existing stock policy */
  update: (id: string, data: Partial<{
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
  }>) =>
    api.put<ApiResponse<StockPolicy>>(`/stock-policies/${id}`, data).then((r) => r.data),

  /** Delete (deactivate) a stock policy */
  delete: (id: string) =>
    api.delete<ApiResponse<{ message: string }>>(`/stock-policies/${id}`).then((r) => r.data),
};
