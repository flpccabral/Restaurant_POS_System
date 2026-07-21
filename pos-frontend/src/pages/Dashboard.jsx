import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdTableBar, MdCategory, MdPointOfSale, MdReceipt, MdDashboard } from 'react-icons/md';
import { BiSolidDish } from 'react-icons/bi';
import { FiDollarSign, FiUsers, FiPieChart } from 'react-icons/fi';
import Metrics from '../components/dashboard/Metrics';
import RecentOrders from '../components/dashboard/RecentOrders';
import Modal from '../components/dashboard/Modal';
import Commissions from './Commissions';
import CashManagement from '../components/cash/CashManagement';
import Payments from '../components/dashboard/Payments';

const buttons = [
  { label: 'Adicionar Mesa', icon: <MdTableBar />, action: 'table' },
  { label: 'Adicionar Categoria', icon: <MdCategory />, action: 'category' },
  { label: 'Adicionar Pratos', icon: <BiSolidDish />, action: 'dishes' },
];

const tabs = ['Metricas', 'Pedidos', 'Pagamentos', 'Comissões', 'Fluxo de Caixa'];

const Dashboard = () => {
  useEffect(() => {
    document.title = 'POS | Painel Admin';
  }, []);

  const navigate = useNavigate();
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Metricas');

  const handleOpenModal = (action) => {
    if (action === 'table') setIsTableModalOpen(true);
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-gray-100 overflow-y-auto">
      <div className="container mx-auto px-6 py-6">
        {/* Action buttons + Tabs */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {buttons.map(({ label, icon, action }) => (
              <button
                key={action}
                onClick={() => handleOpenModal(action)}
                className="bg-white hover:bg-gray-50 border border-gray-200 px-5 py-2.5 rounded-lg text-gray-700 font-semibold text-sm flex items-center gap-2 shadow-sm transition-colors"
              >
                {label} {icon}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-gray-200 rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                className={`px-5 py-2 rounded-md text-sm font-semibold transition-all ${
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

        {/* Content */}
        {activeTab === 'Metricas' && <Metrics />}
        {activeTab === 'Pedidos' && <RecentOrders />}
        {activeTab === 'Pagamentos' && <Payments />}
        {activeTab === 'Comissões' && <Comissões />}
        {activeTab === 'Fluxo de Caixa' && (
          <CashManagement />
        )}

        {isTableModalOpen && <Modal setIsTableModalOpen={setIsTableModalOpen} />}
      </div>
    </div>
  );
};

export default Dashboard;
