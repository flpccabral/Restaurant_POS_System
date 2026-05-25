import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAvatarName, getBgColor, translateTableStatus } from '../../utils';
import { useDispatch } from 'react-redux';
import { updateTable, setCustomer } from '../../redux/slices/customerSlice';
import { FiArrowRight, FiEye, FiPlus } from 'react-icons/fi';

const TableCard = ({ id, name, status, initials, seats, customerName, customerPhone, customerGuests }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [showOptions, setShowOptions] = useState(false);

  const handleClick = () => {
    if (status === 'Booked') {
      setShowOptions(!showOptions);
      return;
    }

    const table = { tableId: id, tableNo: name };
    dispatch(updateTable({ table }));
    navigate('/menu');
  };

  const handleNewOrder = (e) => {
    e.stopPropagation();
    const table = { tableId: id, tableNo: name };
    dispatch(updateTable({ table }));
    // Carregar dados do cliente do pedido existente na mesa
    if (customerName) {
      dispatch(setCustomer({
        name: customerName,
        phone: customerPhone || '00000000000',
        guests: customerGuests || 1,
      }));
    }
    navigate('/menu');
    setShowOptions(false);
  };

  const handleViewBill = (e) => {
    e.stopPropagation();
    navigate(`/table/${id}/bill`);
  };

  const isBooked = status === 'Booked';

  return (
    <div
      onClick={handleClick}
      className={`bg-white rounded-xl border shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md ${
        isBooked ? 'border-l-4 border-l-emerald-500 border-gray-200' : 'border-gray-200'
      }`}
    >
      {/* Card content */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-gray-900 font-bold text-lg">
            Mesa <FiArrowRight className="inline text-gray-400 mx-1" size={14} /> {name}
          </h3>
          <span
            className={`text-[11px] font-bold px-2 py-1 rounded-full ${
              isBooked
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {translateTableStatus(status)}
          </span>
        </div>

        <div className="flex items-center justify-center py-4">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm`}
            style={{ backgroundColor: initials ? getBgColor() : '#e5e7eb' }}
          >
            {getAvatarName(initials) || '--'}
          </div>
        </div>

        <p className="text-gray-400 text-xs text-center">
          {seats} lugar(es)
        </p>
      </div>

      {/* Overlay for occupied table */}
      {isBooked && showOptions && (
        <div
          className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center gap-3 rounded-xl z-10 border border-gray-200"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleViewBill}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg text-white font-bold text-base w-44 flex items-center justify-center gap-2 transition-colors"
          >
            <FiEye size={16} />
            Ver Conta
          </button>
          <button
            onClick={handleNewOrder}
            className="bg-emerald-600 hover:bg-emerald-700 px-6 py-3 rounded-lg text-white font-bold text-base w-44 flex items-center justify-center gap-2 transition-colors"
          >
            <FiPlus size={16} />
            Novo Pedido
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowOptions(false);
            }}
            className="bg-gray-100 hover:bg-gray-200 px-6 py-2 rounded-lg text-gray-500 font-semibold w-44 transition-colors"
          >
            Voltar
          </button>
        </div>
      )}
    </div>
  );
};

export default TableCard;
