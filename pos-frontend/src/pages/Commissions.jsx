import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAttendants, getAttendantCommission } from '../https';
import { FiDownload, FiUsers, FiDollarSign, FiCalendar } from 'react-icons/fi';

const Commissions = () => {
  useEffect(() => {
    document.title = 'POS | Comissões';
  }, []);

  const [period, setPeriod] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [commissions, setCommissions] = useState([]);

  // Buscar lista de garçons
  const { data: attendantsData, isLoading: loadingAttendants } = useQuery({
    queryKey: ['attendants'],
    queryFn: () => getAttendants({ includeCommission: true }),
  });

  // Buscar comissões de cada garçom
  useEffect(() => {
    const fetchCommissions = async () => {
      if (!attendantsData?.data?.data) return;

      const attendants = attendantsData.data.data;
      const commissionPromises = attendants.map(async (attendant) => {
        try {
          const params = period === 'range' ? { period, start: startDate, end: endDate } : { period };
          const response = await getAttendantCommission(attendant._id, params);
          return {
            attendant,
            commission: response.data?.data || null,
          };
        } catch (error) {
          console.error(`Erro ao buscar comissão de ${attendant.name}:`, error);
          return { attendant, commission: null };
        }
      });

      const results = await Promise.all(commissionPromises);
      setCommissions(results);
    };

    fetchCommissions();
  }, [attendantsData, period, startDate, endDate]);

  // Calcular totais
  const totalSales = commissions.reduce((sum, c) => sum + (c.commission?.totalSales || 0), 0);
  const totalCommission = commissions.reduce((sum, c) => sum + (c.commission?.commissionValue || 0), 0);
  const totalOrders = commissions.reduce((sum, c) => sum + (c.commission?.totalOrders || 0), 0);

  // Exportar CSV
  const exportCSV = () => {
    const headers = ['Nome', 'Email', 'Taxa Comissão', 'Total Vendas', 'Total Pedidos', 'Comissão'];
    const rows = commissions.map(c => [
      c.attendant.name,
      c.attendant.email,
      `${c.commission?.commissionRate || 0}%`,
      `R$ ${(c.commission?.totalSales || 0).toFixed(2)}`,
      c.commission?.totalOrders || 0,
      `R$ ${(c.commission?.commissionValue || 0).toFixed(2)}`,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `comissoes_${period}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loadingAttendants) {
    return (
      <div className="h-[calc(100vh-3.5rem)] bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Carregando comissões...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-gray-100 overflow-y-auto">
      <div className="container mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard de Comissões</h1>
            <p className="text-sm text-gray-500 mt-1">Acompanhe o desempenho e comissões dos garçons</p>
          </div>
          <button
            onClick={exportCSV}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 shadow-sm transition-colors"
          >
            <FiDownload />
            Exportar CSV
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <FiCalendar className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Período</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { value: 'today', label: 'Hoje' },
              { value: 'week', label: 'Esta Semana' },
              { value: 'month', label: 'Este Mês' },
              { value: 'range', label: 'Personalizado' },
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setPeriod(option.value)}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  period === option.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {period === 'range' && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className="text-xs text-gray-500 font-semibold">Data Inicial</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold">Data Final</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-blue-100 p-2 rounded-lg">
                <FiDollarSign className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold">Total de Vendas</p>
                <p className="text-2xl font-bold text-gray-900">R$ {totalSales.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-emerald-100 p-2 rounded-lg">
                <FiDollarSign className="text-emerald-600" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold">Total de Comissões</p>
                <p className="text-2xl font-bold text-gray-900">R$ {totalCommission.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-purple-100 p-2 rounded-lg">
                <FiUsers className="text-purple-600" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold">Total de Pedidos</p>
                <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico Simples */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Comissões por Garçom</h2>
          <div className="space-y-3">
            {commissions.map((c, idx) => {
              const percentage = totalCommission > 0 ? (c.commission?.commissionValue / totalCommission) * 100 : 0;
              return (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-32 text-sm font-semibold text-gray-700 truncate">
                    {c.attendant.name}
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full flex items-center justify-end px-2"
                      style={{ width: `${Math.max(percentage, 5)}%` }}
                    >
                      {percentage > 15 && (
                        <span className="text-xs text-white font-semibold">
                          {percentage.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-24 text-right text-sm font-bold text-gray-900">
                    R$ {(c.commission?.commissionValue || 0).toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabela de Comissões */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700">Detalhamento por Garçom</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Garçom
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Taxa
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Vendas
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Pedidos
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Comissão
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {commissions.map((c, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {c.attendant.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{c.attendant.name}</div>
                          <div className="text-xs text-gray-500">{c.attendant.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {c.commission?.commissionRate || 0}%
                    </td>
                    <td className="px-5 py-4 text-sm text-right font-semibold text-gray-900">
                      R$ {(c.commission?.totalSales || 0).toFixed(2)}
                    </td>
                    <td className="px-5 py-4 text-sm text-right text-gray-700">
                      {c.commission?.totalOrders || 0}
                    </td>
                    <td className="px-5 py-4 text-sm text-right">
                      <span className="font-bold text-emerald-600">
                        R$ {(c.commission?.commissionValue || 0).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td className="px-5 py-4 text-sm font-bold text-gray-900" colSpan={2}>
                    TOTAL
                  </td>
                  <td className="px-5 py-4 text-sm text-right font-bold text-gray-900">
                    R$ {totalSales.toFixed(2)}
                  </td>
                  <td className="px-5 py-4 text-sm text-right font-bold text-gray-900">
                    {totalOrders}
                  </td>
                  <td className="px-5 py-4 text-sm text-right font-bold text-emerald-600">
                    R$ {totalCommission.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Commissions;
