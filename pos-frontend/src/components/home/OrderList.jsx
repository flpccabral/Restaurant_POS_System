import React from 'react';
import { FiCheckCircle, FiClock, FiArrowRight } from 'react-icons/fi';
import { getAvatarName, translateOrderStatus } from '../../utils/index';

const OrderList = ({ order }) => {
  const isReady = order.orderStatus === 'Ready';

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
      <span className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm">
        {getAvatarName(order.customerDetails.name)}
      </span>
      <div className="flex-1 min-w-0">
        <h4 className="text-gray-900 font-semibold text-sm truncate">
          {order.customerDetails.name}
        </h4>
        <p className="text-gray-400 text-xs">{order.items.length} Itens</p>
      </div>
      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full font-medium flex-shrink-0">
        Mesa <FiArrowRight className="inline" size={10} />{' '}
        {order.table?.tableNo || 'Balcao'}
      </span>
      <span
        className={`text-[11px] font-bold px-2 py-1 rounded-full flex items-center gap-1 flex-shrink-0 ${
          isReady
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-amber-100 text-amber-700'
        }`}
      >
        {isReady ? <FiCheckCircle size={12} /> : <FiClock size={12} />}
        {translateOrderStatus(order.orderStatus)}
      </span>
    </div>
  );
};

export default OrderList;
