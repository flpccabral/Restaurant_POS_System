import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Greetings from '../components/home/Greetings';
import { BsCashCoin } from 'react-icons/bs';
import { GrInProgress } from 'react-icons/gr';
import MiniCard from '../components/home/MiniCard';
import PdvFooterActions from '../components/pdv/PdvFooterActions';
import { getDashboardKPIs, getOrders } from '../https';

const Home = () => {
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

  return (
    <section className="h-[calc(100vh-3.5rem)] bg-gray-100 overflow-hidden flex flex-col">
      <div className="flex-1 flex overflow-hidden">
        {/* Left Div */}
        <div className="flex-[3] overflow-y-auto p-6">
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
        </div>
      </div>
      <PdvFooterActions />
    </section>
  );
};

export default Home;
