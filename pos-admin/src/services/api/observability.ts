import { api } from "@/lib/api";
import type { ApiResponse } from "./types";
import type {
  StockHealthData,
  OperationalAlert,
  Recommendation,
  TimelineEvent,
  OverviewData,
} from "@/types";

/**
 * Observability API service.
 *
 * Consumes backend endpoints mounted at `/api/observability`.
 *
 * Phase 7A — Console somente leitura
 * Phase 7B — Acoes assistidas
 * Phase 8.5 — Consolidacao no pos-admin
 */
export const observabilityService = {
  // ── Overview ────────────────────────────────────────────────────────────

  /** Get combined overview data (stock health summary + recent alerts) */
  getOverview: (storeId: string) =>
    api.get<ApiResponse<OverviewData>>(`/observability/overview?storeId=${storeId}`).then((r) => r.data),

  // ── Stock Health ────────────────────────────────────────────────────────

  /** Get stock health for a specific store */
  getStockHealth: (storeId: string) =>
    api.get<ApiResponse<StockHealthData>>(`/observability/stock-health/store/${storeId}`).then((r) => r.data),

  // ── Alerts ──────────────────────────────────────────────────────────────

  /** Get operational alerts with optional filters */
  getAlerts: (params?: { storeId?: string; status?: string; severity?: string; type?: string; limit?: number }) =>
    api.get<ApiResponse<{ alerts: OperationalAlert[] }>>("/observability/alerts", { params }).then((r) => r.data),

  /** Resolve an alert */
  resolveAlert: (alertId: string, data?: { notes?: string }) =>
    api.post<ApiResponse<{ message: string }>>(`/observability/alerts/${alertId}/resolve`, data).then((r) => r.data),

  /** Dismiss an alert */
  dismissAlert: (alertId: string, data?: { reason?: string }) =>
    api.post<ApiResponse<{ message: string }>>(`/observability/alerts/${alertId}/dismiss`, data).then((r) => r.data),

  /** Generate alerts for a store */
  generateAlerts: (storeId: string) =>
    api.post<ApiResponse<unknown>>(`/observability/alerts/generate/${storeId}`).then((r) => r.data),

  /** Check products without recipe */
  checkProductsWithoutRecipe: () =>
    api.post<ApiResponse<{ count: number; products: string[] }>>("/observability/alerts/check-products-without-recipe").then((r) => r.data),

  // ── Recommendations ─────────────────────────────────────────────────────

  /** Get network-wide recommendations */
  getNetworkRecommendations: () =>
    api.get<ApiResponse<{ recommendations: Recommendation[] }>>("/observability/recommendations/network").then((r) => r.data),

  /** Register a purchase note */
  registerPurchase: (data: {
    ingredientId: string;
    ingredientName?: string;
    quantity: number;
    unit: string;
    notes?: string;
  }) =>
    api.post<ApiResponse<{ message: string }>>("/observability/purchase/register", data).then((r) => r.data),

  // ── Timeline ────────────────────────────────────────────────────────────

  /** Get operational timeline events */
  getTimeline: (params?: { limit?: number; type?: string; storeId?: string }) =>
    api.get<ApiResponse<{ events: TimelineEvent[] }>>("/observability/timeline", { params }).then((r) => r.data),
};
