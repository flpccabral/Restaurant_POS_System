import { useState, useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/shared/BackButton';
import PdvFooterActions from '../components/pdv/PdvFooterActions';
import OrderCard from '../components/orders/OrderCard';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getOrders } from '../https/index';
import { enqueueSnackbar } from 'notistack';
import { FiPlus } from 'react-icons/fi';
import { removeCustomer, setOrderType } from '../redux/slices/customerSlice';
import { useCapabilities } from '../hooks/useCapabilities';

const Orders = () => {
  const [status, setStatus] = useState('all');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { can } = useCapabilities();

  // Local date (Brazil) as YYYY-MM-DD — NOT UTC
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const [selectedDate, setSelectedDate] = useState(today);

  useEffect(() => {
    document.title = 'POS | Comandas';
  }, []);

  const { data: resData, isError } = useQuery({
    queryKey: ['orders', 'counter', selectedDate],
    queryFn: async () => {
      return await getOrders({ date: selectedDate, orderType: 'counter' });
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
    let filtered = orders.filter((order) => matchStatuses.includes(order.orderStatus));
    return filtered;
  })();

  const tabs = [
    { key: 'all', label: 'Todos' },
    { key: 'progress', label: 'Em Preparo' },
    { key: 'ready', label: 'Pronto' },
    { key: 'completed', label: 'Concluído' },
  ];

  const startCounterOrder = () => {
    dispatch(removeCustomer());
    dispatch(setOrderType('counter'));
    navigate('/menu');
  };

  return (
    <section className="h-[calc(100vh-3.5rem)] bg-gray-100 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <h1 className="text-gray-900 text-xl font-bold tracking-tight">
              Comandas
            </h1>
          </div>
          {/* New order + filters + date */}
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            {can('orders', 'create') && (
              <button
                type="button"
                onClick={startCounterOrder}
                className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 sm:w-auto"
              >
                <FiPlus size={17} />
                Nova Comanda
              </button>
            )}

            <div className="flex max-w-full flex-wrap items-center gap-1 rounded-lg bg-gray-100 p-1 sm:flex-nowrap sm:overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatus(tab.key)}
                  className={`shrink-0 whitespace-nowrap px-2 py-1.5 rounded-md text-xs font-semibold transition-all sm:px-4 sm:py-1.5 sm:text-sm flex-1 sm:flex-none ${
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
            <p className="text-gray-400 text-sm">Nenhuma comanda encontrada</p>
          </div>
        )}
      </div>

      <PdvFooterActions />
    </section>
  );
};

export default Orders;
