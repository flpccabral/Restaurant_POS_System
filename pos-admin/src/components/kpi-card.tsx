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

export function KpiCard({ title, value, icon: Icon, trend, color = "text-brand" }: KpiCardProps) {
  return (
    <Card className="group/card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
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
                {trend.value}
              </div>
            )}
          </div>
          <div className={cn(
            "flex items-center justify-center w-11 h-11 rounded-xl shrink-0",
            "bg-brand-muted"
          )}>
            <Icon className={cn("h-5 w-5", color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
