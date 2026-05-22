import { api } from "@/lib/api";
import type { ApiResponse } from "./types";
import type { Category } from "@/types";

export const categoriesService = {
  getAll: () => api.get<ApiResponse<Category[]>>("/categories"),
  getById: (id: string) => api.get<ApiResponse<Category>>(`/categories/${id}`),
  create: (data: { name: string; description?: string }) => api.post<ApiResponse<Category>>("/categories", data),
  update: (id: string, data: { name: string; description?: string }) => api.put<ApiResponse<Category>>(`/categories/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/categories/${id}`),
  toggleStatus: (id: string) => api.put<ApiResponse<Category>>(`/categories/${id}/toggle-status`),
};
