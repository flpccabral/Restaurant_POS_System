import { api } from "@/lib/api";
import type { ApiResponse } from "./types";
import type { Ingredient } from "@/types";

/**
 * Ingredient API service.
 *
 * NOTE: Backend mounts ingredient routes at `/api/ingredient` (singular).
 * All paths here use the singular form to match.
 */
export const ingredientsService = {
  getAll: () => api.get<ApiResponse<Ingredient[]>>("/ingredient"),
  getById: (id: string) => api.get<ApiResponse<Ingredient>>(`/ingredient/${id}`),
  create: (data: Partial<Ingredient>) => api.post<ApiResponse<Ingredient>>("/ingredient", data),
  update: (id: string, data: Partial<Ingredient>) => api.put<ApiResponse<Ingredient>>(`/ingredient/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/ingredient/${id}`),
};
