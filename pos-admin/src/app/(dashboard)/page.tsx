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
} from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { StatusBadge } from "@/components/status-badge";
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
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
  { label: "Ultimos 7 dias", value: "7days" },
  { label: "Ultimos 30 dias", value: "30days" },
  { label: "Esta semana", value: "this_week" },
  { label: "Este mes", value: "this_month" },
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

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Visao geral do desempenho operacional
          </p>
        </div>
        <Select value={period} onValueChange={(v) => v && setPeriod(v)}>
          <SelectTrigger className="w-44">
            <SelectValue />
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

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpisLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-xl" />
          ))
        ) : (
          <>
            <KpiCard
              title="Faturamento"
              value={formatCurrency(kpis?.revenue?.gross || 0)}
              icon={DollarSign}
              trend={{
                value: `Liquido: ${formatCurrency(kpis?.revenue?.net || 0)}`,
                positive: (kpis?.revenue?.net || 0) > 0,
              }}
            />
            <KpiCard
              title="Pedidos"
              value={kpis?.orders?.count || 0}
              icon={ShoppingCart}
              trend={{
                value: `Ticket medio: ${formatCurrency(kpis?.orders?.avgTicket || 0)}`,
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
              value={kpis?.operational.activeAlerts || 0}
              icon={AlertTriangle}
              color={(kpis?.operational.activeAlerts || 0) > 0 ? "text-critical" : "text-success"}
            />
          </>
        )}
      </div>

      {/* Secondary Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-brand" />
              Valor em Estoque
            </CardTitle>
            <CardDescription>Valor total do inventario</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground tracking-tight">
              {inventory ? formatCurrency(inventory.totalValue || 0) : "—"}
            </p>
            <div className="flex gap-4 mt-3">
              <span className="text-xs text-muted-foreground">
                <span className="text-critical font-medium">{inventory?.outOfStock || 0}</span> sem estoque
              </span>
              <span className="text-xs text-muted-foreground">
                <span className="text-warning font-medium">{inventory?.belowMinimum || 0}</span> abaixo do minimo
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <PiggyBank className="h-4 w-4 text-brand" />
              CMV (Custo Merc. Vendida)
            </CardTitle>
            <CardDescription>Custo total das mercadorias vendidas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground tracking-tight">
              {cmv ? formatCurrency(cmv.cmv?.total || 0) : "—"}
            </p>
            <div className="flex gap-4 mt-3">
              <span className="text-xs text-muted-foreground">
                CMV: <span className="text-foreground/70 font-medium">{cmv?.cmv?.percent || 0}%</span>
              </span>
              <span className="text-xs text-muted-foreground">
                Margem: <span className="text-success font-medium">{cmv?.margin?.gross || 0}%</span>
              </span>
            </div>
            {cmv?.classification && (
              <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${
                cmv.classification.color === "green" ? "bg-success/10 text-success" :
                cmv.classification.color === "yellow" ? "bg-warning/10 text-warning" :
                "bg-critical/10 text-critical"
              }`}>
                {cmv.classification.level.replace("_", " ").toUpperCase()}
              </span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Receipt className="h-4 w-4 text-brand" />
              Impostos
            </CardTitle>
            <CardDescription>Total de impostos arrecadados</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground tracking-tight">
              {kpis ? formatCurrency(kpis.revenue?.tax || 0) : "—"}
            </p>
            <div className="flex gap-4 mt-3">
              <span className="text-xs text-muted-foreground">
                Liquido: <span className="text-foreground/70 font-medium">
                  {kpis ? formatCurrency(kpis.revenue?.net || 0) : "—"}
                </span>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand" />
              Tendencia de Faturamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salesReport?.sales && salesReport.sales.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={salesReport.sales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
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
            ) : (
              <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
                Sem dados de vendas neste periodo
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Products Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Produtos Mais Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts?.products && topProducts.products.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topProducts.products} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="productName" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value) => formatCurrency(Number(value))}
                    labelStyle={{ color: "var(--muted-foreground)" }}
                  />
                  <Bar dataKey="totalRevenue" fill="var(--brand)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
                Sem dados de produtos neste periodo
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Produtos Mais Vendidos</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {topProducts?.products ? (
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
                      <TableCell className="font-medium text-foreground/90">{p.productName}</TableCell>
                      <TableCell className="text-right text-foreground/70">{p.totalQuantity}</TableCell>
                      <TableCell className="text-right text-foreground/90 font-medium">{formatCurrency(p.totalRevenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="px-4">
                <Skeleton className="h-32 w-full" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inventory Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Estoque por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {inventory?.categoryBreakdown ? (
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
                      <TableCell className="font-medium text-foreground/90">{category}</TableCell>
                      <TableCell className="text-right text-foreground/70">{data.count}</TableCell>
                      <TableCell className="text-right text-foreground/90 font-medium">{formatCurrency(data.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="px-4">
                <Skeleton className="h-32 w-full" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
