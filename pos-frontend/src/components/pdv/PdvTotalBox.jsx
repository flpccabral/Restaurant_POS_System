import React from 'react';

const PdvTotalBox = ({ total, subtotal, discount = 0, tax, taxRate, labelTotal = 'Total' }) => {
  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-2 border border-gray-200">
      <div className="flex items-center justify-between">
        <span className="text-gray-500 text-sm">Subtotal</span>
        <span className="text-gray-700 text-sm font-semibold">
          R$ {subtotal.toFixed(2)}
        </span>
      </div>
      {discount > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-gray-500 text-sm">Desconto</span>
          <span className="text-red-500 text-sm font-semibold">
            - R$ {discount.toFixed(2)}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-gray-500 text-sm">Taxa ({taxRate}%)</span>
        <span className="text-gray-700 text-sm font-semibold">
          R$ {tax.toFixed(2)}
        </span>
      </div>
      <div className="border-t border-gray-300 pt-2 flex items-center justify-between">
        <span className="text-gray-900 text-base font-bold">{labelTotal}</span>
        <span className="text-gray-900 text-2xl font-extrabold tracking-tight">
          R$ {total.toFixed(2)}
        </span>
      </div>
    </div>
  );
};

export default PdvTotalBox;
