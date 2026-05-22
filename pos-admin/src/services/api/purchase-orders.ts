import { api } from "@/lib/api";
import type { ApiResponse } from "./types";
import type { PurchaseOrder } from "@/types";

export const purchaseOrdersService = {
  getAll: () => api.get<ApiResponse<PurchaseOrder[]>>("/purchase-orders"),
  getById: (id: string) => api.get<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}`),
  create: (data: Partial<PurchaseOrder>) => api.post<ApiResponse<PurchaseOrder>>("/purchase-orders", data),
  update: (id: string, data: Partial<PurchaseOrder>) => api.put<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/status`, { status }),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/purchase-orders/${id}`),
  sendOrder: (id: string) => api.post<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/send`),
  confirmOrder: (id: string) => api.post<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/confirm`),
  receiveOrder: (id: string) => api.post<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/receive`),
  cancelOrder: (id: string) => api.post<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/cancel`),
};
