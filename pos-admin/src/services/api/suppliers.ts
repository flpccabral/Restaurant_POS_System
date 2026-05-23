import { api } from "@/lib/api";
import type { ApiResponse } from "./types";
import type { Supplier } from "@/types";

/**
 * Supplier API service.
 *
 * NOTE: Backend mounts supplier routes at `/api/supplier` (singular).
 * All paths here use the singular form to match.
 */
export const suppliersService = {
  getAll: () => api.get<ApiResponse<Supplier[]>>("/supplier"),
  getById: (id: string) => api.get<ApiResponse<Supplier>>(`/supplier/${id}`),
  create: (data: Partial<Supplier>) => api.post<ApiResponse<Supplier>>("/supplier", data),
  update: (id: string, data: Partial<Supplier>) => api.put<ApiResponse<Supplier>>(`/supplier/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/supplier/${id}`),
};
