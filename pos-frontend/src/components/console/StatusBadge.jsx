import React from "react";
import { getStatusConfig, getSeverityConfig } from "../../constants/stockHealthColors";

const StatusBadge = ({ type = "status", value, size = "sm" }) => {
  const config = type === "severity" ? getSeverityConfig(value) : getStatusConfig(value);
  const sizeClasses = size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses} ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
};

export default StatusBadge;
