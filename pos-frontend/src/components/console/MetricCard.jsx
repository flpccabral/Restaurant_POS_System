import React from "react";

const MetricCard = ({ label, value, unit = "", icon, color = "text-[#f5f5f5]" }) => (
  <div className="bg-[#1a1a1a] rounded-lg p-4 flex items-center gap-3">
    {icon && <span className="text-2xl">{icon}</span>}
    <div>
      <p className="text-xs text-[#ababab] uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>
        {value}
        {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
      </p>
    </div>
  </div>
);

export default MetricCard;
