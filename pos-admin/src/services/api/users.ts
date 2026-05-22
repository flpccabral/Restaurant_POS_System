import { api } from "@/lib/api";
import type { ApiResponse } from "./types";
import type { User } from "@/types";

export const usersService = {
  getAll: () => api.get<ApiResponse<User[]>>("/user"),
  getById: (id: string) => api.get<ApiResponse<User>>(`/user/${id}`),
  create: (data: { name: string; email: string; phone: string; password: string; role?: string }) =>
    api.post<ApiResponse<User>>("/user/register", data),
  update: (id: string, data: Partial<User>) => api.put<ApiResponse<User>>(`/user/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/user/${id}`),
  assignRole: (userId: string, roleId: string) => api.patch<ApiResponse<User>>(`/user/${userId}/role`, { roleId }),
};
