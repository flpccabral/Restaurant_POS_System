import { api } from "@/lib/api";
import type { ApiResponse } from "./types";
import type { Device } from "@/types";

/**
 * Device API service.
 *
 * NOTE: Backend mounts device routes at `/api/device` (singular).
 * All paths here use the singular form to match.
 */
export const devicesService = {
  getAll: () => api.get<ApiResponse<Device[]>>("/device"),
  getStats: () => api.get<ApiResponse<unknown>>("/device/stats"),
  approve: (id: string) => api.post<ApiResponse<Device>>(`/device/${id}/approve`),
  revoke: (id: string, reason?: string) => api.delete<ApiResponse<void>>(`/device/${id}`),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/device/${id}`),
};
