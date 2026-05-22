import { api } from "@/lib/api";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  metadata?: Record<string, unknown>;
}
