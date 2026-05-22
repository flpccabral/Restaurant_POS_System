import { api } from "@/lib/api";
import type { ApiResponse } from "./types";
import type { CashSession } from "@/types";

export const pdvService = {
  openSession: (data: { openingBalance: number }) =>
    api.post<ApiResponse<CashSession>>("/pdv/session/open", data),
  getActiveSession: () => api.get<ApiResponse<CashSession>>("/pdv/session/active"),
  closeSession: (data: { closingBalance: number }) =>
    api.post<ApiResponse<CashSession>>("/pdv/session/close", data),
  getHistory: () => api.get<ApiResponse<CashSession[]>>("/pdv/sessions"),
  sangria: (data: { amount: number; reason: string }) =>
    api.post<ApiResponse<unknown>>("/pdv/sangria", data),
  suprimento: (data: { amount: number; reason: string }) =>
    api.post<ApiResponse<unknown>>("/pdv/suprimento", data),
  getDailyPayments: () => api.get<ApiResponse<unknown[]>>("/pdv/daily-payments"),
  getSummary: () => api.get<ApiResponse<unknown>>("/pdv/summary"),
};
