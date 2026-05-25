import React from 'react';
import { FiCheckCircle, FiClock, FiArrowRight } from 'react-icons/fi';
import { formatDateAndTime, getAvatarName, translateOrderStatus } from '../../utils/index';

const OrderCard = ({ order }) => {
  const isReady = order.orderStatus === 'Ready';
  const isCompleted = order.orderStatus === 'completed';
  const isCancelled = order.orderStatus === 'cancelled';

  let statusColor;
  if (isCompleted) statusColor = 'bg-blue-100 text-blue-700';
  else if (isReady) statusColor = 'bg-emerald-100 text-emerald-700';
  else if (isCancelled) statusColor = 'bg-red-100 text-red-600';
  else statusColor = 'bg-amber-100 text-amber-700';

  return (
    <div className="w-[480px] bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0 shadow-sm">
            {getAvatarName(order.customerDetails.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-gray-900 font-bold text-base truncate">
              {order.customerDetails.name}
            </h3>
            <p className="text-gray-400 text-xs">
              Pedido #{order.orderId?.slice(-6) || order._id?.slice(-6)}
              {order.table?.tableNo ? (
                <>
                  {' '}&middot; Mesa <FiArrowRight className="inline" size={10} /> {order.table.tableNo}
                </>
              ) : (
                ' &middot; Balcao'
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-[11px] font-bold px-2 py-1 rounded-full flex items-center gap-1 ${statusColor}`}>
              {isReady ? <FiCheckCircle size={12} /> : <FiClock size={12} />}
              {translateOrderStatus(order.orderStatus)}
            </span>
            {order.paymentStatus === 'paid' && (
              <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">
                Pago
              </span>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center justify-between mt-4 text-gray-400 text-xs">
          <span>{formatDateAndTime(order.orderDate)}</span>
          <span className="font-medium">{order.items.length} item(ns)</span>
        </div>

        {/* Order observations */}
        {order.observations && (
          <p className="text-amber-600 text-xs mt-2 border-l-2 border-amber-400 pl-3 py-1 bg-amber-50 rounded-r">
            Obs: {order.observations}
          </p>
        )}

        {/* Divider */}
        <div className="border-t border-gray-100 mt-4 pt-3 flex items-center justify-between">
          <span className="text-gray-500 text-sm font-medium">Total</span>
          <span className="text-gray-900 text-lg font-extrabold">
            R${(order.bills?.totalWithTax || 0).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default OrderCard;
