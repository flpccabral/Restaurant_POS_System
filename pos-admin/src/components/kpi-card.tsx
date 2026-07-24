import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  color?: string;
}

/**
 * Maps text color classes to subtle icon container backgrounds.
 */
const iconBgMap: Record<string, string> = {
  "text-brand": "bg-brand-muted",
  "text-success": "bg-success/10",
  "text-warning": "bg-warning/10",
  "text-critical": "bg-critical/10",
  "text-info": "bg-info/10",
};

export function KpiCard({ title, value, icon: Icon, trend, color = "text-brand" }: KpiCardProps) {
  // Derive the CSS variable name from the color prop (e.g. "text-brand" -> "brand")
  const colorName = color.replace("text-", "");
  const cssVar = `var(--${colorName})`;
  const iconBgClass = iconBgMap[color] || "bg-brand-muted";

  return (
    <Card className="group/card relative overflow-hidden">
      {/* Colored top accent bar — gives each KPI card a scannable visual identity */}
      <span
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ backgroundColor: cssVar, opacity: 0.6 }}
      />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 min-w-0">
            <p className="text-sm text-muted-foreground font-medium leading-tight">{title}</p>
            <p className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {value}
            </p>
            {trend && (
              <div
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5",
                  trend.positive
                    ? "text-success bg-success/10"
                    : "text-critical bg-critical/10"
                )}
              >
                {trend.positive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span className="truncate">{trend.value}</span>
              </div>
            )}
          </div>
          <div className={cn(
            "flex items-center justify-center w-11 h-11 rounded-xl shrink-0",
            iconBgClass
          )}>
            <Icon className={cn("h-5 w-5", color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
