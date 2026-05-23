import { api } from "@/lib/api";
import type { ApiResponse } from "./types";
import type { Role } from "@/types";

/**
 * Role API service.
 *
 * NOTE: Backend mounts role routes at `/api/role` (singular).
 * All paths here use the singular form to match.
 */
export const rolesService = {
  getAll: () => api.get<ApiResponse<Role[]>>("/role"),
  getById: (id: string) => api.get<ApiResponse<Role>>(`/role/${id}`),
  create: (data: Partial<Role>) => api.post<ApiResponse<Role>>("/role", data),
  update: (id: string, data: Partial<Role>) => api.put<ApiResponse<Role>>(`/role/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/role/${id}`),
};
