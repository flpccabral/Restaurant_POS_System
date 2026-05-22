import { api } from "@/lib/api";
import type { ApiResponse } from "./types";
import type { Device } from "@/types";

export const devicesService = {
  getAll: () => api.get<ApiResponse<Device[]>>("/devices"),
  getStats: () => api.get<ApiResponse<unknown>>("/devices/stats"),
  approve: (id: string) => api.post<ApiResponse<Device>>(`/devices/${id}/approve`),
  revoke: (id: string, reason?: string) => api.delete<ApiResponse<void>>(`/devices/${id}`),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/devices/${id}`),
};
