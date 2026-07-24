"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  Package,
  TrendingUp,
  Building2,
  Receipt,
  PiggyBank,
  CalendarDays,
  ArrowRightLeft,
  Utensils,
  Layers,
} from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { dashboardService } from "@/services/api/dashboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { StatsGridSkeleton, TableSkeleton } from "@/components/ui/skeleton-loaders";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const periods = [
  { label: "Hoje", value: "today" },
  { label: "Últimos 7 dias", value: "7days" },
  { label: "Últimos 30 dias", value: "30days" },
  { label: "Esta semana", value: "this_week" },
  { label: "Este mês", value: "this_month" },
];

const chartTooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--popover-foreground)",
  fontSize: "13px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
} as const;

export default function DashboardPage() {
  const [period, setPeriod] = useState("today");

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["dashboard-kpis", period],
    queryFn: () => dashboardService.getKPIs(period).then((r) => r.data.data),
  });

  const { data: topProducts } = useQuery({
    queryKey: ["top-products", period],
    queryFn: () =>
      dashboardService.getTopProducts(5, period).then((r) => r.data.data),
  });

  const { data: salesReport } = useQuery({
    queryKey: ["sales-report", period],
    queryFn: () =>
      dashboardService.getSalesReport(period, "day").then((r) => r.data.data),
  });

  const { data: inventory } = useQuery({
    queryKey: ["inventory-analytics"],
    queryFn: () => dashboardService.getInventoryAnalytics().then((r) => r.data.data),
  });

  const { data: cmv } = useQuery({
    queryKey: ["cmv", period],
    queryFn: () => dashboardService.getCMV(period).then((r) => r.data.data),
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const alertsCount = kpis?.operational.activeAlerts || 0;
  const outOfStock = inventory?.outOfStock || 0;
  const belowMinimum = inventory?.belowMinimum || 0;
  const netRevenue = kpis?.revenue?.net || 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 relative">
      {/* Decorative glow constrained to viewport to avoid mobile overflow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[280px] bg-brand/5 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Page Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="relative">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              Visão geral da operação
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Acompanhe faturamento, pedidos, estoque e custos em tempo real
            </p>
          </div>
          <Select value={period} onValueChange={(v) => v && setPeriod(v)}>
            <SelectTrigger className="w-full sm:w-44 [&_span]:truncate [&_span]:block [&_span]:max-w-full min-w-0">
              <CalendarDays className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
              <span className="flex-1 truncate text-left">{periods.find((p) => p.value === period)?.label}</span>
            </SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Operational summary block */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="bg-muted/40 border-border/60">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-brand-muted shrink-0">
                <DollarSign className="h-4 w-4 text-brand" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Faturamento líquido</p>
                <p className="text-sm font-semibold text-foreground">{formatCurrency(netRevenue)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/40 border-border/60">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-info/10 shrink-0">
                <Layers className="h-4 w-4 text-info" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Produtos ativos</p>
                <p className="text-sm font-semibold text-foreground">
                  {kpis?.operational.activeProducts || 0}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/40 border-border/60">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${alertsCount > 0 ? "bg-critical/10" : "bg-success/10"}`}>
                <AlertTriangle className={`h-4 w-4 ${alertsCount > 0 ? "text-critical" : "text-success"}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Alertas de estoque</p>
                <p className="text-sm font-semibold text-foreground">{alertsCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/40 border-border/60">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-warning/10 shrink-0">
                <ArrowRightLeft className="h-4 w-4 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Período selecionado</p>
                <p className="text-sm font-semibold text-foreground">
                  {periods.find((p) => p.value === period)?.label}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* KPI Row */}
      {kpisLoading ? (
        <StatsGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <>
            <KpiCard
              title="Faturamento"
              value={formatCurrency(kpis?.revenue?.gross || 0)}
              icon={DollarSign}
              trend={{
                value: `Líquido: ${formatCurrency(netRevenue)}`,
                positive: netRevenue > 0,
              }}
            />
            <KpiCard
              title="Pedidos"
              value={kpis?.orders?.count || 0}
              icon={ShoppingCart}
              trend={{
                value: `Ticket médio: ${formatCurrency(kpis?.orders?.avgTicket || 0)}`,
                positive: true,
              }}
            />
            <KpiCard
              title="Produtos Ativos"
              value={kpis?.operational.activeProducts || 0}
              icon={Package}
              color="text-info"
            />
            <KpiCard
              title="Alertas de Estoque"
              value={alertsCount}
              icon={AlertTriangle}
              color={alertsCount > 0 ? "text-critical" : "text-success"}
              trend={{
                value: alertsCount > 0 ? `${alertsCount} itens atenção` : "Estoque ok",
                positive: alertsCount === 0,
              }}
            />
          </>
        </div>
      )}

      {/* Secondary Metric Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="h-4 w-4 text-brand" />
              Valor em Estoque
            </CardTitle>
            <CardDescription>Valor total do inventário</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {inventory ? formatCurrency(inventory.totalValue || 0) : "—"}
            </p>
            <div className="flex flex-wrap gap-3 mt-3">
              <span className="text-xs text-muted-foreground">
                <span className="text-critical font-medium">{outOfStock}</span> sem estoque
              </span>
              <span className="text-xs text-muted-foreground">
                <span className="text-warning font-medium">{belowMinimum}</span> abaixo do mínimo
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <PiggyBank className="h-4 w-4 text-brand" />
              CMV (Custo Merc. Vendida)
            </CardTitle>
            <CardDescription>Custo total das mercadorias vendidas</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {cmv ? formatCurrency(cmv.cmv?.total || 0) : "—"}
            </p>
            <div className="flex flex-wrap gap-3 mt-3">
              <span className="text-xs text-muted-foreground">
                CMV: <span className="text-foreground/70 font-medium">{cmv?.cmv?.percent || 0}%</span>
              </span>
              <span className="text-xs text-muted-foreground">
                Margem: <span className="text-success font-medium">{cmv?.margin?.gross || 0}%</span>
              </span>
            </div>
            {cmv?.classification && (
              <span className={`inline-block mt-3 text-xs px-2.5 py-1 rounded-full font-medium ${
                cmv.classification.color === "green" ? "bg-success/10 text-success" :
                cmv.classification.color === "yellow" ? "bg-warning/10 text-warning" :
                "bg-critical/10 text-critical"
              }`}>
                {cmv.classification.level
                  .replace("_", " ")
                  .toUpperCase()
                  .replace(/ATENCAO/g, "ATENÇÃO")}
              </span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Receipt className="h-4 w-4 text-brand" />
              Impostos
            </CardTitle>
            <CardDescription>Total de impostos arrecadados</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {kpis ? formatCurrency(kpis.revenue?.tax || 0) : "—"}
            </p>
            <div className="flex flex-wrap gap-3 mt-3">
              <span className="text-xs text-muted-foreground">
                Líquido: <span className="text-foreground/70 font-medium">
                  {kpis ? formatCurrency(netRevenue) : "—"}
                </span>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 font-semibold">
              <TrendingUp className="h-4 w-4 text-brand" />
              Tendência de Faturamento
            </CardTitle>
            <CardDescription>Evolutivo de faturamento por dia no período</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {salesReport?.sales && salesReport.sales.length > 0 ? (
              <div className="h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesReport.sales} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${Number(v).toLocaleString("pt-BR")}`} />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value) => formatCurrency(Number(value))}
                      labelStyle={{ color: "var(--muted-foreground)" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--brand)"
                      strokeWidth={2.5}
                      dot={{ fill: "var(--brand)", strokeWidth: 2, r: 3 }}
                      activeDot={{ fill: "var(--brand)", strokeWidth: 2, r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 sm:h-72 gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-8 w-8 text-muted-foreground/40" />
                Sem dados de vendas neste período
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Products Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 font-semibold">
              <Utensils className="h-4 w-4 text-brand" />
              Produtos Mais Vendidos
            </CardTitle>
            <CardDescription>Ranking por faturamento no período</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {topProducts?.products && topProducts.products.length > 0 ? (
              <div className="h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts.products} barCategoryGap="20%" margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="productName" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} interval={0} angle={0} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${Number(v).toLocaleString("pt-BR")}`} />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value) => formatCurrency(Number(value))}
                      labelStyle={{ color: "var(--muted-foreground)" }}
                    />
                    <Bar dataKey="totalRevenue" fill="var(--brand)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 sm:h-72 gap-2 text-sm text-muted-foreground">
                <Utensils className="h-8 w-8 text-muted-foreground/40" />
                Sem dados de produtos neste período
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top Products Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Utensils className="h-4 w-4 text-brand" />
              Produtos Mais Vendidos
            </CardTitle>
            <CardDescription>Quantidade e faturamento por produto</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pt-0">
            {topProducts?.products ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Faturamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topProducts.products.map((p: { productName: string; totalQuantity: number; totalRevenue: number }, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-foreground/90 min-w-[120px]">{p.productName}</TableCell>
                        <TableCell className="text-right text-foreground/70">{p.totalQuantity}</TableCell>
                        <TableCell className="text-right text-foreground/90 font-medium">{formatCurrency(p.totalRevenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-4">
                <TableSkeleton rows={4} columns={3} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inventory Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-brand" />
              Estoque por Categoria
            </CardTitle>
            <CardDescription>Distribuição de itens e valor</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pt-0">
            {inventory?.categoryBreakdown ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Itens</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(inventory.categoryBreakdown as Record<string, { count: number; value: number }>).map(([category, data]) => (
                      <TableRow key={category}>
                        <TableCell className="font-medium text-foreground/90 min-w-[120px]">{category}</TableCell>
                        <TableCell className="text-right text-foreground/70">{data.count}</TableCell>
                        <TableCell className="text-right text-foreground/90 font-medium">{formatCurrency(data.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-4">
                <TableSkeleton rows={4} columns={3} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
