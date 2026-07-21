import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getTotalPrice } from '../../redux/slices/cartSlice';
import {
  addOrder,
  processOrderStockDeduction,
  printReceipt,
  getCurrentStoreSettings,
} from '../../https/index';
import { enqueueSnackbar } from 'notistack';
import { useMutation, useQuery } from '@tanstack/react-query';
import { removeAllItems } from '../../redux/slices/cartSlice';
import { removeCustomer, setCustomer } from '../../redux/slices/customerSlice';
import { FiInfo } from 'react-icons/fi';
import Invoice from '../invoice/Invoice';

const STOCK_STATUS_MESSAGES = {
  completed: 'Venda concluida e estoque baixado.',
  partial: 'Venda concluida, mas alguns itens nao tiveram baixa de estoque.',
  no_recipes: 'Pedido criado, mas produtos sem ficha tecnica — estoque nao foi baixado.',
  failed: 'Erro na baixa de estoque. Verifique o console operacional.',
  pending: 'Processando baixa de estoque...',
};

const Bill = () => {
  const dispatch = useDispatch();

  const customerData = useSelector((state) => state.customer);
  const cartData = useSelector((state) => state.cart);
  const total = useSelector(getTotalPrice);

  // Prompt G — Buscar configuracao de gorjeta da loja
  const { data: storeData } = useQuery({
    queryKey: ['currentStoreSettings'],
    queryFn: getCurrentStoreSettings,
    staleTime: 5 * 60 * 1000, // 5 min
  });
  const serviceChargeConfig = storeData?.data?.data?.settings?.serviceCharge || {
    enabled: true,
    rate: 10,
    mode: 'optional'
  };
  const serviceChargeRate = serviceChargeConfig.rate || 10;
  const serviceChargeMode = serviceChargeConfig.mode || 'optional';
  const serviceChargeEnabled = serviceChargeConfig.enabled !== false && serviceChargeMode !== 'disabled';

  // Estado da gorjeta — IMPORTANTE: default SEMPRE false (lei brasileira: nao pode ser pre-selecionada!)
  const [serviceChargeOpted, setServiceChargeOpted] = useState(false);

  // Calcular gorjeta (apenas se optada ou modo mandatory)
  const showServiceChargeToggle = serviceChargeEnabled && serviceChargeMode === 'optional';
  const isServiceChargeMandatory = serviceChargeEnabled && serviceChargeMode === 'mandatory';
  const applyServiceCharge = isServiceChargeMandatory || serviceChargeOpted;
  const serviceChargeAmount = applyServiceCharge ? (total * serviceChargeRate) / 100 : 0;

  // Taxa padrao removida (era 5.25% fixa) — substituida pela gorjeta opcional
  const tax = 0;
  const totalPriceWithTax = total + tax + serviceChargeAmount;

  const [paymentMethod, setPaymentMethod] = useState();
  const [showInvoice, setShowInvoice] = useState(false);
  const [orderInfo, setOrderInfo] = useState();
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [observations, setObservations] = useState('');
  const [showObservations, setShowObservations] = useState(false);

  // Modal de dados do cliente
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const isCounter = customerData.orderType === 'counter';

  // Mutation de impressao termica
  const printMutation = useMutation({
    mutationFn: (data) => printReceipt(data),
    onSuccess: (res) => {
      if (res.data?.success) {
        enqueueSnackbar(res.data.message || 'Impressao enviada!', { variant: 'success' });
      } else {
        // Nao e erro — apenas informa que nao ha impressora
        enqueueSnackbar(res.data?.message || 'Nenhuma impressora configurada', { variant: 'info' });
      }
    },
    onError: (err) => {
      console.warn('[Bill] Print error:', err);
      enqueueSnackbar('Falha na impressao (pedido nao foi afetado)', { variant: 'warning' });
    }
  });

  // Handler do botao Imprimir (imprime cupom do ultimo pedido)
  const handlePrint = () => {
    if (!orderInfo?._id) {
      enqueueSnackbar('Nenhum pedido para imprimir!', { variant: 'warning' });
      return;
    }
    printMutation.mutate({ orderId: orderInfo._id, printerType: 'receipt' });
  };

  const executeOrder = () => {
    if (isPlacingOrder) return;
    setIsPlacingOrder(true);
    try {
      const orderData = buildOrderData();
      orderMutation.mutate(orderData);
    } catch (error) {
      enqueueSnackbar('Erro ao processar pedido!', { variant: 'error' });
      setIsPlacingOrder(false);
    }
  };

  const handlePlaceOrder = async () => {
    // Forma de pagamento so e obrigatoria para balcao (counter)
    // Em dine_in, o pagamento e feito no fechamento da mesa
    if (isCounter && !paymentMethod) {
      enqueueSnackbar('Selecione um metodo de pagamento!', { variant: 'warning' });
      return;
    }

    if (cartData.length === 0) {
      enqueueSnackbar('Adicione itens ao carrinho!', { variant: 'warning' });
      return;
    }

    // Se nao tem dados do cliente, abrir modal para capturar
    if (!customerData.customerName || !customerData.customerPhone) {
      setCustomerName(customerData.customerName || '');
      setCustomerPhone(customerData.customerPhone || '');
      setShowCustomerModal(true);
      return;
    }

    executeOrder();
  };

  const handleCustomerSubmit = () => {
    if (!customerName.trim()) {
      enqueueSnackbar('Informe o nome do cliente!', { variant: 'warning' });
      return;
    }

    dispatch(
      setCustomer({
        name: customerName.trim(),
        phone: customerPhone.trim() || '00000000000',
        guests: 1,
      })
    );
    setShowCustomerModal(false);
    executeOrder();
  };

  const buildOrderData = () => {
    const name = customerName || customerData.customerName;
    const phone = customerPhone || customerData.customerPhone;
    const orderData = {
      customerDetails: {
        name,
        phone,
        guests: customerData.guests || 1,
      },
      orderStatus: 'In Progress',
      bills: {
        total: total,
        tax: tax,
        totalWithTax: totalPriceWithTax,
      },
      items: cartData.map((item) => ({
        ...item,
        notes: item.notes || '',
      })),
      table: customerData.table?.tableId || null,
      paymentMethod: paymentMethod,
      orderType: customerData.orderType || 'dine_in',
      observations: observations || '',
    };

    // Prompt G — Incluir gorjeta/servico opcional (lei brasileira)
    if (applyServiceCharge && serviceChargeEnabled) {
      orderData.serviceCharge = {
        opted: applyServiceCharge,
        rate: serviceChargeRate,
        amount: serviceChargeAmount,
      };
    }

    if (isCounter) {
      // Counter: payment is immediate, but orderStatus follows normal KDS lifecycle
      orderData.paymentStatus = 'paid';
      // closeStatus stays 'open' until orderStatus reaches 'completed' (auto-closed by backend)
    }

    return orderData;
  };

  const orderMutation = useMutation({
    mutationFn: (reqData) => addOrder(reqData),
    onSuccess: (resData) => {
      const { data } = resData.data;
      setOrderInfo(data);

      const doStockDeduction = () => {
        if (!data._id) return Promise.resolve(null);
        return processOrderStockDeduction(data._id);
      };

      doStockDeduction()
        .then((res) => {
          if (!res) {
            cleanupOrder(data);
            return;
          }

          const result = res.data?.data;
          const status = result?.stockDeductionStatus;
          const stockError = result?.stockDeductionError;

          const isFailed =
            status === 'failed' ||
            status === 'error' ||
            status === 'no_recipes';

          if (status === 'completed') {
            enqueueSnackbar(STOCK_STATUS_MESSAGES.completed, { variant: 'success' });
          } else if (status === 'partial') {
            enqueueSnackbar(STOCK_STATUS_MESSAGES.partial, { variant: 'warning' });
          } else if (isFailed) {
            const msg = stockError
              ? `Falha na baixa de estoque: ${stockError}`
              : STOCK_STATUS_MESSAGES[status] || `Baixa: ${status}`;
            enqueueSnackbar(msg, { variant: 'error', autoHideDuration: 10000 });
          } else {
            enqueueSnackbar(
              STOCK_STATUS_MESSAGES[status] || `Baixa de estoque: ${status}`,
              { variant: 'info' }
            );
          }

          if (!isFailed) {
            cleanupOrder(data);
          }
        })
        .catch((err) => {
          console.warn('Stock deduction error:', err);
          const reason =
            err?.response?.data?.data?.stockDeductionError ||
            err?.response?.data?.message ||
            err.message ||
            'erro desconhecido';
          enqueueSnackbar(
            `Falha na baixa de estoque: ${reason}. Carrinho mantido para revisao.`,
            { variant: 'error', autoHideDuration: 12000 }
          );
        });

      enqueueSnackbar('Pedido criado!', { variant: 'success' });
      setShowInvoice(true);
      setIsPlacingOrder(false);

      // Auto-impressao de comanda de cozinha (fire-and-forget)
      if (data._id) {
        printReceipt({ orderId: data._id, printerType: 'kitchen' })
          .then((res) => {
            if (!res.data?.success) {
              console.log('[Bill] Kitchen print:', res.data?.message);
            }
          })
          .catch((err) => {
            console.warn('[Bill] Auto kitchen print failed:', err.message);
          });
      }
    },
    onError: (error) => {
      console.error('[Bill] Order creation error:', error);
      const serverMsg =
        error?.response?.data?.message ||
        error?.response?.data?.errorStack ||
        error?.message ||
        'Erro desconhecido';
      console.error('[Bill] Server message:', serverMsg);
      enqueueSnackbar(`Erro ao criar pedido: ${serverMsg}`, {
        variant: 'error',
        autoHideDuration: 10000,
      });
      setIsPlacingOrder(false);
    },
  });

  const cleanupOrder = (data) => {
    dispatch(removeCustomer());
    dispatch(removeAllItems());
  };

  const paymentMethods = [
    { key: 'Dinheiro', label: 'Dinheiro' },
    { key: 'Pix', label: 'Pix' },
    { key: 'Debito', label: 'Debito' },
    { key: 'Credito', label: 'Credito' },
    { key: 'Voucher', label: 'Voucher' },
  ];

  return (
    <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 space-y-3 flex-shrink-0">
      {/* Order type badge + items count */}
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${
            isCounter
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          {isCounter ? 'Atendimento Balcao' : 'Mesa'}
        </span>
        <span className="text-gray-400 text-xs font-medium">
          {cartData.length} item(ns)
        </span>
      </div>

      {/* ===== RESUMO ===== */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <h3 className="text-gray-400 text-[10px] font-semibold uppercase tracking-widest mb-2">
          Resumo
        </h3>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Subtotal</span>
            <span className="text-gray-800 text-sm font-semibold">
              R$ {total.toFixed(2)}
            </span>
          </div>

          {/* Prompt G — Toggle de gorjeta opcional (lei brasileira) */}
          {showServiceChargeToggle && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-amber-800 text-sm font-semibold">
                    Servico ({serviceChargeRate}%)
                  </span>
                  <div className="relative group/tip">
                    <FiInfo size={12} className="text-amber-600 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-56 bg-gray-900 text-white text-[10px] px-2 py-1.5 rounded opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                      A gorjeta e opcional e va para os garçons. Voce pode aceitar ou recusar.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-800 text-sm font-semibold">
                    R$ {serviceChargeAmount.toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setServiceChargeOpted(!serviceChargeOpted)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      serviceChargeOpted ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                    aria-label="Aceitar gorjeta opcional"
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                        serviceChargeOpted ? 'translate-x-4.5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modo mandatory — sempre incluido, sem toggle */}
          {isServiceChargeMandatory && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-sm">
                Servico ({serviceChargeRate}%)
              </span>
              <span className="text-gray-800 text-sm font-semibold">
                R$ {serviceChargeAmount.toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <span className="text-gray-900 text-sm font-bold">Total</span>
            <span className="text-gray-900 text-xl font-extrabold tracking-tight">
              R$ {totalPriceWithTax.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* ===== PAGAMENTO (apenas balcao) ===== */}
      {isCounter && (
      <div>
        <h3 className="text-gray-400 text-[10px] font-semibold uppercase tracking-widest mb-2">
          Pagamento
        </h3>
        <div className="grid grid-cols-5 gap-1.5">
          {paymentMethods.map((pm) => (
            <button
              key={pm.key}
              onClick={() => setPaymentMethod(pm.key)}
              disabled={isPlacingOrder}
              className={`px-2 py-2.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                paymentMethod === pm.key
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-700'
              }`}
            >
              {pm.label}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* ===== OBSERVACOES ===== */}
      <div>
        <button
          onClick={() => setShowObservations(!showObservations)}
          className="text-gray-400 text-xs hover:text-gray-600 transition-colors font-medium"
        >
          {showObservations ? '— Ocultar observacao' : '+ Observacao do pedido'}
        </button>
        {showObservations && (
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Observacoes gerais do pedido..."
            className="bg-white text-gray-900 text-sm p-2.5 rounded-lg w-full mt-1.5 outline-none resize-none border border-gray-200 focus:border-blue-400 transition-colors"
            maxLength={500}
            rows={2}
          />
        )}
      </div>

      {/* ===== ACOES ===== */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handlePrint}
          disabled={isPlacingOrder || !orderInfo?._id}
          className="bg-white border border-gray-200 px-4 py-3 w-full rounded-lg text-gray-500 font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Imprimir
        </button>
        <button
          onClick={handlePlaceOrder}
          disabled={isPlacingOrder || cartData.length === 0}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-3 w-full rounded-lg text-white font-bold text-base shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          {isPlacingOrder
            ? 'Processando...'
            : isCounter
            ? 'Finalizar (Pago)'
            : 'Finalizar'}
        </button>
      </div>

      {showInvoice && (
        <Invoice orderInfo={orderInfo} setShowInvoice={setShowInvoice} />
      )}

      {/* Modal de dados do cliente */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl w-[420px] p-6 shadow-xl border border-gray-200">
            <h2 className="text-gray-900 text-lg font-bold mb-4">
              Dados do Cliente
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Informe os dados para finalizar o pedido.
              <span className="block mt-1 text-blue-600 font-semibold">
                Modo: {isCounter ? 'Balcao' : 'Salao / Mesa'}
              </span>
            </p>

            <div className="space-y-3 mb-6">
              <div>
                <label className="text-xs text-gray-500 block mb-1 font-semibold uppercase tracking-wider">
                  Nome do Cliente *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nome do cliente"
                  autoFocus
                  className="bg-gray-50 text-gray-900 text-sm p-3 rounded-lg w-full outline-none border border-gray-200 focus:border-blue-400 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1 font-semibold uppercase tracking-wider">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(DDD) 00000-0000"
                  className="bg-gray-50 text-gray-900 text-sm p-3 rounded-lg w-full outline-none border border-gray-200 focus:border-blue-400 transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCustomerModal(false)}
                className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-lg font-bold text-sm hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCustomerSubmit}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors"
              >
                Confirmar e Finalizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bill;
