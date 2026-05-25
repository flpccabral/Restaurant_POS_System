import React from 'react';
import { useSelector } from 'react-redux';
import { getAvatarName } from '../../utils';

const CustomerInfo = () => {
  const customerData = useSelector((state) => state.customer);
  const isCounter = customerData.orderType === 'counter';

  return (
    <div className="px-4 py-3 border-b border-gray-100">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
          {getAvatarName(customerData.customerName) || 'CN'}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-gray-900 text-sm font-bold truncate">
            {customerData.customerName || 'Cliente'}
          </h3>
          <p className="text-gray-400 text-xs truncate">
            {isCounter ? 'Atendimento Balcao' : `Mesa ${customerData.table?.tableNo || 'N/A'}`}
            {customerData.orderId && ` · #${customerData.orderId.slice(-6)}`}
          </p>
        </div>
        {customerData.guests > 0 && (
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full flex-shrink-0">
            {customerData.guests} conv.
          </span>
        )}
      </div>
    </div>
  );
};

export default CustomerInfo;
