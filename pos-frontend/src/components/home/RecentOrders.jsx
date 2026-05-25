import React from 'react';
import { FiSearch } from 'react-icons/fi';
import OrderList from './OrderList';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { getOrders } from '../../https/index';

const RecentOrders = () => {
  const { data: resData, isError } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      return await getOrders();
    },
    placeholderData: keepPreviousData,
  });

  if (isError) {
    enqueueSnackbar('Algo deu errado!', { variant: 'error' });
  }

  const orders = resData?.data.data || [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-gray-900 text-lg font-bold tracking-tight">
          Pedidos Recentes
        </h2>
        <a href="/orders" className="text-blue-600 text-sm font-semibold hover:text-blue-800 transition-colors">
          Ver todos
        </a>
      </div>

      <div className="px-5 py-3">
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
          <FiSearch className="text-gray-400 flex-shrink-0" size={16} />
          <input
            type="text"
            placeholder="Buscar pedidos recentes"
            className="bg-transparent outline-none text-gray-900 text-sm w-full placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Order list */}
      <div className="px-3 pb-3 max-h-[300px] overflow-y-auto scrollbar-hide">
        {orders.length > 0 ? (
          orders.map((order) => <OrderList key={order._id} order={order} />)
        ) : (
          <p className="text-gray-400 text-sm text-center py-8">
            Nenhum pedido disponivel
          </p>
        )}
      </div>
    </div>
  );
};

export default RecentOrders;
