import React, { useState, useEffect } from 'react';
import BottomNav from '../components/shared/BottomNav';
import BackButton from '../components/shared/BackButton';
import TableCard from '../components/tables/TableCard';
import { enqueueSnackbar } from 'notistack';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getTables } from '../https';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setOrderType, updateTable } from '../redux/slices/customerSlice';

const Tables = () => {
  const [status, setStatus] = useState('all');
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'POS | Mesas';
  }, []);

  const { data: resData, isError } = useQuery({
    queryKey: ['tables'],
    queryFn: async () => {
      return await getTables();
    },
    placeholderData: keepPreviousData,
  });

  if (isError) {
    enqueueSnackbar('Algo deu errado!', { variant: 'error' });
  }

  // Fase 9.3C: Counter mode — no table, direct ordering
  const handleCounterMode = () => {
    dispatch(setOrderType('counter'));
    dispatch(updateTable({ table: null }));
    navigate('/menu');
  };

  const tables = resData?.data.data || [];

  const filteredTables =
    status === 'all'
      ? tables
      : tables.filter((t) => t.status === 'Booked');

  const tabs = [
    { key: 'all', label: 'Todas' },
    { key: 'booked', label: 'Ocupadas' },
  ];

  return (
    <section className="h-[calc(100vh-3.5rem)] bg-gray-100 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <h1 className="text-gray-900 text-xl font-bold tracking-tight">
              Mesas
            </h1>
          </div>
          <div className="flex items-center gap-2">
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
            <button
              onClick={handleCounterMode}
              className="bg-blue-600 text-white rounded-lg px-5 py-1.5 font-bold text-sm hover:bg-blue-700 transition-colors"
            >
              Atendimento Balcao
            </button>
          </div>
        </div>
      </div>

      {/* Tables grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredTables.map((table) => (
            <TableCard
              key={table._id}
              id={table._id}
              name={table.tableNo}
              status={table.status}
              initials={table?.currentOrder?.customerDetails?.name}
              seats={table.seats}
              customerName={table?.currentOrder?.customerDetails?.name}
              customerPhone={table?.currentOrder?.customerDetails?.phone}
              customerGuests={table?.currentOrder?.customerDetails?.guests}
            />
          ))}
        </div>
        {filteredTables.length === 0 && (
          <div className="flex items-center justify-center h-48">
            <p className="text-gray-400 text-sm">Nenhuma mesa encontrada</p>
          </div>
        )}
      </div>

      <BottomNav />
    </section>
  );
};

export default Tables;
