import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPayments } from '../../https';
import { FiDollarSign, FiCreditCard, FiSmartphone, FiGift, FiUsers } from 'react-icons/fi';

const Payments = () => {
  const navigate = useNavigate();
  const [limit, setLimit] = useState(50);

  const { data, isLoading, error } = useQuery({
    queryKey: ['payments', limit],
    queryFn: () => getPayments({ limit }),
  });

  const payments = data?.data?.data?.payments || [];
  const totalAmount = data?.data?.data?.totalAmount || 0;
  const totalsByMethod = data?.data?.data?.totalsByMethod || {};

  const getMethodIcon = (method) => {
    switch (method) {
      case 'cash':
        return <FiDollarSign className="text-emerald-600" size={20} />;
      case 'pix':
        return <FiSmartphone className="text-blue-600" size={20} />;
      case 'credit_card':
        return <FiCreditCard className="text-purple-600" size={20} />;
      case 'debit_card':
        return <FiCreditCard className="text-orange-600" size={20} />;
      case 'voucher':
        return <FiGift className="text-gray-600" size={20} />;
      default:
        return <FiDollarSign className="text-gray-400" size={20} />;
    }
  };

  const getMethodLabel = (method) => {
    const labels = {
      cash: 'Dinheiro',
      pix: 'PIX',
      credit_card: 'Cartão de Crédito',
      debit_card: 'Cartão de Débito',
      voucher: 'Voucher',
    };
    return labels[method] || method;
  };

  const getMethodColor = (method) => {
    const colors = {
      cash: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      pix: 'bg-blue-100 text-blue-700 border-blue-200',
      credit_card: 'bg-purple-100 text-purple-700 border-purple-200',
      debit_card: 'bg-orange-100 text-orange-700 border-orange-200',
      voucher: 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return colors[method] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="text-center text-gray-500">Carregando pagamentos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="text-center text-red-500">Erro ao carregar pagamentos</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ações Rápidas */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Ações Rápidas</h2>
            <p className="text-sm text-gray-500">Operações relacionadas a pagamentos</p>
          </div>
          <button
            onClick={() => navigate('/tables')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2"
          >
            <FiUsers size={18} />
            Dividir Conta
          </button>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            💡 <strong>Divisão de Conta:</strong> Selecione uma mesa ocupada para dividir o pagamento entre clientes
          </p>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Resumo de Pagamentos</h2>

        {/* Total Geral */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 mb-6">
          <p className="text-blue-100 text-sm font-semibold mb-1">Total Recebido</p>
          <p className="text-white text-3xl font-bold">R$ {totalAmount.toFixed(2)}</p>
          <p className="text-blue-100 text-sm mt-2">{payments.length} pagamento(s)</p>
        </div>

        {/* Totais por Método */}
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Por Método de Pagamento</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(totalsByMethod).map(([method, info]) => (
            <div
              key={method}
              className={`rounded-lg p-4 border ${getMethodColor(method)}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {getMethodIcon(method)}
                <span className="text-sm font-semibold">{getMethodLabel(method)}</span>
              </div>
              <p className="text-2xl font-bold mb-1">R$ {info.total.toFixed(2)}</p>
              <p className="text-xs opacity-75">{info.count} pagamento(s)</p>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de Pagamentos */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Pagamentos Recentes</h2>
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value))}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={10}>10 últimos</option>
            <option value={25}>25 últimos</option>
            <option value={50}>50 últimos</option>
            <option value={100}>100 últimos</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Data/Hora
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Pedido
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Método
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {new Date(payment.createdAt).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {payment.order?.orderNumber || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {payment.order?.customerDetails?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getMethodIcon(payment.method)}
                      <span className="text-sm text-gray-700">
                        {getMethodLabel(payment.method)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">
                    R$ {(payment.amount || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        payment.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : payment.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {payment.status === 'approved'
                        ? 'Aprovado'
                        : payment.status === 'pending'
                        ? 'Pendente'
                        : payment.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {payments.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500">
            Nenhum pagamento encontrado
          </div>
        )}
      </div>
    </div>
  );
};

export default Payments;
