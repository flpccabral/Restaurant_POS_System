import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { processPayment } from '../../https';
import { FiX, FiDollarSign } from 'react-icons/fi';
import { enqueueSnackbar } from 'notistack';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Dinheiro', icon: '💵' },
  { value: 'pix', label: 'Pix', icon: '📱' },
  { value: 'credit_card', label: 'Credito', icon: '💳' },
  { value: 'debit_card', label: 'Debito', icon: '🏧' },
];

const CounterPaymentModal = ({ order, onClose }) => {
  const queryClient = useQueryClient();
  const [selectedMethod, setSelectedMethod] = useState('cash');

  const paymentMutation = useMutation({
    mutationFn: (data) => processPayment(data),
    onSuccess: (data) => {
      enqueueSnackbar(data.data.message, { variant: 'success' });
      queryClient.invalidateQueries(['orders']);
      onClose();
    },
    onError: (error) => {
      const msg = error?.response?.data?.message || 'Falha ao processar pagamento!';
      enqueueSnackbar(msg, { variant: 'error' });
    },
  });

  const handlePayment = () => {
    paymentMutation.mutate({
      orderId: order._id,
      method: selectedMethod,
      amount: order.bills?.totalWithTax || 0,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl w-full max-w-lg mx-4 shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Pagamento do Pedido</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Customer Info */}
          <div className="mb-4 pb-4 border-b border-gray-200">
            <p className="text-sm text-gray-500">Cliente</p>
            <p className="text-lg font-bold text-gray-900">{order.customerDetails?.name}</p>
            <p className="text-sm text-gray-500 mt-1">
              Pedido #{order._id?.slice(-6)} · {order.items.length} item(ns)
            </p>
          </div>

          {/* Items Summary */}
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-2">Itens</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {item.quantity}x {item.name || item.productName}
                  </span>
                  <span className="text-gray-900 font-semibold">
                    R$ {((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="mb-6 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-gray-900">Total</span>
              <span className="text-2xl font-extrabold text-gray-900">
                R$ {(order.bills?.totalWithTax || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-3">Forma de Pagamento</p>
            <div className="grid grid-cols-2 gap-3">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.value}
                  onClick={() => setSelectedMethod(method.value)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedMethod === method.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl mb-1 block">{method.icon}</span>
                  <span className="text-sm font-semibold">{method.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handlePayment}
              disabled={paymentMutation.isPending}
              className="flex-1 bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <FiDollarSign size={18} />
              {paymentMutation.isPending ? 'Processando...' : 'Confirmar Pagamento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CounterPaymentModal;
