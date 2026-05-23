import { api } from "@/lib/api";
import type { ApiResponse } from "./types";
import type { Product } from "@/types";

/**
 * Product API service.
 *
 * NOTE: Backend mounts product routes at `/api/product` (singular).
 * All paths here use the singular form to match.
 */
export const productsService = {
  getAll: () => api.get<ApiResponse<Product[]>>("/product"),
  getById: (id: string) => api.get<ApiResponse<Product>>(`/product/${id}`),
  create: (data: Partial<Product>) => api.post<ApiResponse<Product>>("/product", data),
  update: (id: string, data: Partial<Product>) => api.put<ApiResponse<Product>>(`/product/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/product/${id}`),
};
