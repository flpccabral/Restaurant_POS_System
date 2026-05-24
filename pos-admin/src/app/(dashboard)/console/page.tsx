"use client";

import { useState } from "react";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useStoreContext } from "@/contexts/StoreContext";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/console/OverviewTab";
import { StockHealthTab } from "@/components/console/StockHealthTab";
import { AlertsTab } from "@/components/console/AlertsTab";
import { RecommendationsTab } from "@/components/console/RecommendationsTab";
import { TimelineTab } from "@/components/console/TimelineTab";
import { PolicyTab } from "@/components/console/PolicyTab";
import { StoreContextSelector } from "@/components/console/StoreContextSelector";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  LayoutDashboard,
  Package,
  AlertTriangle,
  Lightbulb,
  History,
  Shield,
  EyeOff,
  Store,
} from "lucide-react";

const ALL_TABS = [
  { key: "overview", label: "Visao Geral", icon: LayoutDashboard },
  { key: "stockHealth", label: "Saude do Estoque", icon: Package },
  { key: "alerts", label: "Alertas", icon: AlertTriangle },
  { key: "recommendations", label: "Recomendacoes", icon: Lightbulb },
  { key: "timeline", label: "Timeline", icon: History },
  { key: "policies", label: "Politicas", icon: Shield },
] as const;

type TabKey = (typeof ALL_TABS)[number]["key"];

export default function ConsolePage() {
  const { can, isLoading: isAuthLoading } = useCapabilities();
  const { storeId, store, isLoading: storeLoading, needsStoreSelection } = useStoreContext();
  const hasReadAccess = can("inventory", "read");

  // Filter tabs based on read permission
  const tabs = hasReadAccess
    ? ALL_TABS
    : ALL_TABS.filter((t) => t.key === "overview");

  const [activeTab, setActiveTab] = useState<TabKey>(tabs[0]?.key ?? "overview");

  // Reset active tab if current one is filtered out
  if (!tabs.find((t) => t.key === activeTab) && !isAuthLoading) {
    // Will be handled on next render
  }

  if (isAuthLoading || storeLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Console Operacional</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!hasReadAccess) {
    return (
      <div className="p-6">
        <EmptyState
          variant="alert"
          title="Sem permissao"
          description="Voce nao tem permissao para visualizar o Console Operacional. Contate o administrador."
          icon={EyeOff}
        />
      </div>
    );
  }

  // Master admin without store selected: prompt to choose one
  if (needsStoreSelection) {
    return (
      <div className="p-6">
        <EmptyState
          variant="empty"
          title="Selecione uma loja"
          description="Como administrador sem loja fixa, selecione uma loja para visualizar o Console Operacional."
          icon={Store}
        >
          <div className="mt-4">
            <StoreContextSelector />
          </div>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Console Operacional</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Monitoramento e gestao inteligente de estoque
          {store && <span className="ml-2 text-xs text-muted-foreground/60">— {store.name}</span>}
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabKey)}
      >
        <TabsList>
          {tabs.map(({ key, label, icon: Icon }) => (
            <TabsTab key={key} value={key}>
              <Icon className="h-4 w-4" />
              {label}
            </TabsTab>
          ))}
        </TabsList>

        <TabsPanel value="overview">
          <OverviewTab />
        </TabsPanel>

        <TabsPanel value="stockHealth">
          <StockHealthTab />
        </TabsPanel>

        <TabsPanel value="alerts">
          <AlertsTab />
        </TabsPanel>

        <TabsPanel value="recommendations">
          <RecommendationsTab />
        </TabsPanel>

        <TabsPanel value="timeline">
          <TimelineTab />
        </TabsPanel>

        <TabsPanel value="policies">
          <PolicyTab />
        </TabsPanel>
      </Tabs>
    </div>
  );
}
