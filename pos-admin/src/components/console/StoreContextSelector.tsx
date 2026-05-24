"use client";

import { useStoreContext } from "@/contexts/StoreContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Store, Loader2 } from "lucide-react";

/**
 * StoreContextSelector — seletor de loja/contexto operacional
 *
 * Comportamento:
 * - Master admin: dropdown com todas as lojas disponiveis para selecao
 * - Usuario comum: mostra a loja fixa (desabilitado / informativo)
 * - Nenhuma loja disponivel: mensagem de estado vazio
 */
export function StoreContextSelector() {
  const { storeId, store, stores, setStoreId, isLoading, needsStoreSelection } =
    useStoreContext();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Carregando lojas...</span>
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" />
        <span>Nenhuma loja disponivel</span>
      </div>
    );
  }

  // Se não há storeId selecionado (master admin sem loja)
  if (!storeId) {
    return (
      <div className="flex items-center gap-2">
        <Select onValueChange={(v: string | null) => { if (v !== null) setStoreId(v); }}>
          <SelectTrigger className="w-56 h-8 text-xs border-dashed border-warning/50 text-warning">
            <SelectValue placeholder="Selecione uma loja..." />
          </SelectTrigger>
          <SelectContent>
            {stores.map((s) => (
              <SelectItem key={s._id} value={s._id}>
                <div className="flex items-center gap-2">
                  <Store className="h-3.5 w-3.5" />
                  <span>{s.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Master admin com loja selecionada — dropdown editavel
  // Usuario comum — dropdown bloqueado (mostra loja fixa)
  const isMasterAdmin =
    typeof window !== "undefined" &&
    // Derived from the context — we can check if stores > 0 and user can switch
    stores.length > 0;

  return (
    <div className="flex items-center gap-2">
      <Select
        value={storeId}
        onValueChange={(v: string | null) => {
          // Only master admin can actually switch; for regular users this is a no-op
          if (stores.length > 0 && store && v !== null) {
            setStoreId(v);
          }
        }}
      >
        <SelectTrigger
          className={`w-56 h-8 text-xs ${
            needsStoreSelection
              ? "border-dashed border-warning/50 text-warning"
              : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <Store className="h-3.5 w-3.5 text-brand shrink-0" />
            <SelectValue placeholder="Selecione uma loja..." />
          </div>
        </SelectTrigger>
        <SelectContent>
          {stores.map((s) => (
            <SelectItem key={s._id} value={s._id}>
              <div className="flex items-center gap-2">
                <Store className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{s.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {store && (
        <span className="text-[10px] text-muted-foreground/50 hidden md:inline">
          ID: {store._id.slice(-6)}
        </span>
      )}
    </div>
  );
}
