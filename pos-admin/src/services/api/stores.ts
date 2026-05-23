import { api } from "@/lib/api";
import type { ApiResponse } from "./types";
import type { Store } from "@/types";

/**
 * Store API service.
 *
 * NOTE: Backend mounts store routes at `/api/store` (singular).
 * All paths here use the singular form to match.
 */
export const storesService = {
  getAll: () => api.get<ApiResponse<Store[]>>("/store"),
  getById: (id: string) => api.get<ApiResponse<Store>>(`/store/${id}`),
  create: (data: Partial<Store>) => api.post<ApiResponse<Store>>("/store", data),
  update: (id: string, data: Partial<Store>) => api.put<ApiResponse<Store>>(`/store/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/store/${id}`),
};
