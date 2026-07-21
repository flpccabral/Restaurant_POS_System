import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { getTableBill, closeTable } from '../https';
import BackButton from '../components/shared/BackButton';
import PdvFooterActions from '../components/pdv/PdvFooterActions';
import SplitBillModal from '../components/split/SplitBillModal';
import { useDispatch } from 'react-redux';
import { updateTable, setCustomer, setOrderType } from '../redux/slices/customerSlice';
import { formatDateAndTime } from '../utils';
import { FiPlus, FiDollarSign, FiArrowLeft, FiUsers } from 'react-icons/fi';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Dinheiro', icon: '💵' },
  { value: 'pix', label: 'Pix', icon: '📱' },
  { value: 'credit_card', label: 'Credito', icon: '💳' },
  { value: 'debit_card', label: 'Debito', icon: '🏧' },
];

const statusColors = {
  pending: 'text-amber-600 bg-amber-50',
  'In Progress': 'text-amber-600 bg-amber-50',
  preparing: 'text-orange-600 bg-orange-50',
  Ready: 'text-emerald-600 bg-emerald-50',
  completed: 'text-blue-600 bg-blue-50',
  cancelled: 'text-red-600 bg-red-50',
};

const paymentStatusLabels = {
  unpaid: 'Nao pago',
  partially_paid: 'Parcial',
  paid: 'Pago',
  refunded: 'Estornado',
};

const TableBill = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const [selectedPayment, setSelectedPayment] = React.useState('cash');
  const [showCloseConfirm, setShowCloseConfirm] = React.useState(false);
  const [showSplitModal, setShowSplitModal] = React.useState(false);

  const { data: resData, isLoading, isError } = useQuery({
    queryKey: ['tableBill', id],
    queryFn: async () => await getTableBill(id),
    placeholderData: keepPreviousData,
  });

  const closeMutation = useMutation({
    mutationFn: () => closeTable(id, { paymentMethod: selectedPayment }),
    onSuccess: (data) => {
      enqueueSnackbar(data.data.message, { variant: 'success' });
      queryClient.invalidateQueries(['tables']);
      navigate('/tables');
    },
    onError: (error) => {
      const msg = error?.response?.data?.message || 'Falha ao fechar mesa!';
      enqueueSnackbar(msg, { variant: 'error' });
    },
  });

  const handleNewOrder = () => {
    const table = resData?.data?.data?.table;
    if (table) {
      dispatch(updateTable({ table: { tableId: id, tableNo: table.tableNo } }));
      dispatch(setOrderType('dine_in'));
      // Carregar dados do cliente do primeiro pedido aberto
      const firstOrder = orders?.[0];
      if (firstOrder?.customerDetails?.name) {
        dispatch(setCustomer({
          name: firstOrder.customerDetails.name,
          phone: firstOrder.customerDetails.phone || '00000000000',
          guests: firstOrder.customerDetails.guests || 1,
        }));
      }
      navigate('/menu');
    }
  };

  if (isLoading) {
    return (
      <section className="h-[calc(100vh-3.5rem)] bg-gray-100 flex items-center justify-center">
        <p className="text-gray-400">Carregando conta...</p>
      </section>
    );
  }

  if (isError || !resData?.data?.data) {
    return (
      <section className="h-[calc(100vh-3.5rem)] bg-gray-100">
        <div className="flex items-center px-6 py-4">
          <BackButton />
        </div>
        <div className="flex items-center justify-center h-48">
          <p className="text-red-500 text-sm">Erro ao carregar conta da mesa.</p>
        </div>
        <PdvFooterActions />
      </section>
    );
  }

  const { table, orders, summary } = resData.data.data;

  return (
    <section className="h-[calc(100vh-3.5rem)] bg-gray-100 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-gray-900 text-xl font-bold tracking-tight">
                Mesa {table.tableNo}
              </h1>
              <p className="text-gray-400 text-xs mt-0.5">
                {table.status === 'Booked' ? 'Ocupada' : table.status}
              </p>
            </div>
          </div>
          <button
            onClick={handleNewOrder}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 py-2 font-bold text-sm flex items-center gap-2 transition-colors"
          >
            <FiPlus size={16} />
            Novo Pedido
          </button>
        </div>
      </div>

      {/* Orders list — scrollable */}
      <div className="flex-1 overflow-y-auto p-6">
        {orders.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-200 text-5xl mb-4">&#9744;</div>
            <p className="text-gray-400 text-sm">Nenhum pedido encontrado nesta mesa.</p>
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order._id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4"
            >
              {/* Order header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-gray-900 font-bold text-lg">
                    {order.customerDetails?.name || 'Cliente'}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDateAndTime(order.createdAt)}
                    {order.orderType && (
                      <span className="ml-2 text-blue-600 font-medium">
                        {order.orderType === 'counter' ? 'Balcao' : 'Salao'}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                      order.paymentStatus === 'paid'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {paymentStatusLabels[order.paymentStatus] || order.paymentStatus}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                      statusColors[order.orderStatus] || 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {order.orderStatus}
                  </span>
                </div>
              </div>

              {/* Order observations */}
              {order.observations && (
                <p className="text-xs text-amber-600 mb-3 border-l-2 border-amber-400 pl-3 py-1 bg-amber-50 rounded-r">
                  Obs: {order.observations}
                </p>
              )}

              {/* Items */}
              <div className="space-y-2">
                {order.items?.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-gray-800 text-sm font-medium">
                        {item.quantity || 1}x {item.name || item.productName}
                      </span>
                      {item.notes && (
                        <p className="text-xs text-amber-600 mt-0.5 ml-4 truncate">
                          {item.notes}
                        </p>
                      )}
                    </div>
                    <span className="text-gray-600 text-sm font-semibold ml-4 tabular-nums">
                      R${(item.price || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Order totals */}
              <div className="flex justify-end gap-6 mt-4 pt-3 border-t border-gray-100">
                {[
                  { label: 'Subtotal', value: order.bills?.total },
                  { label: 'Taxa', value: order.bills?.tax },
                  { label: 'Total', value: order.bills?.totalWithTax, bold: true },
                ].map(({ label, value, bold }) => (
                  <p key={label} className="text-xs text-gray-400">
                    {label}:{' '}
                    <span className={`text-gray-800 ${bold ? 'font-extrabold text-sm' : 'font-semibold'}`}>
                      R${(value || 0).toFixed(2)}
                    </span>
                  </p>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer: Summary + Close */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-4 shadow-sm">
        {!showCloseConfirm ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">
                {summary.ordersCount} pedido{summary.ordersCount !== 1 ? 's' : ''}
                {' · '}
                {summary.openOrdersCount} aberto{summary.openOrdersCount !== 1 ? 's' : ''}
              </p>
              <p className="text-2xl font-extrabold text-gray-900 mt-0.5">
                R${summary.total.toFixed(2)}
              </p>
              {summary.tax > 0 && (
                <p className="text-xs text-gray-400">
                  Taxa: R${summary.tax.toFixed(2)}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSplitModal(true)}
                className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-lg font-bold text-sm shadow-sm transition-all active:scale-[0.98] flex items-center gap-2"
              >
                <FiUsers size={16} />
                Dividir Conta
              </button>
              <button
                onClick={() => setShowCloseConfirm(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-lg font-bold text-base shadow-sm transition-all active:scale-[0.98] flex items-center gap-2"
              >
                <FiDollarSign size={18} />
                Fechar Mesa
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-900 font-bold">Forma de Pagamento</p>
              <p className="text-xl font-extrabold text-gray-900">
                R${summary.total.toFixed(2)}
              </p>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setSelectedPayment(m.value)}
                  className={`p-3 rounded-lg text-center font-bold text-sm transition-all ${
                    selectedPayment === m.value
                      ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                      : 'bg-gray-50 text-gray-500 border border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <span className="block text-lg mb-1">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-lg font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <FiArrowLeft size={16} />
                Voltar
              </button>
              <button
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
              >
                {closeMutation.isPending ? 'Processando...' : 'Confirmar Pagamento'}
              </button>
            </div>
          </div>
        )}
      </div>

      <PdvFooterActions />

      {/* Modal de Divisao de Conta (Prompt D) */}
      <SplitBillModal
        isOpen={showSplitModal}
        onClose={() => setShowSplitModal(false)}
        tableId={id}
        tableNumber={table.tableNo}
        orders={orders}
        totalAmount={summary.total}
        onSplitComplete={() => navigate('/tables')}
      />
    </section>
  );
};

export default TableBill;
