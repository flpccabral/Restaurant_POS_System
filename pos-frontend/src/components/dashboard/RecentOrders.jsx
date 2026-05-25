import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { getOrders, updateOrderStatus } from '../../https/index';
import { formatDateAndTime } from '../../utils';

const RecentOrders = () => {
  const queryClient = useQueryClient();
  const handleStatusChange = ({ orderId, orderStatus }) => {
    orderStatusUpdateMutation.mutate({ orderId, orderStatus });
  };

  const orderStatusUpdateMutation = useMutation({
    mutationFn: ({ orderId, orderStatus }) =>
      updateOrderStatus({ orderId, orderStatus }),
    onSuccess: () => {
      enqueueSnackbar('Status do pedido atualizado com sucesso!', {
        variant: 'success',
      });
      queryClient.invalidateQueries(['orders']);
    },
    onError: () => {
      enqueueSnackbar('Falha ao atualizar status do pedido!', {
        variant: 'error',
      });
    },
  });

  const { data: resData, isError } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      return await getOrders();
    },
  });

  if (isError) {
    enqueueSnackbar('Algo deu errado!', { variant: 'error' });
  }

  const orders = resData?.data.data || [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-gray-900 text-lg font-bold">Pedidos Recentes</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="p-3 font-semibold">ID do Pedido</th>
              <th className="p-3 font-semibold">Cliente</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold">Data e Hora</th>
              <th className="p-3 font-semibold">Itens</th>
              <th className="p-3 font-semibold">Mesa</th>
              <th className="p-3 font-semibold">Total</th>
              <th className="p-3 font-semibold">Pagamento</th>
            </tr>
          </thead>
          <tbody className="text-gray-700">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-400">
                  Nenhum pedido encontrado
                </td>
              </tr>
            ) : (
              orders.map((order, index) => (
                <tr
                  key={index}
                  className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="p-3 font-medium text-gray-900">
                    #{Math.floor(new Date(order.orderDate).getTime()).toString().slice(-8)}
                  </td>
                  <td className="p-3">{order.customerDetails.name}</td>
                  <td className="p-3">
                    <select
                      className={`border border-gray-200 bg-white p-1.5 rounded-lg text-xs font-medium outline-none focus:border-blue-400 ${
                        order.orderStatus === 'Ready'
                          ? 'text-emerald-600'
                          : order.orderStatus === 'completed'
                          ? 'text-blue-600'
                          : order.orderStatus === 'cancelled'
                          ? 'text-red-500'
                          : 'text-amber-600'
                      }`}
                      value={order.orderStatus}
                      onChange={(e) =>
                        handleStatusChange({
                          orderId: order._id,
                          orderStatus: e.target.value,
                        })
                      }
                    >
                      <option className="text-amber-600" value="In Progress">
                        Em Preparo
                      </option>
                      <option className="text-emerald-600" value="Ready">
                        Pronto
                      </option>
                      <option className="text-blue-600" value="completed">
                        Concluido
                      </option>
                      <option className="text-red-500" value="cancelled">
                        Cancelado
                      </option>
                    </select>
                  </td>
                  <td className="p-3 text-gray-500 text-xs">
                    {formatDateAndTime(order.orderDate)}
                  </td>
                  <td className="p-3">{order.items.length} Itens</td>
                  <td className="p-3">Mesa - {order.table?.tableNo || 'Balcao'}</td>
                  <td className="p-3 font-semibold text-gray-900">
                    R${(order.bills?.totalWithTax || 0).toFixed(2)}
                  </td>
                  <td className="p-3">
                    <span className="bg-gray-100 text-gray-600 text-[11px] px-2 py-1 rounded-full font-medium">
                      {order.paymentMethod || '—'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentOrders;
