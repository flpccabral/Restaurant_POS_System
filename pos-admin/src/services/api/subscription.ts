import { api } from "@/lib/api";
import type { ApiResponse } from "./types";
import type { Subscription } from "@/types";

export const subscriptionService = {
  getDetails: (storeId: string) => api.get<ApiResponse<Subscription>>(`/subscription/${storeId}`),
  updatePlan: (storeId: string, plan: string) => api.patch<ApiResponse<Subscription>>(`/subscription/${storeId}/plan`, { plan }),
};
