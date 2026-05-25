import React, { useState, useEffect } from "react";
import { MdDashboard, MdInventory, MdWarning, MdLightbulb, MdTimeline, MdGavel } from "react-icons/md";
import { useCapabilities } from "../hooks/useCapabilities";
import OverviewTab from "../components/console/OverviewTab";
import StockHealthTab from "../components/console/StockHealthTab";
import AlertsTab from "../components/console/AlertsTab";
import RecommendationsTab from "../components/console/RecommendationsTab";
import TimelineTab from "../components/console/TimelineTab";
import PolicyTab from "../components/console/PolicyTab";

const allTabs = [
  { key: "overview", label: "Visao Geral", icon: <MdDashboard /> },
  { key: "stockHealth", label: "Saude do Estoque", icon: <MdInventory /> },
  { key: "alerts", label: "Alertas", icon: <MdWarning /> },
  { key: "recommendations", label: "Recomendacoes", icon: <MdLightbulb /> },
  { key: "timeline", label: "Linha do Tempo", icon: <MdTimeline /> },
  { key: "policies", label: "Politicas", icon: <MdGavel /> },
];

const OperationalConsole = () => {
  const { can } = useCapabilities();
  const hasReadAccess = can("inventory", "read");

  // Filter tabs based on read permission
  // All inventory-related tabs require at least inventory:read
  const tabs = hasReadAccess
    ? allTabs
    : allTabs.filter((t) => t.key === "overview");

  const [activeTab, setActiveTab] = useState(tabs[0]?.key || "overview");

  useEffect(() => {
    document.title = "POS | Console Operacional";
  }, []);

  // Reset active tab if current one is filtered out
  useEffect(() => {
    if (!tabs.find((t) => t.key === activeTab)) {
      setActiveTab(tabs[0]?.key || "overview");
    }
  }, [tabs, activeTab]);

  return (
    <div className="bg-[#1f1f1f] min-h-[calc(100vh-5rem)]">
      <div className="container mx-auto py-8 px-6 md:px-4">
        <h1 className="text-[#f5f5f5] text-2xl font-bold mb-6">
          Console Operacional
        </h1>

        {!hasReadAccess ? (
          <div className="bg-[#1a1a1a] rounded-xl p-8 text-center">
            <p className="text-[#ababab] text-sm">
              Voce nao tem permissao para visualizar o Console Operacional.
              Contate o administrador.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-6">
              {tabs.map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                    activeTab === key
                      ? "bg-[#262626] text-[#f5f5f5]"
                      : "bg-[#1a1a1a] text-[#ababab] hover:bg-[#262626] hover:text-[#f5f5f5]"
                  }`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>

            <div className="bg-[#111] rounded-xl p-6">
              {activeTab === "overview" && <OverviewTab />}
              {activeTab === "stockHealth" && <StockHealthTab />}
              {activeTab === "alerts" && <AlertsTab />}
              {activeTab === "recommendations" && <RecommendationsTab />}
              {activeTab === "timeline" && <TimelineTab />}
              {activeTab === "policies" && <PolicyTab />}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OperationalConsole;
