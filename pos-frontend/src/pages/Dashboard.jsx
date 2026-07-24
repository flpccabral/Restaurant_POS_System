import { useState, useEffect } from 'react';
import { MdTableBar } from 'react-icons/md';
import Metrics from '../components/dashboard/Metrics';
import RecentOrders from '../components/dashboard/RecentOrders';
import Modal from '../components/dashboard/Modal';
import Commissions from './Commissions';
import CashManagement from '../components/cash/CashManagement';
import Payments from '../components/dashboard/Payments';

const tabs = ['Métricas', 'Pedidos', 'Pagamentos', 'Comissões', 'Fluxo de Caixa'];

const Dashboard = () => {
  useEffect(() => {
    document.title = 'POS | Resumo do Turno';
  }, []);

  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Métricas');

  const handleOpenModal = (action) => {
    if (action === 'table') setIsTableModalOpen(true);
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-gray-100 overflow-y-auto">
      <div className="container mx-auto min-w-0 px-4 py-6 sm:px-6">
        {/* Header do turno + Tabs */}
        <div className="flex flex-col gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Resumo do Turno</h1>
            <p className="text-sm text-gray-500 mt-1">
              Acompanhamento operacional do dia. Gestão completa de cardápio, mesas e categorias fica no pos-admin.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => handleOpenModal('table')}
                className="bg-white hover:bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg text-gray-700 font-medium text-xs flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap"
              >
                <MdTableBar /> Adicionar Mesa
              </button>
            </div>

            <div className="flex max-w-full flex-wrap items-center gap-1 rounded-lg bg-gray-200 p-1 w-full sm:w-auto sm:flex-nowrap sm:overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  className={`shrink-0 whitespace-nowrap px-2 py-1.5 rounded-md text-xs font-semibold transition-all sm:px-4 sm:py-2 sm:text-sm flex-1 sm:flex-none ${
                    activeTab === tab
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => handleTabClick(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'Métricas' && <Metrics />}
        {activeTab === 'Pedidos' && <RecentOrders />}
        {activeTab === 'Pagamentos' && <Payments />}
        {activeTab === 'Comissões' && <Commissions embedded />}
        {activeTab === 'Fluxo de Caixa' && <CashManagement />}

        {isTableModalOpen && <Modal setIsTableModalOpen={setIsTableModalOpen} />}
      </div>
    </div>
  );
};

export default Dashboard;
