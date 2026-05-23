import { axiosWrapper } from "./axiosWrapper";

// API Endpoints

// Auth Endpoints
export const login = (data) => axiosWrapper.post("/api/user/login", data);
export const register = (data) => axiosWrapper.post("/api/user/register", data);
export const getUserData = () => axiosWrapper.get("/api/user");
export const logout = () => axiosWrapper.post("/api/user/logout");

// Table Endpoints
export const addTable = (data) => axiosWrapper.post("/api/table/", data);
export const getTables = () => axiosWrapper.get("/api/table");
export const updateTable = ({ tableId, ...tableData }) =>
  axiosWrapper.put(`/api/table/${tableId}`, tableData);

// Payment Endpoints
export const createOrderRazorpay = (data) =>
  axiosWrapper.post("/api/payment/create-order", data);
export const verifyPaymentRazorpay = (data) =>
  axiosWrapper.post("/api/payment//verify-payment", data);

// Order Endpoints
export const addOrder = (data) => axiosWrapper.post("/api/order/", data);
export const getOrders = () => axiosWrapper.get("/api/order");
export const updateOrderStatus = ({ orderId, orderStatus }) =>
  axiosWrapper.put(`/api/order/${orderId}`, { orderStatus });

// Observability Endpoints (Phase 6/7A)
export const getStockHealth = (storeId) =>
  axiosWrapper.get(`/api/observability/stock-health/store/${storeId}`);
export const getNetworkRecommendations = () =>
  axiosWrapper.get("/api/observability/recommendations/network");
export const getAlerts = (params = {}) =>
  axiosWrapper.get("/api/observability/alerts", { params });
export const getTimeline = (params = {}) =>
  axiosWrapper.get("/api/observability/timeline", { params });
export const getStockPolicies = (params = {}) =>
  axiosWrapper.get("/api/stock-policies", { params });

// Phase 7B — Acoes assistidas
export const resolveAlert = (alertId, data) =>
  axiosWrapper.post(`/api/observability/alerts/${alertId}/resolve`, data);
export const dismissAlert = (alertId, data) =>
  axiosWrapper.post(`/api/observability/alerts/${alertId}/dismiss`, data);
export const executeCentralTransfer = (data) =>
  axiosWrapper.post("/api/stock/transfer", data);
export const executeInterStoreTransfer = (data) =>
  axiosWrapper.post("/api/stock/transfer/inter-store", data);
export const markPurchaseNeeded = (data) =>
  axiosWrapper.post("/api/observability/purchase/register", data);
