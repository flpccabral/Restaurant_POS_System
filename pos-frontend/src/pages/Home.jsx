import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Greetings from '../components/home/Greetings';
import { BsCashCoin } from 'react-icons/bs';
import { GrInProgress } from 'react-icons/gr';
import { FiMonitor, FiCoffee, FiClipboard, FiShoppingCart } from 'react-icons/fi';
import MiniCard from '../components/home/MiniCard';
import RecentOrders from '../components/home/RecentOrders';
import PopularDishes from '../components/home/PopularDishes';
import PdvFooterActions from '../components/pdv/PdvFooterActions';
import { setOrderType, updateTable } from '../redux/slices/customerSlice';
import { getDashboardKPIs, getOrders } from '../https';

const Home = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    document.title = 'POS | Inicio';
  }, []);

  const { data: kpiRes } = useQuery({
    queryKey: ['dashboardKpi', 'today'],
    queryFn: () => getDashboardKPIs({ period: 'today' }),
  });

  const { data: ordersRes } = useQuery({
    queryKey: ['orders'],
    queryFn: () => getOrders(),
  });

  const kpi = kpiRes?.data?.data;
  const orders = ordersRes?.data?.data || [];

  const revenue = kpi?.revenue?.gross || 0;
  const inProgressCount = orders.filter(
    (o) => o.orderStatus === 'In Progress'
  ).length;

  const handleCounterMode = () => {
    dispatch(setOrderType('counter'));
    dispatch(updateTable({ table: null }));
    navigate('/menu');
  };

  return (
    <section className="h-[calc(100vh-3.5rem)] bg-gray-100 overflow-hidden flex flex-col">
      <div className="flex-1 flex overflow-hidden">
        {/* Left Div */}
        <div className="flex-[3] overflow-y-auto p-6">
          {/* Fase 9.3D: Operational Launcher Panel */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <h3 className="text-gray-400 text-xs font-bold mb-3 uppercase tracking-widest">
              Atendimento
            </h3>
            {/* Primary CTA */}
            <button
              onClick={() => navigate('/menu')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-4 font-bold text-base transition-colors shadow-sm flex items-center justify-center gap-2 mb-3"
            >
              <FiShoppingCart size={20} />
              Abrir PDV
            </button>
            {/* Secondary actions */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleCounterMode}
                className="border border-gray-200 hover:bg-gray-100 bg-gray-50 text-gray-700 rounded-lg py-3 font-semibold text-xs transition-colors flex flex-col items-center gap-1"
              >
                <FiMonitor size={18} />
                Balcao
              </button>
              <button
                onClick={() => navigate('/tables')}
                className="border border-gray-200 hover:bg-gray-100 bg-gray-50 text-gray-700 rounded-lg py-3 font-semibold text-xs transition-colors flex flex-col items-center gap-1"
              >
                <FiCoffee size={18} />
                Mesas
              </button>
              <button
                onClick={() => navigate('/orders')}
                className="border border-gray-200 hover:bg-gray-100 bg-gray-50 text-gray-700 rounded-lg py-3 font-semibold text-xs transition-colors flex flex-col items-center gap-1"
              >
                <FiClipboard size={18} />
                Pedidos
              </button>
            </div>
          </div>

          <Greetings />
          <div className="flex items-center w-full gap-4 mt-6">
            <MiniCard
              title="Ganhos Totais"
              icon={<BsCashCoin />}
              number={revenue.toFixed(0)}
              footerNum={0}
            />
            <MiniCard
              title="Em Preparo"
              icon={<GrInProgress />}
              number={inProgressCount}
              footerNum={0}
            />
          </div>
          <div className="mt-6">
            <RecentOrders />
          </div>
        </div>
        {/* Right Div */}
        <div className="flex-[2] overflow-y-auto p-6 pl-0">
          <PopularDishes />
        </div>
      </div>
      <PdvFooterActions />
    </section>
  );
};

export default Home;
