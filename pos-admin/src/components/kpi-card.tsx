import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  color?: string;
}

export function KpiCard({ title, value, icon: Icon, trend, color = "text-brand" }: KpiCardProps) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-400">{title}</p>
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
            {trend && (
              <p className={`text-xs mt-1 ${trend.positive ? "text-emerald-400" : "text-red-400"}`}>
                {trend.positive ? "↑" : "↓"} {trend.value} vs last period
              </p>
            )}
          </div>
          <div className={`p-3 rounded-lg bg-zinc-800 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
