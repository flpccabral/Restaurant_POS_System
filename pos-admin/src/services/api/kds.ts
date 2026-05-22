import { api } from "@/lib/api";
import type { ApiResponse } from "./types";
import type { KdsTicket } from "@/types";

export const kdsService = {
  getTickets: () => api.get<ApiResponse<KdsTicket[]>>("/kds/orders"),
  getById: (id: string) => api.get<ApiResponse<KdsTicket>>(`/kds/orders/${id}`),
  acceptOrder: (id: string) => api.post<ApiResponse<KdsTicket>>(`/kds/orders/${id}/accept`),
  updateItemStatus: (ticketId: string, itemId: string, status: string) =>
    api.post<ApiResponse<KdsTicket>>(`/kds/orders/${ticketId}/items/${itemId}/status`, { status }),
  markReady: (id: string) => api.post<ApiResponse<KdsTicket>>(`/kds/orders/${id}/ready`),
  markServed: (id: string) => api.post<ApiResponse<KdsTicket>>(`/kds/orders/${id}/served`),
  cancelOrder: (id: string) => api.post<ApiResponse<KdsTicket>>(`/kds/orders/${id}/cancel`),
  getStationStats: () => api.get<ApiResponse<unknown>>("/kds/stats/station"),
};
