"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { storesService } from "@/services/api/stores";
import { useCapabilities } from "@/hooks/useCapabilities";
import type { Store } from "@/types";

/**
 * StoreContext — Multi-store context provider
 *
 * Manages the currently selected store ("active context") for the pos-admin.
 *
 * Behavior:
 * - Regular users (non-master): context is fixed to their associated store.
 * - Master admin: can freely switch between stores. Selection is persisted in
 *   localStorage and restored on reload.
 * - Master admin without any store association: must select a store explicitly
 *   before using store-dependent features.
 *
 * Future (Phase 9+): this context can be extended to support a "central view"
 * aggregating data from all stores simultaneously.
 */

interface StoreContextValue {
  /** The currently selected store ID (or null if none selected) */
  storeId: string | null;
  /** The currently selected store object (or null) */
  store: Store | null;
  /** List of all stores available (for master admin) */
  stores: Store[];
  /** Select a store by ID */
  setStoreId: (id: string | null) => void;
  /** Whether stores are still loading */
  isLoading: boolean;
  /** Whether the user needs to select a store (master admin without one) */
  needsStoreSelection: boolean;
  /** Error state from fetching stores */
  isError: boolean;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const STORAGE_KEY = "pos-admin:activeStoreId";

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: isAuthLoading, isMasterAdmin } = useCapabilities();

  // Fetch all stores
  const {
    data: storesResponse,
    isLoading: storesLoading,
    isError,
  } = useQuery({
    queryKey: ["stores"],
    queryFn: () => storesService.getAll().then((r) => r.data),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const stores: Store[] = storesResponse?.data ?? [];

  // Persisted store ID (for master admin switching)
  const [persistedStoreId, setPersistedStoreId] = useState<string | null>(null);

  // On mount, restore from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setPersistedStoreId(saved);
      }
    }
  }, []);

  // Determine the effective storeId
  const effectiveStoreId = useCallback((): string | null => {
    if (isAuthLoading || !user) return null;

    if (isMasterAdmin) {
      // Master admin: prefer the persisted selection, else first store as fallback
      if (persistedStoreId) {
        return persistedStoreId;
      }
      // Auto-select first store only if safe (we have stores loaded)
      if (stores.length > 0) {
        return stores[0]._id;
      }
      return null;
    }

    // Regular user: use their fixed store
    return user?.store?._id ?? null;
  }, [isAuthLoading, user, isMasterAdmin, persistedStoreId, stores]);

  const [storeId, setStoreIdState] = useState<string | null>(null);

  // Sync effective storeId
  useEffect(() => {
    const id = effectiveStoreId();
    if (id !== undefined) {
      setStoreIdState(id);
    }
  }, [effectiveStoreId]);

  const setStoreId = useCallback(
    (id: string | null) => {
      if (!isMasterAdmin) return; // Only master admin can switch
      setPersistedStoreId(id);
      if (typeof window !== "undefined") {
        if (id) {
          localStorage.setItem(STORAGE_KEY, id);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    },
    [isMasterAdmin]
  );

  const currentStore = stores.find((s) => s._id === storeId) ?? null;

  const needsStoreSelection =
    isMasterAdmin && !storeId && !isAuthLoading && !storesLoading && stores.length > 0;

  const value: StoreContextValue = {
    storeId,
    store: currentStore,
    stores,
    setStoreId,
    isLoading: isAuthLoading || storesLoading,
    needsStoreSelection,
    isError,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStoreContext(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error("useStoreContext must be used within a StoreProvider");
  }
  return ctx;
}
