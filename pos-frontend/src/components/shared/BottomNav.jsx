import React, { useState } from 'react';
import { FiHome, FiClipboard, FiCoffee } from 'react-icons/fi';
import { BiSolidDish } from 'react-icons/bi';
import { useNavigate, useLocation } from 'react-router-dom';
import Modal from './Modal';
import { useDispatch } from 'react-redux';
import { setCustomer } from '../../redux/slices/customerSlice';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [guestCount, setGuestCount] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const increment = () => {
    if (guestCount >= 6) return;
    setGuestCount((prev) => prev + 1);
  };
  const decrement = () => {
    if (guestCount <= 0) return;
    setGuestCount((prev) => prev - 1);
  };

  const isActive = (path) => location.pathname === path;

  const handleCreateOrder = () => {
    dispatch(setCustomer({ name, phone, guests: guestCount }));
    navigate('/tables');
  };

  return (
    <div className="h-14 bg-white border-t border-gray-200 flex items-center justify-around px-4 shadow-sm flex-shrink-0">
      <button
        onClick={() => navigate('/')}
        className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition-colors text-xs font-medium ${
          isActive('/')
            ? 'text-blue-700 bg-blue-50'
            : 'text-gray-500 hover:text-blue-700 hover:bg-blue-50'
        }`}
      >
        <FiHome size={18} />
        <span>Inicio</span>
      </button>
      <button
        onClick={() => navigate('/orders')}
        className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition-colors text-xs font-medium ${
          isActive('/orders')
            ? 'text-blue-700 bg-blue-50'
            : 'text-gray-500 hover:text-blue-700 hover:bg-blue-50'
        }`}
      >
        <FiClipboard size={18} />
        <span>Pedidos</span>
      </button>
      <button
        onClick={() => navigate('/tables')}
        className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition-colors text-xs font-medium ${
          isActive('/tables')
            ? 'text-blue-700 bg-blue-50'
            : 'text-gray-500 hover:text-blue-700 hover:bg-blue-50'
        }`}
      >
        <FiCoffee size={18} />
        <span>Mesas</span>
      </button>

      {/* Separator for visual balance */}
      <div className="w-8" />

      {/* Floating action button */}
      <button
        disabled={isActive('/tables') || isActive('/menu')}
        onClick={openModal}
        className="absolute bottom-5 bg-blue-600 text-white rounded-full p-3 shadow-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Criar Pedido"
      >
        <BiSolidDish size={28} />
      </button>

      <Modal isOpen={isModalOpen} onClose={closeModal} title="Criar Pedido">
        <div>
          <label className="block text-gray-500 mb-2 text-sm font-medium">
            Nome do Cliente
          </label>
          <div className="flex items-center rounded-lg p-3 px-4 bg-gray-50 border border-gray-200">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              placeholder="Digite o nome do cliente"
              className="bg-transparent flex-1 text-gray-900 focus:outline-none text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-gray-500 mb-2 mt-3 text-sm font-medium">
            Telefone do Cliente
          </label>
          <div className="flex items-center rounded-lg p-3 px-4 bg-gray-50 border border-gray-200">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="text"
              placeholder="(11) 99999-9999"
              className="bg-transparent flex-1 text-gray-900 focus:outline-none text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block mb-2 mt-3 text-sm font-medium text-gray-500">
            Convidados
          </label>
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 px-4 py-3 rounded-lg">
            <button
              onClick={decrement}
              className="text-blue-600 text-2xl font-bold hover:text-blue-800 transition-colors"
            >
              &minus;
            </button>
            <span className="text-gray-900 font-semibold">
              {guestCount} Pessoa(s)
            </span>
            <button
              onClick={increment}
              className="text-blue-600 text-2xl font-bold hover:text-blue-800 transition-colors"
            >
              +
            </button>
          </div>
        </div>
        <button
          onClick={handleCreateOrder}
          className="w-full bg-blue-600 text-white rounded-lg py-3 mt-8 font-bold hover:bg-blue-700 transition-colors"
        >
          Criar Pedido
        </button>
      </Modal>
    </div>
  );
};

export default BottomNav;
