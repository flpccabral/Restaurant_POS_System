import { api } from "@/lib/api";
import type { ApiResponse } from "./types";
import type { Category } from "@/types";

/**
 * Category API service.
 *
 * NOTE: Backend mounts category routes at `/api/category` (singular).
 * All paths here use the singular form to match.
 */
export const categoriesService = {
  getAll: () => api.get<ApiResponse<Category[]>>("/category"),
  getById: (id: string) => api.get<ApiResponse<Category>>(`/category/${id}`),
  create: (data: { name: string; description?: string }) => api.post<ApiResponse<Category>>("/category", data),
  update: (id: string, data: { name: string; description?: string }) => api.put<ApiResponse<Category>>(`/category/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/category/${id}`),
  toggleStatus: (id: string) => api.put<ApiResponse<Category>>(`/category/${id}/toggle-status`),
};
