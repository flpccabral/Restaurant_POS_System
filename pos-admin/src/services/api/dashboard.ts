import { api } from "@/lib/api";

export const dashboardService = {
  getKPIs: (period = "today") => api.get(`/dashboard/kpi?period=${period}`),
  getSalesReport: (period = "7days", groupBy = "day") =>
    api.get(`/dashboard/sales?period=${period}&groupBy=${groupBy}`),
  getTopProducts: (limit = 5, period = "7days") =>
    api.get(`/dashboard/products/top?limit=${limit}&period=${period}`),
  getCMV: (period = "30days") => api.get(`/dashboard/cmv?period=${period}`),
  getVariance: (period = "7days") => api.get(`/dashboard/variance?period=${period}`),
  getInventoryAnalytics: () => api.get("/dashboard/inventory"),
  getUserStats: () => api.get("/dashboard/users"),
};
