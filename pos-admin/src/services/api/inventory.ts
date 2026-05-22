import { api } from "@/lib/api";
import type { ApiResponse } from "./types";

export const inventoryService = {
  getBalance: () => api.get<ApiResponse<unknown>>("/stock/balance"),
  stockIn: (data: { ingredientId: string; quantity: number; unitCost?: number; notes?: string }) =>
    api.post<ApiResponse<unknown>>("/stock/in", data),
  stockOut: (data: { ingredientId: string; quantity: number; reason?: string }) =>
    api.post<ApiResponse<unknown>>("/stock/out", data),
  adjust: (data: { ingredientId: string; newQuantity: number; reason?: string }) =>
    api.post<ApiResponse<unknown>>("/stock/adjust", data),
  getHistory: () => api.get<ApiResponse<unknown[]>>("/stock/history"),
  getAlerts: () => api.get<ApiResponse<unknown[]>>("/stock/alerts"),
  getRestockAlerts: () => api.get<ApiResponse<unknown[]>>("/stock/restock-alerts"),
  getShoppingList: () => api.get<ApiResponse<unknown[]>>("/stock/shopping-list"),
};
