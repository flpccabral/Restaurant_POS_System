"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { StoreProvider } from "@/contexts/StoreContext";

/**
 * Client wrapper for the dashboard layout.
 *
 * Provides React Query context and StoreContext to all dashboard pages.
 * Extracted as a client boundary so the layout itself can remain a server
 * component.
 */
export function DashboardWrapper({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>{children}</StoreProvider>
    </QueryClientProvider>
  );
}
