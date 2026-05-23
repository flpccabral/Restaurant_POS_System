import { api } from "@/lib/api";
import type { ApiResponse } from "./types";

/**
 * Stock Transfer API service.
 *
 * Consumes backend endpoints mounted at `/api/stock/transfer`.
 */
export const transferService = {
  /** Execute central-to-store transfer */
  centralToStore: (data: {
    originLocationId: string;
    destinationLocationId: string;
    ingredientId: string;
    quantity: number;
    unit: string;
    reason?: string;
  }) =>
    api.post<ApiResponse<{ message: string }>>("/stock/transfer", data).then((r) => r.data),

  /** Execute inter-store transfer */
  interStoreTransfer: (data: {
    originStoreId: string;
    destinationStoreId: string;
    originLocationId: string;
    destinationLocationId: string;
    ingredientId: string;
    quantity: number;
    unit: string;
    reason?: string;
  }) =>
    api.post<ApiResponse<{ message: string }>>("/stock/transfer/inter-store", data).then((r) => r.data),
};
