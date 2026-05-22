import { api } from "@/lib/api";
import type { ApiResponse } from "./types";
import type { Supplier } from "@/types";

export const suppliersService = {
  getAll: () => api.get<ApiResponse<Supplier[]>>("/suppliers"),
  getById: (id: string) => api.get<ApiResponse<Supplier>>(`/suppliers/${id}`),
  create: (data: Partial<Supplier>) => api.post<ApiResponse<Supplier>>("/suppliers", data),
  update: (id: string, data: Partial<Supplier>) => api.put<ApiResponse<Supplier>>(`/suppliers/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/suppliers/${id}`),
};
