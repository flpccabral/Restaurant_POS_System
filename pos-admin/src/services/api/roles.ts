import { api } from "@/lib/api";
import type { ApiResponse } from "./types";
import type { Role } from "@/types";

export const rolesService = {
  getAll: () => api.get<ApiResponse<Role[]>>("/roles"),
  getById: (id: string) => api.get<ApiResponse<Role>>(`/roles/${id}`),
  create: (data: Partial<Role>) => api.post<ApiResponse<Role>>("/roles", data),
  update: (id: string, data: Partial<Role>) => api.put<ApiResponse<Role>>(`/roles/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/roles/${id}`),
};
