"use client";

import { StoreProvider } from "@/contexts/StoreContext";
import type { ReactNode } from "react";

/**
 * Thin client boundary so the dashboard layout stays a server component.
 */
export function StoreProviderWrapper({ children }: { children: ReactNode }) {
  return <StoreProvider>{children}</StoreProvider>;
}
