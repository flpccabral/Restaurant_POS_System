"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  Package,
  TrendingUp,
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
  { label: "Últimos 7 dias", value: "7days" },
  { label: "Últimos 30 dias", value: "30days" },
  { label: "Esta semana", value: "this_week" },
  { label: "Este mês", value: "this_month" },
];

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Visão geral do desempenho do restaurante
          </p>
        </div>
        <Select value={period} onValueChange={(v) => v && setPeriod(v)}>
          <SelectTrigger className="w-48 bg-zinc-800 border-zinc-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
            {periods.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpisLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 bg-zinc-900 border border-zinc-800" />
          ))
        ) : (
          <>
            <KpiCard
              title="Faturamento"
              value={formatCurrency(kpis?.revenue?.gross || 0)}
              icon={DollarSign}
              trend={{
                value: `Líquido: ${formatCurrency(kpis?.revenue?.net || 0)}`,
                positive: (kpis?.revenue?.net || 0) > 0,
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
              color="text-blue-500"
            />
            <KpiCard
              title="Alertas de Estoque"
              value={kpis?.operational.activeAlerts || 0}
              icon={AlertTriangle}
              color={(kpis?.operational.activeAlerts || 0) > 0 ? "text-red-500" : "text-emerald-500"}
            />
          </>
        )}
      </div>

      {/* Secondary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-200 text-sm">Valor em Estoque</CardTitle>
            <CardDescription>Valor total do inventário</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {inventory ? formatCurrency(inventory.totalValue || 0) : "—"}
            </p>
            <div className="flex gap-4 mt-3 text-xs text-zinc-400">
              <span>{inventory?.outOfStock || 0} sem estoque</span>
              <span>{inventory?.belowMinimum || 0} abaixo do mínimo</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-200 text-sm">CMV (Custo Merc. Vendida)</CardTitle>
            <CardDescription>Custo total das mercadorias vendidas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {cmv ? formatCurrency(cmv.cmv?.total || 0) : "—"}
            </p>
            <div className="flex gap-4 mt-3 text-xs text-zinc-400">
              <span>CMV: {cmv?.cmv?.percent || 0}%</span>
              <span>Margem: {cmv?.margin?.gross || 0}%</span>
            </div>
            {cmv?.classification && (
              <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full ${
                cmv.classification.color === "green" ? "bg-emerald-500/10 text-emerald-400" :
                cmv.classification.color === "yellow" ? "bg-yellow-500/10 text-yellow-400" :
                "bg-red-500/10 text-red-400"
              }`}>
                {cmv.classification.level.replace("_", " ").toUpperCase()}
              </span>
            )}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-200 text-sm">Impostos</CardTitle>
            <CardDescription>Total de impostos arrecadados</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {kpis ? formatCurrency(kpis.revenue?.tax || 0) : "—"}
            </p>
            <div className="flex gap-4 mt-3 text-xs text-zinc-400">
              <span>Líquido: {kpis ? formatCurrency(kpis.revenue?.net || 0) : "—"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-200 text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand" />
              Tendência de Faturamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salesReport?.sales && salesReport.sales.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={salesReport.sales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: "8px",
                      color: "#f4f4f5",
                    }}
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--brand)"
                    strokeWidth={2}
                    dot={{ fill: "var(--brand)", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-zinc-500 text-sm py-8 text-center">Sem dados de vendas neste período</p>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-200 text-sm">Produtos Mais Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts?.products && topProducts.products.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topProducts.products}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                  <XAxis dataKey="productName" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: "8px",
                      color: "#f4f4f5",
                    }}
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                  <Bar dataKey="totalRevenue" fill="var(--brand)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-zinc-500 text-sm py-8 text-center">Sem dados de produtos neste período</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent / Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products Table */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-200 text-sm">Produtos Mais Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts?.products ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800">
                    <TableHead className="text-zinc-400">Produto</TableHead>
                    <TableHead className="text-zinc-400 text-right">Qtd</TableHead>
                    <TableHead className="text-zinc-400 text-right">Faturamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.products.map((p: { productName: string; totalQuantity: number; totalRevenue: number }, i: number) => (
                    <TableRow key={i} className="border-zinc-800">
                      <TableCell className="text-zinc-300 font-medium">{p.productName}</TableCell>
                      <TableCell className="text-zinc-300 text-right">{p.totalQuantity}</TableCell>
                      <TableCell className="text-zinc-300 text-right">{formatCurrency(p.totalRevenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Skeleton className="h-32 w-full bg-zinc-800" />
            )}
          </CardContent>
        </Card>

        {/* Inventory Summary */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-200 text-sm">Estoque por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {inventory?.categoryBreakdown ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800">
                    <TableHead className="text-zinc-400">Categoria</TableHead>
                    <TableHead className="text-zinc-400 text-right">Itens</TableHead>
                    <TableHead className="text-zinc-400 text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(inventory.categoryBreakdown as Record<string, { count: number; value: number }>).map(([category, data]) => (
                    <TableRow key={category} className="border-zinc-800">
                      <TableCell className="text-zinc-300 font-medium">{category}</TableCell>
                      <TableCell className="text-zinc-300 text-right">{data.count}</TableCell>
                      <TableCell className="text-zinc-300 text-right">{formatCurrency(data.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Skeleton className="h-32 w-full bg-zinc-800" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
