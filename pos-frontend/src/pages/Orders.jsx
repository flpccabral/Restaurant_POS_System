import React, { useState, useEffect, useMemo } from 'react';
import BackButton from '../components/shared/BackButton';
import PdvFooterActions from '../components/pdv/PdvFooterActions';
import OrderCard from '../components/orders/OrderCard';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getOrders } from '../https/index';
import { enqueueSnackbar } from 'notistack';

const Orders = () => {
  const [status, setStatus] = useState('all');

  // Local date (Brazil) as YYYY-MM-DD — NOT UTC
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const [selectedDate, setSelectedDate] = useState(today);

  useEffect(() => {
    document.title = 'POS | Pedidos';
  }, []);

  const { data: resData, isError } = useQuery({
    queryKey: ['orders', selectedDate],
    queryFn: async () => {
      return await getOrders({ date: selectedDate });
    },
    placeholderData: keepPreviousData,
  });

  if (isError) {
    enqueueSnackbar('Algo deu errado!', { variant: 'error' });
  }

  const STATUS_FILTER_MAP = {
    all: null,
    progress: ['In Progress', 'Preparing', 'pending', 'accepted', 'preparing'],
    ready: ['Ready', 'done'],
    completed: ['completed', 'Completed', 'paid'],
  };

  const filteredOrders = (() => {
    const orders = resData?.data.data || [];
    const matchStatuses = STATUS_FILTER_MAP[status];
    if (!matchStatuses) return orders;
    return orders.filter((order) => matchStatuses.includes(order.orderStatus));
  })();

  const tabs = [
    { key: 'all', label: 'Todos' },
    { key: 'progress', label: 'Em Preparo' },
    { key: 'ready', label: 'Pronto' },
    { key: 'completed', label: 'Concluido' },
  ];

  return (
    <section className="h-[calc(100vh-3.5rem)] bg-gray-100 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <h1 className="text-gray-900 text-xl font-bold tracking-tight">
              Pedidos
            </h1>
          </div>
          {/* Filter tabs + Date picker */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatus(tab.key)}
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                    status === tab.key
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Orders list */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredOrders.length > 0 ? (
          <div className="flex flex-wrap gap-4">
            {filteredOrders.map((order) => (
              <OrderCard key={order._id} order={order} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-48">
            <p className="text-gray-400 text-sm">Nenhum pedido disponivel</p>
          </div>
        )}
      </div>

      <PdvFooterActions />
    </section>
  );
};

export default Orders;
