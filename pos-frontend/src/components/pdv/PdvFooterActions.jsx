import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiCoffee, FiMonitor,
  FiPrinter, FiLogOut, FiMenu
} from 'react-icons/fi';
import { useDispatch } from 'react-redux';
import { useMutation, useQuery } from '@tanstack/react-query';
import { logout as logoutApi, listPrinters, printReceipt } from '../../https';
import { removeUser } from '../../redux/slices/userSlice';
import { enqueueSnackbar } from 'notistack';
import CashManagement from '../cash/CashManagement';

const PdvFooterActions = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const [showCashModal, setShowCashModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  const printMutation = useMutation({
    mutationFn: (data) => printReceipt(data),
    onSuccess: (res) => {
      if (res.data?.success) {
        enqueueSnackbar(res.data.message || 'Impressão enviada!', { variant: 'success' });
      } else {
        enqueueSnackbar(res.data?.message || 'Nenhuma impressora configurada', { variant: 'info' });
      }
    },
    onError: (err) => {
      console.warn('[PdvFooterActions] Print error:', err);
      enqueueSnackbar('Falha na impressão', { variant: 'warning' });
    }
  });

  const handlePrintClick = () => {
    if (!hasPrinters) {
      enqueueSnackbar('Nenhuma impressora configurada', { variant: 'warning' });
      return;
    }

    const lastOrderId = localStorage.getItem('pos-last-order-id');
    if (!lastOrderId) {
      enqueueSnackbar('Nenhum pedido para imprimir', { variant: 'warning' });
      return;
    }

    printMutation.mutate({ orderId: lastOrderId, printerType: 'receipt' });
  };

  const handleCaixa = () => {
    // Abrir modal de gestão de caixa
    setShowCashModal(true);
  };

  const isActive = (path) => location.pathname === path;

  const buttons = [
    {
      label: 'Comanda',
      shortLabel: 'Comanda',
      icon: FiMenu,
      onClick: () => navigate('/orders'),
      active: isActive('/orders'),
      disabled: false,
      mobile: true,
    },
    {
      label: 'Mesas',
      shortLabel: 'Mesas',
      icon: FiCoffee,
      onClick: () => navigate('/tables'),
      active: isActive('/tables'),
      disabled: false,
      mobile: true,
    },
    {
      label: 'Caixa',
      shortLabel: 'Caixa',
      icon: FiMonitor,
      onClick: handleCaixa,
      active: showCashModal,
      disabled: false,
      mobile: true,
    },
    {
      label: 'Imprimir',
      shortLabel: 'Imprimir',
      icon: FiPrinter,
      onClick: handlePrintClick,
      active: false,
      disabled: !hasPrinters,
      tooltip: hasPrinters ? 'Imprimir cupom' : 'Configure uma impressora',
      mobile: true,
    },
    {
      label: 'Sair',
      shortLabel: 'Sair',
      icon: FiLogOut,
      onClick: () => logoutMutation.mutate(),
      active: false,
      disabled: false,
      mobile: true,
    },
  ];

  const visibleButtons = buttons.filter((b) => b.mobile || !isMobile);

  return (
    <>
      <div className="h-14 bg-white border-t border-gray-200 flex items-center shadow-sm">
        <div className="flex items-center w-full overflow-x-auto scrollbar-hide px-2 gap-1">
          {visibleButtons.map((btn, idx) => {
            const Icon = btn.icon;
            const displayLabel = isMobile ? btn.shortLabel : btn.label;
            return (
              <div key={idx} className="relative group shrink-0">
                <button
                  onClick={btn.onClick}
                  disabled={btn.disabled}
                  className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors text-xs font-medium min-w-[60px] ${
                    btn.active
                      ? 'text-blue-700 bg-blue-50'
                      : btn.disabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-600 hover:text-blue-700 hover:bg-blue-50'
                  }`}
                >
                  <Icon size={18} />
                  <span className="truncate max-w-[64px]">{displayLabel}</span>
                </button>
                {btn.tooltip && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    {btn.tooltip}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de gestão de caixa */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black bg-opacity-50 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 my-4 sm:my-8 shadow-xl">
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
