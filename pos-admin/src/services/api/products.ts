import { api } from "@/lib/api";
import type { ApiResponse } from "./types";
import type { Product } from "@/types";

export const productsService = {
  getAll: () => api.get<ApiResponse<Product[]>>("/products"),
  getById: (id: string) => api.get<ApiResponse<Product>>(`/products/${id}`),
  create: (data: Partial<Product>) => api.post<ApiResponse<Product>>("/products", data),
  update: (id: string, data: Partial<Product>) => api.put<ApiResponse<Product>>(`/products/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/products/${id}`),
};
