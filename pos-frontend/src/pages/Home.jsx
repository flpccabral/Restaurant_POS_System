import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Greetings from '../components/home/Greetings';
import MiniCard from '../components/home/MiniCard';
import PdvFooterActions from '../components/pdv/PdvFooterActions';
import { getDashboardKPIs, getOrders, getTables, getCashSession, printReceipt } from '../https';
import { BsCashCoin, BsClipboardCheck, BsGrid, BsPrinter } from 'react-icons/bs';
import { GrInProgress } from 'react-icons/gr';
import { FiArrowRight, FiPlus } from 'react-icons/fi';
import PropTypes from 'prop-types';

const QuickAction = ({ icon: Icon, label, onClick, accent = 'blue' }) => {
  const colorMap = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    emerald: 'bg-emerald-600 hover:bg-emerald-700',
    amber: 'bg-amber-500 hover:bg-amber-600',
    slate: 'bg-slate-700 hover:bg-slate-800',
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-white shadow-sm transition-all active:scale-[0.98] ${colorMap[accent] || colorMap.blue}`}
    >
      <span className="flex items-center gap-2 text-sm font-bold">
        <Icon size={18} />
        {label}
      </span>
      <FiArrowRight size={16} />
    </button>
  );
};

QuickAction.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  accent: PropTypes.oneOf(['blue', 'emerald', 'amber', 'slate']),
};

const plural = (n, singular, pluralForm) => (n === 1 ? `${n} ${singular}` : `${n} ${pluralForm || singular + 's'}`);

const Home = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'POS | Início';
  }, []);

  const { data: kpiRes } = useQuery({
    queryKey: ['dashboardKpi', 'today'],
    queryFn: () => getDashboardKPIs({ period: 'today' }),
  });

  const { data: ordersRes } = useQuery({
    queryKey: ['orders', 'home'],
    queryFn: () => getOrders(),
  });

  const { data: tablesRes } = useQuery({
    queryKey: ['tables', 'home'],
    queryFn: () => getTables(),
  });

  const { data: cashRes } = useQuery({
    queryKey: ['cashSession', 'home'],
    queryFn: () => getCashSession(),
    retry: false,
    staleTime: 30000,
  });

  const kpi = kpiRes?.data?.data;
  const orders = useMemo(() => ordersRes?.data?.data || [], [ordersRes]);
  const tables = useMemo(() => tablesRes?.data?.data || [], [tablesRes]);
  const cashSession = cashRes?.data?.data;

  const revenue = kpi?.revenue?.gross || 0;
  const openOrdersCount = orders.filter(
    (o) => ['In Progress', 'Preparing', 'pending', 'accepted'].includes(o.orderStatus)
  ).length;
  const inProgressCount = orders.filter(
    (o) => o.orderStatus === 'In Progress'
  ).length;
  const occupiedTables = tables.filter(
    (t) => t.status === 'occupied' || t.currentOrder
  ).length;
  const totalTables = tables.length;

  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => new Date(b.orderDate || b.createdAt) - new Date(a.orderDate || a.createdAt))
      .slice(0, 5);
  }, [orders]);

  const statusLabel = (status) => {
    switch (status) {
      case 'In Progress': return 'Em preparo';
      case 'Ready': return 'Pronto';
      case 'completed': return 'Concluído';
      case 'paid': return 'Pago';
      default: return status;
    }
  };

  const handleReprint = () => {
    const lastId = localStorage.getItem('pos-last-order-id');
    if (!lastId) return;
    printReceipt({ orderId: lastId, printerType: 'receipt' });
  };

  return (
    <section className="h-[calc(100vh-3.5rem)] bg-gray-100 overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
          <Greetings />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Ações rápidas
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <QuickAction
              icon={FiPlus}
              label="Nova Comanda"
              onClick={() => navigate('/orders')}
              accent="blue"
            />
            <QuickAction
              icon={BsGrid}
              label="Mesas"
              onClick={() => navigate('/tables')}
              accent="emerald"
            />
            <QuickAction
              icon={BsCashCoin}
              label="Caixa"
              onClick={() => navigate('/dashboard?tab=Fluxo%20de%20Caixa')}
              accent="amber"
            />
            <QuickAction
              icon={BsPrinter}
              label="Reimprimir Cupom"
              onClick={handleReprint}
              accent="slate"
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MiniCard
              title="Vendas do Turno"
              icon={<BsCashCoin />}
              number={revenue.toFixed(0)}
              footer={cashSession ? `Caixa aberto desde ${new Date(cashSession.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Sem caixa aberto no momento'}
              accent="emerald"
            />
            <MiniCard
              title="Comandas Abertas"
              icon={<BsClipboardCheck />}
              number={openOrdersCount}
              footer={plural(openOrdersCount, 'em andamento', 'em andamento')}
              accent="blue"
            />
            <MiniCard
              title="Mesas Ocupadas"
              icon={<BsGrid />}
              number={occupiedTables}
              footer={totalTables > 0 ? `de ${totalTables} disponíveis` : 'Nenhuma mesa cadastrada'}
              accent="amber"
            />
            <MiniCard
              title="Itens em Preparo"
              icon={<GrInProgress />}
              number={inProgressCount}
              footer={plural(inProgressCount, 'no KDS', 'no KDS')}
              accent="rose"
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-gray-900 text-base font-bold">Comandas Recentes</h2>
                <p className="text-gray-500 text-xs">Últimas comandas/pedidos do turno</p>
              </div>
              <button
                onClick={() => navigate('/orders')}
                className="text-blue-600 text-sm font-semibold hover:text-blue-700"
              >
                Ver todas
              </button>
            </div>
            {recentOrders.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-400 text-sm">Nenhuma comanda no turno</p>
                <p className="text-gray-400 text-xs mt-1">Inicie uma nova comanda pelo PDV</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentOrders.map((order) => (
                  <button
                    key={order._id}
                    onClick={() => navigate('/orders')}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 font-semibold text-sm truncate">
                          {order.customerDetails?.name || 'Cliente'}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {statusLabel(order.orderStatus)}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs mt-0.5">
                        {order.orderNumber || `#${order._id?.slice(-6)}`} · {order.table?.tableNo ? `Mesa ${order.table.tableNo}` : 'Balcão'} · {plural(order.items?.length || 0, 'item', 'itens')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-gray-900 font-bold text-sm">
                        R$ {(order.bills?.totalWithTax || 0).toFixed(2)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <PdvFooterActions />
    </section>
  );
};

export default Home;
