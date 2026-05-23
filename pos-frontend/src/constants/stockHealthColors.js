/**
 * Stock Health status colors and labels (Phase 7A).
 *
 * Used by StatusBadge and tab components to render consistent
 * color-coded badges for stock health statuses and alert severities.
 */

export const STATUS_CONFIG = {
  stockout: { bg: "bg-[#4a1a1a]", text: "text-[#ff6b6b]", label: "Ruptura" },
  critical: { bg: "bg-[#4a2a1a]", text: "text-[#ff9f43]", label: "Crítico" },
  low: { bg: "bg-[#4a4a1a]", text: "text-[#feca57]", label: "Baixo" },
  excess: { bg: "bg-[#1a2a4a]", text: "text-[#54a0ff]", label: "Excesso" },
  no_policy: { bg: "bg-[#2a2a2a]", text: "text-[#ababab]", label: "Sem Política" },
  ok: { bg: "bg-[#1a3a1a]", text: "text-[#2ed573]", label: "Normal" },
};

export const SEVERITY_CONFIG = {
  critical: { bg: "bg-[#4a1a1a]", text: "text-[#ff6b6b]", label: "Crítico" },
  high: { bg: "bg-[#3a1a1a]", text: "text-[#ff6b6b]", label: "Alto" },
  medium: { bg: "bg-[#4a4a1a]", text: "text-[#feca57]", label: "Médio" },
  low: { bg: "bg-[#1a2a4a]", text: "text-[#54a0ff]", label: "Baixo" },
  info: { bg: "bg-[#2a2a2a]", text: "text-[#ababab]", label: "Info" },
};

export const getStatusConfig = (status) =>
  STATUS_CONFIG[status] || STATUS_CONFIG.no_policy;

export const getSeverityConfig = (severity) =>
  SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info;
