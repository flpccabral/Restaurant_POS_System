import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getDashboardKPIs,
  getProducts,
  getOrders,
  getTables,
  getCategories,
} from '../../https';

const Metrics = () => {
  const { data: kpiRes, isLoading: kpiLoading } = useQuery({
    queryKey: ['dashboardKpi'],
    queryFn: () => getDashboardKPIs({ period: '30days' }),
  });

  const { data: productsRes, isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => getProducts(),
  });

  const { data: ordersRes, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => getOrders(),
  });

  const { data: tablesRes, isLoading: tablesLoading } = useQuery({
    queryKey: ['tables'],
    queryFn: () => getTables(),
  });

  const { data: categoriesRes, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
  });

  const isLoading =
    kpiLoading || productsLoading || ordersLoading || tablesLoading || categoriesLoading;

  const kpi = kpiRes?.data?.data;
  const products = productsRes?.data?.data || [];
  const orders = ordersRes?.data?.data || [];
  const tables = tablesRes?.data?.data || [];
  const categories = categoriesRes?.data?.data || [];

  const inProgressOrders = orders.filter(
    (o) => o.orderStatus === 'In Progress'
  ).length;

  const formatCurrency = (value) =>
    `R$ ${Number(value || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const topMetrics = [
    {
      title: 'Receita',
      value: formatCurrency(kpi?.revenue?.gross),
      color: 'from-blue-600 to-blue-500',
    },
    {
      title: 'Pedidos',
      value: kpi?.orders?.count || 0,
      color: 'from-emerald-600 to-emerald-500',
    },
    {
      title: 'Ticket Medio',
      value: formatCurrency(kpi?.orders?.avgTicket),
      color: 'from-amber-500 to-amber-400',
    },
    {
      title: 'Alertas',
      value: kpi?.operational?.activeAlerts || 0,
      color: 'from-red-500 to-red-400',
    },
  ];

  const bottomMetrics = [
    {
      title: 'Total de Categorias',
      value: Array.isArray(categories) ? categories.length : 0,
      color: 'from-violet-600 to-violet-500',
    },
    {
      title: 'Total de Produtos',
      value: Array.isArray(products) ? products.length : 0,
      color: 'from-emerald-600 to-emerald-500',
    },
    {
      title: 'Pedidos em Andamento',
      value: inProgressOrders,
      color: 'from-amber-600 to-amber-500',
    },
    {
      title: 'Total de Mesas',
      value: Array.isArray(tables) ? tables.length : 0,
      color: 'from-rose-600 to-rose-500',
    },
  ];

  if (isLoading) {
    return (
      <div className="py-10 text-center">
        <p className="text-gray-400 text-sm">Carregando metricas...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Top section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Desempenho Geral</h2>
            <p className="text-sm text-gray-400">
              Resumo das metricas e indicadores de desempenho.
            </p>
          </div>
          <button className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors">
            Ultimos 30 Dias
            <svg className="w-3 h-3" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {topMetrics.map((metric, index) => (
            <div
              key={index}
              className={`bg-gradient-to-br ${metric.color} rounded-xl shadow-sm p-5 text-white`}
            >
              <p className="text-xs font-medium text-white/80 uppercase tracking-wider">
                {metric.title}
              </p>
              <p className="mt-2 font-bold text-2xl">{metric.value}</p>
              <div className="mt-2 flex items-center gap-1 text-[10px] text-white/70">
                <svg className="w-3 h-3" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" fill="none">
                  <path d="M5 15l7-7 7 7" />
                </svg>
                Periodo
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom section */}
      <div>
        <div className="mb-4">
          <h2 className="font-bold text-gray-900 text-lg">Detalhes dos Itens</h2>
          <p className="text-sm text-gray-400">
            Resumo das metricas e indicadores de desempenho.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {bottomMetrics.map((item, index) => (
            <div
              key={index}
              className={`bg-gradient-to-br ${item.color} rounded-xl shadow-sm p-5 text-white`}
            >
              <p className="text-xs font-medium text-white/80 uppercase tracking-wider">
                {item.title}
              </p>
              <p className="mt-2 font-bold text-2xl">{item.value}</p>
              <div className="mt-2 flex items-center gap-1 text-[10px] text-white/70">
                <svg className="w-3 h-3" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" fill="none">
                  <path d="M5 15l7-7 7 7" />
                </svg>
                Total
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Metrics;
