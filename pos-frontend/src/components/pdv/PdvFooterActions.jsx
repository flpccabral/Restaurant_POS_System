import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiShoppingBag, FiCoffee, FiMonitor,
  FiDollarSign, FiPrinter, FiLogOut, FiMapPin, FiMenu
} from 'react-icons/fi';
import { useDispatch } from 'react-redux';
import { setOrderType, updateTable } from '../../redux/slices/customerSlice';
import { useMutation, useQuery } from '@tanstack/react-query';
import { logout as logoutApi, listPrinters } from '../../https';
import { removeUser } from '../../redux/slices/userSlice';
import { enqueueSnackbar } from 'notistack';
import CashManagement from '../cash/CashManagement';

const PdvFooterActions = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);

  const logoutMutation = useMutation({
    mutationFn: () => logoutApi(),
    onSuccess: () => {
      dispatch(removeUser());
      navigate('/auth');
    },
  });

  // Verificar se ha impressoras configuradas
  const { data: printersData } = useQuery({
    queryKey: ['printers'],
    queryFn: () => listPrinters({ activeOnly: 'true' }),
    staleTime: 60000, // 1 min
  });
  const hasPrinters = (printersData?.data?.data || printersData?.data || []).length > 0;

  const handlePrintClick = () => {
    if (!hasPrinters) {
      enqueueSnackbar('Nenhuma impressora configurada. Va em Configuracoes > Impressoras.', { variant: 'warning' });
      return;
    }
    setShowPrintModal(true);
  };

  const handleCaixa = () => {
    // Abrir modal de gestão de caixa
    setShowCashModal(true);
  };

  const isActive = (path) => location.pathname === path;

  const buttons = [
    {
      label: 'Pre-venda',
      icon: FiShoppingBag,
      onClick: () => {},
      active: false,
      disabled: true,
      tooltip: 'Em breve',
    },
    {
      label: 'Comanda',
      icon: FiMenu,
      onClick: () => navigate('/orders'),
      active: isActive('/orders'),
      disabled: false,
    },
    {
      label: 'Mesas',
      icon: FiCoffee,
      onClick: () => navigate('/tables'),
      active: isActive('/tables'),
      disabled: false,
    },
    {
      label: 'Caixa',
      icon: FiMonitor,
      onClick: handleCaixa,
      active: isActive('/menu'),
      disabled: false,
    },
    {
      label: 'Delivery',
      icon: FiMapPin,
      onClick: () => {},
      active: false,
      disabled: true,
      tooltip: 'Em breve',
    },
    {
      label: 'Fechar',
      icon: FiDollarSign,
      onClick: () => {},
      active: false,
      disabled: true,
      tooltip: 'Em breve',
    },
    {
      label: 'Imprimir',
      icon: FiPrinter,
      onClick: handlePrintClick,
      active: false,
      disabled: !hasPrinters,
      tooltip: hasPrinters ? 'Imprimir cupom' : 'Configure uma impressora',
    },
    {
      label: 'Sair',
      icon: FiLogOut,
      onClick: () => logoutMutation.mutate(),
      active: false,
      disabled: false,
    },
  ];

  return (
    <>
      <div className="h-14 bg-white border-t border-gray-200 flex items-center justify-around px-4 shadow-sm">
        {buttons.map((btn, idx) => {
          const Icon = btn.icon;
          return (
            <div key={idx} className="relative group">
              <button
                onClick={btn.onClick}
                disabled={btn.disabled}
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition-colors text-xs font-medium ${
                  btn.active
                    ? 'text-blue-700 bg-blue-50'
                    : btn.disabled
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-600 hover:text-blue-700 hover:bg-blue-50'
                }`}
              >
                <Icon size={18} />
                <span>{btn.label}</span>
              </button>
              {btn.disabled && btn.tooltip && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  {btn.tooltip}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal de impressao rapida */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl w-[360px] p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Imprimir</h3>
            <p className="text-sm text-gray-600 mb-4">
              Selecione o tipo de impressao:
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  navigate('/menu');
                  setShowPrintModal(false);
                  enqueueSnackbar('Use o botao Imprimir no fechamento do pedido', { variant: 'info' });
                }}
                className="w-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-semibold py-3 px-4 rounded-lg transition-colors text-left"
              >
                <FiPrinter className="inline mr-2" size={18} />
                Cupom do Pedido
                <p className="text-xs text-blue-500 font-normal mt-0.5">
                  Imprime o comprovante do ultimo pedido
                </p>
              </button>
              <button
                onClick={() => {
                  navigate('/kitchen');
                  setShowPrintModal(false);
                }}
                className="w-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-semibold py-3 px-4 rounded-lg transition-colors text-left"
              >
                <FiMonitor className="inline mr-2" size={18} />
                Tela de Cozinha (KDS)
                <p className="text-xs text-amber-500 font-normal mt-0.5">
                  Abre a tela de monitoramento da cozinha
                </p>
              </button>
            </div>
            <button
              onClick={() => setShowPrintModal(false)}
              className="w-full mt-4 bg-gray-100 text-gray-500 py-2 rounded-lg font-semibold text-sm hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal de gestao de caixa */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 my-8 shadow-xl">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Gestão de Caixa</h3>
              <button
                onClick={() => setShowCashModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <CashManagement />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PdvFooterActions;
