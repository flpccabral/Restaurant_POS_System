import { api } from "@/lib/api";
import type { ApiResponse } from "./types";
import type { Ingredient } from "@/types";

export const ingredientsService = {
  getAll: () => api.get<ApiResponse<Ingredient[]>>("/ingredients"),
  getById: (id: string) => api.get<ApiResponse<Ingredient>>(`/ingredients/${id}`),
  create: (data: Partial<Ingredient>) => api.post<ApiResponse<Ingredient>>("/ingredients", data),
  update: (id: string, data: Partial<Ingredient>) => api.put<ApiResponse<Ingredient>>(`/ingredients/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/ingredients/${id}`),
};
