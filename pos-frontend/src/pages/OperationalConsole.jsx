import React, { useState, useEffect } from "react";
import { MdDashboard, MdInventory, MdWarning, MdLightbulb, MdTimeline } from "react-icons/md";
import OverviewTab from "../components/console/OverviewTab";
import StockHealthTab from "../components/console/StockHealthTab";
import AlertsTab from "../components/console/AlertsTab";
import RecommendationsTab from "../components/console/RecommendationsTab";
import TimelineTab from "../components/console/TimelineTab";

const tabs = [
  { key: "overview", label: "Visão Geral", icon: <MdDashboard /> },
  { key: "stockHealth", label: "Saúde do Estoque", icon: <MdInventory /> },
  { key: "alerts", label: "Alertas", icon: <MdWarning /> },
  { key: "recommendations", label: "Recomendações", icon: <MdLightbulb /> },
  { key: "timeline", label: "Timeline", icon: <MdTimeline /> },
];

const OperationalConsole = () => {
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    document.title = "POS | Console Operacional";
  }, []);

  return (
    <div className="bg-[#1f1f1f] min-h-[calc(100vh-5rem)]">
      <div className="container mx-auto py-8 px-6 md:px-4">
        <h1 className="text-[#f5f5f5] text-2xl font-bold mb-6">
          Console Operacional
        </h1>

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
        </div>
      </div>
    </div>
  );
};

export default OperationalConsole;
