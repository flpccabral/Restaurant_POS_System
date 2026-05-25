import React, { useState, useRef } from 'react';
import { FiSearch, FiBell, FiMonitor, FiGrid, FiLogOut } from 'react-icons/fi';
import { FaUserCircle } from 'react-icons/fa';
import logo from '../../assets/images/logo.png';
import { useSelector } from 'react-redux';
import { useMutation } from '@tanstack/react-query';
import { logout } from '../../https';
import { removeUser } from '../../redux/slices/userSlice';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import PdvModeBadge from '../pdv/PdvModeBadge';
import PdvSearchBar from '../pdv/PdvSearchBar';

const Header = () => {
  const userData = useSelector((state) => state.user);
  const customerData = useSelector((state) => state.customer);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      dispatch(removeUser());
      navigate('/auth');
    },
    onError: () => {},
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Show mode badge only when on menu (ordering) page
  const showMode = location.pathname === '/menu';
  const isCounter = customerData.orderType === 'counter';

  return (
    <header className="h-14 bg-blue-700 text-white flex items-center justify-between px-4 shadow-md">
      {/* Left: Logo + Brand + Mode */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <img src={logo} className="h-7 w-7 brightness-0 invert" alt="logo" />
          <span className="text-lg font-bold tracking-wide hidden sm:inline">
            Restro POS
          </span>
        </button>
        {showMode && (
          <div className="hidden md:flex items-center gap-2 ml-2 border-l border-white/20 pl-3">
            <PdvModeBadge
              orderType={customerData.orderType}
              tableNo={customerData.table?.tableNo}
            />
            {!isCounter && customerData.table?.tableNo && (
              <span className="text-white/80 text-xs font-medium ml-1">
                {customerData.customerName || '--'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Center: Search */}
      <div className="flex-1 flex justify-center px-4">
        <PdvSearchBar />
      </div>

      {/* Right: Operator + Actions */}
      <div className="flex items-center gap-2">
        {/* Console */}
        <button
          onClick={() => navigate('/console')}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          title="Console Operacional"
        >
          <FiMonitor size={18} />
        </button>

        {/* Dashboard (Admin only) */}
        {userData.role === 'Admin' && (
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Dashboard"
          >
            <FiGrid size={18} />
          </button>
        )}

        {/* Notifications */}
        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors relative">
          <FiBell size={18} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-400 rounded-full" />
        </button>

        {/* Operator */}
        <div className="flex items-center gap-2 ml-1 border-l border-white/20 pl-3">
          <FaUserCircle className="text-white text-2xl" />
          <div className="hidden md:flex flex-col">
            <span className="text-sm font-semibold leading-tight">
              {userData.name || 'OPERADOR'}
            </span>
            <span className="text-[10px] text-white/70 font-medium leading-tight">
              {userData.role || '--'}
            </span>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors ml-1"
          title="Sair"
        >
          <FiLogOut size={18} />
        </button>
      </div>
    </header>
  );
};

export default Header;
