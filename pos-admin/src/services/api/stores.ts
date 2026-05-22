import { api } from "@/lib/api";
import type { ApiResponse } from "./types";
import type { Store } from "@/types";

export const storesService = {
  getAll: () => api.get<ApiResponse<Store[]>>("/stores"),
  getById: (id: string) => api.get<ApiResponse<Store>>(`/stores/${id}`),
  create: (data: Partial<Store>) => api.post<ApiResponse<Store>>("/stores", data),
  update: (id: string, data: Partial<Store>) => api.put<ApiResponse<Store>>(`/stores/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/stores/${id}`),
};
