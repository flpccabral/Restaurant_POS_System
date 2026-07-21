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

// Fase 9.3C — Close table (PDV closing/payment)
export const closeTable = (tableId, data) =>
  axiosWrapper.post(`/api/table/${tableId}/close`, data);

// Fase 9.3C — Get accumulated table bill
export const getTableBill = (tableId) =>
  axiosWrapper.get(`/api/table/${tableId}/bill`);

// Payment Endpoints
export const createOrderRazorpay = (data) =>
  axiosWrapper.post("/api/payment/create-order", data);
export const verifyPaymentRazorpay = (data) =>
  axiosWrapper.post("/api/payment//verify-payment", data);

// Order Endpoints
export const addOrder = (data) => axiosWrapper.post("/api/order/", data);
export const getOrders = (params = {}) => axiosWrapper.get("/api/order", { params });
export const updateOrderStatus = ({ orderId, orderStatus }) =>
  axiosWrapper.put(`/api/order/${orderId}`, { orderStatus });

// Fase 8.4.2 — Baixa de estoque transacional após venda
export const processOrderStockDeduction = (orderId) =>
  axiosWrapper.post(`/api/order/${orderId}/process-stock-deduction`);

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

// Phase 7C — Stock Policy CRUD
export const createStockPolicy = (data) =>
  axiosWrapper.post("/api/stock-policies", data);
export const updateStockPolicy = (policyId, data) =>
  axiosWrapper.put(`/api/stock-policies/${policyId}`, data);
export const deleteStockPolicy = (policyId) =>
  axiosWrapper.delete(`/api/stock-policies/${policyId}`);

// Phase 7C — Form dropdown data
export const getIngredients = (params = {}) =>
  axiosWrapper.get("/api/ingredient", { params });
export const getStores = () =>
  axiosWrapper.get("/api/store");
export const getCurrentStoreSettings = () =>
  axiosWrapper.get("/api/store/current");
export const updateServiceChargeConfig = (data) =>
  axiosWrapper.put("/api/store/current/service-charge", data);
export const getServiceChargeSummary = (params = {}) =>
  axiosWrapper.get("/api/dashboard/service-charge-summary", { params });
export const getLocations = (params = {}) =>
  axiosWrapper.get("/api/stock/locations", { params });

// Product Endpoints (Fase 9.1B-FIX)
export const getProducts = (params = {}) =>
  axiosWrapper.get("/api/product", { params });

// Category Endpoints
export const getCategories = (params = {}) =>
  axiosWrapper.get("/api/category", { params });

// Dashboard Endpoints
export const getDashboardKPIs = (params = {}) =>
  axiosWrapper.get("/api/dashboard/kpi", { params });
export const getTopProducts = (params = {}) =>
  axiosWrapper.get("/api/dashboard/products/top", { params });

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

// ============================================
// Fase 7.1 — Impressao Termica ESC/POS
// ============================================

// Impressoras
export const listPrinters = (params = {}) =>
  axiosWrapper.get("/api/print/printers", { params });
export const createPrinter = (data) =>
  axiosWrapper.post("/api/print/printers", data);
export const updatePrinter = (printerId, data) =>
  axiosWrapper.put(`/api/print/printers/${printerId}`, data);
export const deletePrinter = (printerId) =>
  axiosWrapper.delete(`/api/print/printers/${printerId}`);
export const testPrinter = (printerId) =>
  axiosWrapper.post(`/api/print/printers/${printerId}/test`);

// Impressao de cupom/comanda
export const printReceipt = (data) =>
  axiosWrapper.post("/api/print/receipt", data);

// ============================================
// Fase 7 — KDS (Kitchen Display System)
// ============================================
export const getKDSOrders = (params = {}) =>
  axiosWrapper.get("/api/kds/orders", { params });
export const getKDSOrderById = (id) =>
  axiosWrapper.get(`/api/kds/orders/${id}`);
export const acceptKDSOrder = (id) =>
  axiosWrapper.post(`/api/kds/orders/${id}/accept`);
export const markKDSReady = (id) =>
  axiosWrapper.post(`/api/kds/orders/${id}/ready`);
export const markKDSServed = (id) =>
  axiosWrapper.post(`/api/kds/orders/${id}/served`);
export const rushKDSOrder = (id) =>
  axiosWrapper.post(`/api/kds/orders/${id}/rush`);
export const cancelKDSOrder = (id, data = {}) =>
  axiosWrapper.post(`/api/kds/orders/${id}/cancel`, data);
export const getKDSConfig = () =>
  axiosWrapper.get("/api/kds/config");
export const getKDSStationStats = (params = {}) =>
  axiosWrapper.get("/api/kds/stats/station", { params });

// ============================================
// Prompt D — Divisao de Conta (Split Bill)
// ============================================
export const calculateSplit = (tableId, data) =>
  axiosWrapper.post(`/api/split/table/${tableId}/calculate`, data);
export const createSplitBill = (tableId, data) =>
  axiosWrapper.post(`/api/split/table/${tableId}/split`, data);
export const processSplitPayment = (splitId, paymentId) =>
  axiosWrapper.post(`/api/split/${splitId}/payments/${paymentId}`);
export const closeSplitBill = (splitId) =>
  axiosWrapper.post(`/api/split/${splitId}/close`);
export const getSplits = (params = {}) =>
  axiosWrapper.get("/api/split", { params });

// ============================================
// Prompt F — Vínculo Garçom/Mesa + Comissão
// ============================================
export const getAttendants = (params = {}) =>
  axiosWrapper.get("/api/attendant", { params });
export const getAttendantCommission = (attendantId, params = {}) =>
  axiosWrapper.get(`/api/attendant/${attendantId}/commission`, { params });
export const transferAttendant = (orderId, data) =>
  axiosWrapper.post(`/api/attendant/order/${orderId}/transfer-attendant`, data);
export const updateCommissionConfig = (attendantId, data) =>
  axiosWrapper.put(`/api/attendant/${attendantId}/commission-config`, data);

// ============================================
// Prompt E — Fluxo de Caixa (Abertura/Fechamento/Sangria/Suprimento)
// ============================================
export const getCashSession = () =>
  axiosWrapper.get("/api/pdv/session/active");
export const openCashSession = (data) =>
  axiosWrapper.post("/api/pdv/session/open", data);
export const closeCashSession = (data) =>
  axiosWrapper.post("/api/pdv/session/close", data);
export const performSangria = (data) =>
  axiosWrapper.post("/api/pdv/sangria", data);
export const performSuprimento = (data) =>
  axiosWrapper.post("/api/pdv/suprimento", data);

// ============================================
// Pagamentos
// ============================================
export const getPayments = (params = {}) =>
  axiosWrapper.get("/api/payment", { params });

// Processar pagamento de pedido (PDV)
export const processPayment = (data) =>
  axiosWrapper.post("/api/pdv/payment", data);
