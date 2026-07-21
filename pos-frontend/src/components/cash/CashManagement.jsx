import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCashSession, openCashSession, performSangria, performSuprimento, closeCashSession } from '../../https';
import Modal from '../shared/Modal';
import { FiDollarSign, FiMinusCircle, FiPlusCircle, FiXCircle } from 'react-icons/fi';
import { enqueueSnackbar } from 'notistack';

const CashManagement = () => {
  const queryClient = useQueryClient();
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showSangriaModal, setShowSangriaModal] = useState(false);
  const [showSuprimentoModal, setShowSuprimentoModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  const [openForm, setOpenForm] = useState({ initialBalance: '' });
  const [sangriaForm, setSangriaForm] = useState({ amount: '', reason: '' });
  const [suprimentoForm, setSuprimentoForm] = useState({ amount: '', reason: '' });
  const [closeForm, setCloseForm] = useState({ finalBalance: '', observations: '' });

  // Buscar sessão ativa
  const { data: sessionData, isLoading } = useQuery({
    queryKey: ['cashSession'],
    queryFn: getCashSession,
    retry: false,
  });

  const activeSession = sessionData?.data?.data;

  // Mutation: Abrir Caixa
  const openMutation = useMutation({
    mutationFn: (data) => openCashSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['cashSession']);
      setShowOpenModal(false);
      setOpenForm({ initialBalance: '' });
      enqueueSnackbar('Caixa aberto com sucesso!', { variant: 'success' });
    },
    onError: (error) => {
      enqueueSnackbar(error?.response?.data?.message || 'Erro ao abrir caixa', { variant: 'error' });
    },
  });

  // Mutation: Sangria
  const sangriaMutation = useMutation({
    mutationFn: (data) => performSangria(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['cashSession']);
      setShowSangriaModal(false);
      setSangriaForm({ amount: '', reason: '' });
      enqueueSnackbar('Sangria realizada com sucesso!', { variant: 'success' });
    },
    onError: (error) => {
      enqueueSnackbar(error?.response?.data?.message || 'Erro ao realizar sangria', { variant: 'error' });
    },
  });

  // Mutation: Suprimento
  const suprimentoMutation = useMutation({
    mutationFn: (data) => performSuprimento(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['cashSession']);
      setShowSuprimentoModal(false);
      setSuprimentoForm({ amount: '', reason: '' });
      enqueueSnackbar('Suprimento realizado com sucesso!', { variant: 'success' });
    },
    onError: (error) => {
      enqueueSnackbar(error?.response?.data?.message || 'Erro ao realizar suprimento', { variant: 'error' });
    },
  });

  // Mutation: Fechar Caixa
  const closeMutation = useMutation({
    mutationFn: (data) => closeCashSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['cashSession']);
      setShowCloseModal(false);
      setCloseForm({ finalBalance: '', observations: '' });
      enqueueSnackbar('Caixa fechado com sucesso!', { variant: 'success' });
    },
    onError: (error) => {
      enqueueSnackbar(error?.response?.data?.message || 'Erro ao fechar caixa', { variant: 'error' });
    },
  });

  // Mostrar modal de abertura se não houver sessão ativa
  useEffect(() => {
    if (!isLoading && !activeSession) {
      setShowOpenModal(true);
    }
  }, [isLoading, activeSession]);

  const handleOpenSubmit = (e) => {
    e.preventDefault();
    const balance = parseFloat(openForm.initialBalance);
    if (isNaN(balance) || balance < 0) {
      enqueueSnackbar('Informe um saldo inicial válido', { variant: 'warning' });
      return;
    }
    openMutation.mutate({ openingBalance: balance });
  };

  const handleSangriaSubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat(sangriaForm.amount);
    if (isNaN(amount) || amount <= 0) {
      enqueueSnackbar('Informe um valor válido', { variant: 'warning' });
      return;
    }
    if (!sangriaForm.reason.trim()) {
      enqueueSnackbar('Informe o motivo da sangria', { variant: 'warning' });
      return;
    }
    sangriaMutation.mutate({ amount, reason: sangriaForm.reason });
  };

  const handleSuprimentoSubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat(suprimentoForm.amount);
    if (isNaN(amount) || amount <= 0) {
      enqueueSnackbar('Informe um valor válido', { variant: 'warning' });
      return;
    }
    if (!suprimentoForm.reason.trim()) {
      enqueueSnackbar('Informe o motivo do suprimento', { variant: 'warning' });
      return;
    }
    suprimentoMutation.mutate({ amount, reason: suprimentoForm.reason });
  };

  const handleCloseSubmit = (e) => {
    e.preventDefault();
    const balance = parseFloat(closeForm.finalBalance);
    if (isNaN(balance) || balance < 0) {
      enqueueSnackbar('Informe um saldo final válido', { variant: 'warning' });
      return;
    }
    closeMutation.mutate({
      finalBalance: balance,
      observations: closeForm.observations,
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="text-center text-gray-500">Carregando status do caixa...</div>
      </div>
    );
  }

  return (
    <>
      {/* Status do Caixa */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Gestão de Caixa</h2>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
            activeSession ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}>
            <div className={`w-2 h-2 rounded-full ${activeSession ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
            {activeSession ? 'Caixa Aberto' : 'Caixa Fechado'}
          </div>
        </div>

        {activeSession && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-xs text-gray-500 font-semibold mb-1">Saldo Inicial</p>
              <p className="text-xl font-bold text-gray-900">
                R$ {(activeSession.initialBalance || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-xs text-gray-500 font-semibold mb-1">Saldo Esperado</p>
              <p className="text-xl font-bold text-gray-900">
                R$ {(activeSession.expectedBalance || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-xs text-gray-500 font-semibold mb-1">Aberto em</p>
              <p className="text-sm font-semibold text-gray-900">
                {new Date(activeSession.openedAt).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        )}

        {!activeSession ? (
          <button
            onClick={() => setShowOpenModal(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <FiDollarSign size={20} />
            Abrir Caixa
          </button>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => setShowSangriaModal(true)}
              className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <FiMinusCircle size={20} />
              Sangria
            </button>
            <button
              onClick={() => setShowSuprimentoModal(true)}
              className="bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <FiPlusCircle size={20} />
              Suprimento
            </button>
            <button
              onClick={() => setShowCloseModal(true)}
              className="bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <FiXCircle size={20} />
              Fechar Caixa
            </button>
          </div>
        )}
      </div>

      {/* Modal: Abrir Caixa */}
      <Modal isOpen={showOpenModal} onClose={() => setShowOpenModal(false)} title="Abrir Caixa">
        <form onSubmit={handleOpenSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Saldo Inicial (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={openForm.initialBalance}
              onChange={(e) => setOpenForm({ ...openForm, initialBalance: e.target.value })}
              placeholder="0.00"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              required
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Informe o valor em dinheiro disponível no caixa
            </p>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowOpenModal(false)}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={openMutation.isPending}
              className="flex-1 bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {openMutation.isPending ? 'Abrindo...' : 'Abrir Caixa'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Sangria */}
      <Modal isOpen={showSangriaModal} onClose={() => setShowSangriaModal(false)} title="Realizar Sangria">
        <form onSubmit={handleSangriaSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Valor da Sangria (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={sangriaForm.amount}
              onChange={(e) => setSangriaForm({ ...sangriaForm, amount: e.target.value })}
              placeholder="0.00"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Motivo da Sangria
            </label>
            <textarea
              value={sangriaForm.reason}
              onChange={(e) => setSangriaForm({ ...sangriaForm, reason: e.target.value })}
              placeholder="Ex: Pagamento de fornecedor, depósito bancário..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              required
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowSangriaModal(false)}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sangriaMutation.isPending}
              className="flex-1 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {sangriaMutation.isPending ? 'Realizando...' : 'Confirmar Sangria'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Suprimento */}
      <Modal isOpen={showSuprimentoModal} onClose={() => setShowSuprimentoModal(false)} title="Realizar Suprimento">
        <form onSubmit={handleSuprimentoSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Valor do Suprimento (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={suprimentoForm.amount}
              onChange={(e) => setSuprimentoForm({ ...suprimentoForm, amount: e.target.value })}
              placeholder="0.00"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Motivo do Suprimento
            </label>
            <textarea
              value={suprimentoForm.reason}
              onChange={(e) => setSuprimentoForm({ ...suprimentoForm, reason: e.target.value })}
              placeholder="Ex: Troco, adição de fundos..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              required
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowSuprimentoModal(false)}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={suprimentoMutation.isPending}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {suprimentoMutation.isPending ? 'Realizando...' : 'Confirmar Suprimento'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Fechar Caixa */}
      <Modal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} title="Fechar Caixa">
        <form onSubmit={handleCloseSubmit} className="space-y-4">
          {activeSession && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-4">
              <p className="text-sm text-gray-600 mb-2">Saldo Esperado:</p>
              <p className="text-2xl font-bold text-gray-900">
                R$ {(activeSession.expectedBalance || 0).toFixed(2)}
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Saldo Final Contado (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={closeForm.finalBalance}
              onChange={(e) => setCloseForm({ ...closeForm, finalBalance: e.target.value })}
              placeholder="0.00"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Observações (opcional)
            </label>
            <textarea
              value={closeForm.observations}
              onChange={(e) => setCloseForm({ ...closeForm, observations: e.target.value })}
              placeholder="Ex: Faltou R$ 5,00, sobrou R$ 10,00..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent resize-none"
            />
          </div>
          {closeForm.finalBalance && activeSession && (
            <div className={`rounded-lg p-3 border ${
              parseFloat(closeForm.finalBalance) === activeSession.expectedBalance
                ? 'bg-emerald-50 border-emerald-200'
                : parseFloat(closeForm.finalBalance) > activeSession.expectedBalance
                ? 'bg-blue-50 border-blue-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <p className="text-sm font-semibold">
                {parseFloat(closeForm.finalBalance) === activeSession.expectedBalance
                  ? '✅ Caixa fechado com diferença zero!'
                  : parseFloat(closeForm.finalBalance) > activeSession.expectedBalance
                  ? `📈 Sobrou: R$ ${(parseFloat(closeForm.finalBalance) - activeSession.expectedBalance).toFixed(2)}`
                  : `📉 Faltou: R$ ${(activeSession.expectedBalance - parseFloat(closeForm.finalBalance)).toFixed(2)}`}
              </p>
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowCloseModal(false)}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={closeMutation.isPending}
              className="flex-1 bg-gray-800 text-white py-3 rounded-lg font-semibold hover:bg-gray-900 transition-colors disabled:opacity-50"
            >
              {closeMutation.isPending ? 'Fechando...' : 'Fechar Caixa'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default CashManagement;
