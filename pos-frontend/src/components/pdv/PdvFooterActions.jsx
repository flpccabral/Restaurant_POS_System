import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiShoppingBag, FiCoffee, FiMonitor,
  FiDollarSign, FiPrinter, FiLogOut, FiMapPin, FiMenu
} from 'react-icons/fi';
import { useDispatch } from 'react-redux';
import { setOrderType, updateTable } from '../../redux/slices/customerSlice';
import { useMutation } from '@tanstack/react-query';
import { logout as logoutApi } from '../../https';
import { removeUser } from '../../redux/slices/userSlice';

const PdvFooterActions = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const logoutMutation = useMutation({
    mutationFn: () => logoutApi(),
    onSuccess: () => {
      dispatch(removeUser());
      navigate('/auth');
    },
  });

  const handleCaixa = () => {
    // Default walk-up mode: counter, no table. Tables override to dine_in via TableCard/TableBill.
    dispatch(setOrderType('counter'));
    dispatch(updateTable({ table: null }));
    navigate('/menu');
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
      onClick: () => {},
      active: false,
      disabled: true,
      tooltip: 'Em breve',
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
  );
};

export default PdvFooterActions;
