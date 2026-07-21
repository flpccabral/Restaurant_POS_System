import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { calculateSplit, createSplitBill, processSplitPayment, closeSplitBill } from '../../https';
import { FiX, FiPlus, FiTrash2, FiCheck, FiUsers, FiList } from 'react-icons/fi';

const PAYMENT_METHODS = [
  { value: 'Dinheiro', label: 'Dinheiro', icon: '💵' },
  { value: 'Pix', label: 'Pix', icon: '📱' },
  { value: 'Credito', label: 'Credito', icon: '💳' },
  { value: 'Debito', label: 'Debito', icon: '🏧' },
  { value: 'Voucher', label: 'Voucher', icon: '🎫' },
];

/**
 * Modal de Divisao de Conta (Split Bill)
 * Prompt D — Divisao de Conta (adaptacao para mercado brasileiro)
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - tableId: string
 * - tableNumber: number
 * - orders: array de pedidos da mesa
 * - totalAmount: number
 * - onSplitComplete: () => void (callback apos fechar mesa com sucesso)
 */
const SplitBillModal = ({ isOpen, onClose, tableId, tableNumber, orders, totalAmount, onSplitComplete }) => {
  const queryClient = useQueryClient();

  // Estado principal
  const [step, setStep] = useState('config'); // config → preview → payments → done
  const [splitType, setSplitType] = useState('equal'); // equal | by_item
  const [people, setPeople] = useState([{ name: 'Pessoa 1', paymentMethod: 'Dinheiro' }]);

  // Para divisao por itens: { itemId: personIndex }
  const [itemAssignments, setItemAssignments] = useState({});

  // Split criado no backend
  const [splitData, setSplitData] = useState(null);

  // Calcular preview da divisao
  const calculatePreview = useMutation({
    mutationFn: (data) => calculateSplit(tableId, data),
    onSuccess: (res) => {
      // Atualizar pessoas com base no resultado
      const calculatedPayments = res.data.data.payments;
      setPeople(calculatedPayments.map(p => ({
        name: p.personName,
        paymentMethod: p.paymentMethod,
        value: p.value,
        items: p.items || []
      })));
      setStep('preview');
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || 'Erro ao calcular divisao!';
      enqueueSnackbar(msg, { variant: 'error' });
    }
  });

  // Criar split no backend
  const createSplit = useMutation({
    mutationFn: (data) => createSplitBill(tableId, data),
    onSuccess: (res) => {
      setSplitData(res.data.data);
      setStep('payments');
      enqueueSnackbar('Divisao criada com sucesso!', { variant: 'success' });
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || 'Erro ao criar divisao!';
      enqueueSnackbar(msg, { variant: 'error' });
    }
  });

  // Processar pagamento individual
  const processPayment = useMutation({
    mutationFn: ({ splitId, paymentId }) => processSplitPayment(splitId, paymentId),
    onSuccess: (res, variables) => {
      // Atualizar splitData localmente
      setSplitData(res.data.data);
      enqueueSnackbar(`Pagamento de ${res.data.data.payments.find(p => p._id === variables.paymentId)?.personName} registrado!`, { variant: 'success' });

      // Se todos pagos, avancar para proximo passo
      if (res.data.data.status === 'fully_paid') {
        setStep('done');
      }
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || 'Erro ao registrar pagamento!';
      enqueueSnackbar(msg, { variant: 'error' });
    }
  });

  // Fechar mesa apos split
  const closeTable = useMutation({
    mutationFn: (splitId) => closeSplitBill(splitId),
    onSuccess: (res) => {
      enqueueSnackbar(res.data.message, { variant: 'success' });
      queryClient.invalidateQueries(['tables']);
      queryClient.invalidateQueries(['tableBill']);
      onSplitComplete?.();
      handleClose();
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || 'Erro ao fechar mesa!';
      enqueueSnackbar(msg, { variant: 'error' });
    }
  });

  // Coletar todos os itens dos pedidos
  const allItems = useMemo(() => {
    const items = [];
    orders.forEach(order => {
      order.items?.forEach(item => {
        items.push({
          _id: item._id,
          name: item.name || item.productName,
          price: item.price || 0,
          quantity: item.quantity || 1,
          total: (item.price || 0) * (item.quantity || 1),
          orderId: order._id
        });
      });
    });
    return items;
  }, [orders]);

  // Handlers
  const handleClose = () => {
    setStep('config');
    setSplitType('equal');
    setPeople([{ name: 'Pessoa 1', paymentMethod: 'Dinheiro' }]);
    setItemAssignments({});
    setSplitData(null);
    onClose();
  };

  const addPerson = () => {
    if (people.length >= 10) {
      enqueueSnackbar('Maximo de 10 pessoas!', { variant: 'warning' });
      return;
    }
    setPeople([...people, { name: `Pessoa ${people.length + 1}`, paymentMethod: 'Dinheiro' }]);
  };

  const removePerson = (index) => {
    if (people.length <= 1) return;
    const newPeople = people.filter((_, i) => i !== index);
    setPeople(newPeople);

    // Remover atribuicoes dessa pessoa (by_item)
    if (splitType === 'by_item') {
      const newAssignments = {};
      Object.entries(itemAssignments).forEach(([itemId, personIdx]) => {
        if (personIdx === index) {
          // Item nao atribuido
        } else if (personIdx > index) {
          newAssignments[itemId] = personIdx - 1;
        } else {
          newAssignments[itemId] = personIdx;
        }
      });
      setItemAssignments(newAssignments);
    }
  };

  const updatePerson = (index, field, value) => {
    const newPeople = [...people];
    newPeople[index] = { ...newPeople[index], [field]: value };
    setPeople(newPeople);
  };

  const handleCalculate = () => {
    if (splitType === 'equal') {
      calculatePreview.mutate({
        splitType: 'equal',
        guestsCount: people.length
      });
    } else {
      // by_item
      const assignments = {};
      Object.entries(itemAssignments).forEach(([itemId, personIdx]) => {
        assignments[itemId] = people[personIdx]?.name || `Pessoa ${personIdx + 1}`;
      });

      calculatePreview.mutate({
        splitType: 'by_item',
        guestsCount: people.length,
        items: allItems.map(i => ({ _id: i._id, name: i.name, price: i.price, quantity: i.quantity })),
        assignments
      });
    }
  };

  const handleCreateSplit = () => {
    const payments = people.map((p, idx) => ({
      personName: p.name,
      value: p.value,
      paymentMethod: p.paymentMethod,
      items: p.items || []
    }));

    createSplit.mutate({
      splitType,
      guestsCount: people.length,
      payments
    });
  };

  const handleProcessPayment = (paymentId) => {
    if (!splitData) return;
    processPayment.mutate({ splitId: splitData._id, paymentId });
  };

  const handleCloseTable = () => {
    if (!splitData) return;
    closeTable.mutate(splitData._id);
  };

  if (!isOpen) return null;

  const peopleTotal = people.reduce((sum, p) => sum + (p.value || 0), 0);
  const allPaymentsDone = splitData?.payments?.every(p => p.status === 'paid');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-gray-900 text-xl font-bold">Dividir Conta — Mesa {tableNumber}</h2>
            <p className="text-gray-400 text-xs mt-0.5">
              Total: R${totalAmount.toFixed(2)} · {allItems.length} itens · {orders.length} pedido(s)
            </p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <FiX size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: Configuracao */}
          {step === 'config' && (
            <div className="space-y-6">
              {/* Tipo de divisao */}
              <div>
                <label className="text-gray-700 font-bold text-sm mb-2 block">Tipo de Divisao</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSplitType('equal')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      splitType === 'equal'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <FiUsers size={24} className={splitType === 'equal' ? 'text-blue-600' : 'text-gray-400'} />
                    <p className="font-bold text-gray-900 mt-2">Divisao Igual</p>
                    <p className="text-xs text-gray-500 mt-1">Divide o total igualmente entre todos</p>
                  </button>
                  <button
                    onClick={() => setSplitType('by_item')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      splitType === 'by_item'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <FiList size={24} className={splitType === 'by_item' ? 'text-blue-600' : 'text-gray-400'} />
                    <p className="font-bold text-gray-900 mt-2">Divisao por Itens</p>
                    <p className="text-xs text-gray-500 mt-1">Cada pessoa paga o que consumiu</p>
                  </button>
                </div>
              </div>

              {/* Pessoas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-700 font-bold text-sm">Pessoas</label>
                  <button
                    onClick={addPerson}
                    className="text-blue-600 hover:text-blue-700 text-sm font-semibold flex items-center gap-1"
                  >
                    <FiPlus size={14} />
                    Adicionar
                  </button>
                </div>
                <div className="space-y-2">
                  {people.map((person, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={person.name}
                        onChange={(e) => updatePerson(idx, 'name', e.target.value)}
                        placeholder={`Pessoa ${idx + 1}`}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                      />
                      <select
                        value={person.paymentMethod}
                        onChange={(e) => updatePerson(idx, 'paymentMethod', e.target.value)}
                        className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                      >
                        {PAYMENT_METHODS.map(m => (
                          <option key={m.value} value={m.value}>{m.icon} {m.label}</option>
                        ))}
                      </select>
                      {people.length > 1 && (
                        <button
                          onClick={() => removePerson(idx)}
                          className="text-red-400 hover:text-red-600 p-2"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Divisao por itens: atribuicoes */}
              {splitType === 'by_item' && (
                <div>
                  <label className="text-gray-700 font-bold text-sm mb-2 block">Atribuir Itens</label>
                  <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {allItems.map((item) => (
                      <div key={item._id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-800">
                            {item.quantity}x {item.name}
                          </span>
                          <span className="text-xs text-gray-500 ml-2">
                            R${item.total.toFixed(2)}
                          </span>
                        </div>
                        <select
                          value={itemAssignments[item._id] ?? ''}
                          onChange={(e) => {
                            const newAssignments = { ...itemAssignments };
                            if (e.target.value === '') {
                              delete newAssignments[item._id];
                            } else {
                              newAssignments[item._id] = parseInt(e.target.value);
                            }
                            setItemAssignments(newAssignments);
                          }}
                          className="bg-white border border-gray-200 rounded px-2 py-1 text-xs"
                        >
                          <option value="">— Nao atribuido —</option>
                          {people.map((p, idx) => (
                            <option key={idx} value={idx}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  {Object.keys(itemAssignments).length < allItems.length && (
                    <p className="text-xs text-amber-600 mt-2">
                      ⚠ {allItems.length - Object.keys(itemAssignments).length} item(ns) nao atribuido(s)
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <h3 className="text-gray-900 font-bold text-lg">Preview da Divisao</h3>
              <div className="space-y-3">
                {people.map((person, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-bold text-gray-900">{person.name}</p>
                        <p className="text-xs text-gray-500">
                          {PAYMENT_METHODS.find(m => m.value === person.paymentMethod)?.icon}{' '}
                          {person.paymentMethod}
                        </p>
                      </div>
                      <p className="text-2xl font-extrabold text-gray-900">
                        R${(person.value || 0).toFixed(2)}
                      </p>
                    </div>
                    {person.items?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Itens:</p>
                        {person.items.map((item, i) => (
                          <p key={i} className="text-xs text-gray-700">
                            {item.quantity}x {item.productName} — R${item.amount.toFixed(2)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <span className="text-blue-900 font-bold">Total Dividido</span>
                  <span className="text-2xl font-extrabold text-blue-900">
                    R${peopleTotal.toFixed(2)}
                  </span>
                </div>
                {Math.abs(peopleTotal - totalAmount) > 0.01 && (
                  <p className="text-xs text-red-600 mt-2">
                    ⚠ Diferenca de R${Math.abs(peopleTotal - totalAmount).toFixed(2)} em relacao ao total da mesa!
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Processar Pagamentos */}
          {step === 'payments' && splitData && (
            <div className="space-y-4">
              <h3 className="text-gray-900 font-bold text-lg">Registrar Pagamentos</h3>
              <p className="text-sm text-gray-500">
                Registre o pagamento de cada pessoa conforme o metodo escolhido.
              </p>
              <div className="space-y-3">
                {splitData.payments.map((payment) => (
                  <div key={payment._id} className={`rounded-xl p-4 border-2 ${
                    payment.status === 'paid'
                      ? 'bg-emerald-50 border-emerald-300'
                      : 'bg-white border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-bold text-gray-900">{payment.personName}</p>
                        <p className="text-xs text-gray-500">
                          {PAYMENT_METHODS.find(m => m.value === payment.paymentMethod)?.icon}{' '}
                          {payment.paymentMethod}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-extrabold text-gray-900">
                          R${payment.value.toFixed(2)}
                        </p>
                        {payment.status === 'paid' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-bold mt-1">
                            <FiCheck size={12} />
                            Pago
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 font-semibold mt-1">
                            Pendente
                          </span>
                        )}
                      </div>
                    </div>
                    {payment.status !== 'paid' && (
                      <button
                        onClick={() => handleProcessPayment(payment._id)}
                        disabled={processPayment.isPending}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 mt-2"
                      >
                        {processPayment.isPending ? 'Processando...' : 'Confirmar Pagamento'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: Concluido */}
          {step === 'done' && (
            <div className="text-center py-8">
              <div className="text-emerald-500 text-6xl mb-4">✓</div>
              <h3 className="text-gray-900 text-2xl font-bold mb-2">Todos os Pagamentos Registrados!</h3>
              <p className="text-gray-500 mb-6">
                A divisao foi concluida com sucesso. Agora voce pode fechar a mesa.
              </p>
              <button
                onClick={handleCloseTable}
                disabled={closeTable.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-lg font-bold text-base shadow-sm transition-all disabled:opacity-50"
              >
                {closeTable.isPending ? 'Fechando Mesa...' : 'Fechar Mesa'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'done' && (
          <div className="flex-shrink-0 border-t border-gray-200 px-6 py-4 flex gap-3">
            {step === 'preview' && (
              <button
                onClick={() => setStep('config')}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-200 transition-colors"
              >
                Voltar
              </button>
            )}
            {step === 'config' && (
              <button
                onClick={handleCalculate}
                disabled={calculatePreview.isPending || (splitType === 'by_item' && Object.keys(itemAssignments).length < allItems.length)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
              >
                {calculatePreview.isPending ? 'Calculando...' : 'Calcular Divisao'}
              </button>
            )}
            {step === 'preview' && (
              <button
                onClick={handleCreateSplit}
                disabled={createSplit.isPending || Math.abs(peopleTotal - totalAmount) > 0.01}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
              >
                {createSplit.isPending ? 'Criando...' : 'Criar Divisao'}
              </button>
            )}
            {step === 'payments' && (
              <button
                onClick={handleClose}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-200 transition-colors"
              >
                Fechar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SplitBillModal;
