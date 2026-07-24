/**
 * KitchenDisplay — Tela de Cozinha (KDS Frontend)
 *
 * Caracteristicas:
 * - Grid responsivo de cards de pedido
 * - Atualizacao em tempo real via WebSocket (kds:order-synced, kds:order-ready, kds:order-served)
 * - Timer em tempo real (verde <10min, amarelo 10-15min, vermelho >15min)
 * - Beep ao receber novo pedido
 * - Acoes: Aceitar, Pronto, Entregar
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getKDSOrders, acceptKDSOrder, markKDSReady, markKDSServed, rushKDSOrder } from '../../https';
import { useSocket } from '../../hooks/useSocket';
import { enqueueSnackbar } from 'notistack';
import { FiClock, FiCheck, FiAlertTriangle, FiVolume2, FiCheckCircle } from 'react-icons/fi';

// ============================================
// SOM DE BEEP (Web Audio API)
// ============================================
const playBeep = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const audioCtx = new AudioCtx();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.frequency.value = 880; // Hz (nota La)
    oscillator.type = 'square';
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5);
  } catch (err) {
    console.warn('[KDS] Beep failed:', err.message);
  }
};

// ============================================
// HELPERS DE COR POR TEMPO
// ============================================
const getTimeColor = (createdAt) => {
  const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (elapsed >= 15) return { bg: 'bg-red-500', text: 'text-white', border: 'border-red-700', label: 'ATRASADO' };
  if (elapsed >= 10) return { bg: 'bg-amber-400', text: 'text-black', border: 'border-amber-600', label: 'ATENÇÃO' };
  return { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-700', label: 'NO PRAZO' };
};

const formatElapsed = (createdAt) => {
  const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (elapsed < 1) return 'Agora';
  return `${elapsed} min`;
};

// ============================================
// CARD DE PEDIDO
// ============================================
const OrderCard = ({ order, onAccept, onReady, onServed, onRush }) => {
  const [, setTick] = useState(0);
  const color = getTimeColor(order.timers?.createdAt || order.createdAt);

  // Timer que atualiza a cada segundo
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const status = order.status;
  const isPending = status === 'pending';
  const isPreparing = status === 'preparing';
  const isReady = status === 'ready';
  const isServed = status === 'served';

  const itemCount = order.items?.length || 0;
  const totalItems = order.items?.reduce((sum, i) => sum + (i.quantity || 1), 0) || 0;

  return (
    <div className={`rounded-xl shadow-lg border-2 ${color.border} ${color.bg} ${color.text} overflow-hidden flex flex-col transition-all hover:shadow-xl`}>
      {/* Cabecalho */}
      <div className="px-4 py-3 border-b border-black/20 bg-black/10">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xl font-bold">{order.orderNumber || `#${order.kdsOrderId?.slice(-6)}`}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${color.bg === 'bg-emerald-500' ? 'bg-white/30' : 'bg-black/20'} flex items-center gap-1`}>
            <FiClock size={12} />
            {formatElapsed(order.timers?.createdAt || order.createdAt)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">
            {order.orderType === 'dine-in' ? `Mesa ${order.tableNumber || '?'}` :
             order.orderType === 'delivery' ? 'DELIVERY' :
             order.orderType === 'takeout' ? 'PARA LEVAR' : 'BALCAO'}
          </span>
          <span className="opacity-80">{itemCount} itens ({totalItems} un.)</span>
        </div>
        {order.customerName && (
          <div className="text-xs opacity-80 mt-0.5">Cliente: {order.customerName}</div>
        )}
        {order.priority === 'urgent' && (
          <div className="flex items-center gap-1 mt-1 text-xs font-bold bg-yellow-300 text-black px-2 py-0.5 rounded w-fit">
            <FiAlertTriangle size={12} />
            URGENTE
          </div>
        )}
      </div>

      {/* Itens */}
      <div className="flex-1 px-4 py-2 space-y-1.5 bg-white/95 text-black">
        {order.items?.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2 text-sm">
            <span className="font-bold text-base min-w-[2rem]">{item.quantity}x</span>
            <div className="flex-1">
              <div className="font-semibold">{item.productName}</div>
              {item.notes && (
                <div className="text-xs text-amber-700 italic mt-0.5">
                  &gt;&gt; {item.notes}
                </div>
              )}
              {item.modifiers?.length > 0 && (
                <div className="text-xs text-gray-600 mt-0.5">
                  {item.modifiers.map((m, i) => (
                    <span key={i}>+ {typeof m === 'string' ? m : m.name} </span>
                  ))}
                </div>
              )}
            </div>
            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
              item.status === 'ready' ? 'bg-emerald-100 text-emerald-800' :
              item.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
              item.status === 'served' ? 'bg-gray-100 text-gray-800' :
              'bg-gray-200 text-gray-600'
            }`}>
              {item.status === 'ready' ? 'PRONTO' :
               item.status === 'preparing' ? 'PREPARANDO' :
               item.status === 'served' ? 'ENTREGUE' :
               item.status === 'cancelled' ? 'CANCELADO' : 'PENDENTE'}
            </span>
          </div>
        ))}

        {/* Observacoes gerais */}
        {order.metadata?.notes && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="text-xs font-bold text-red-600 mb-0.5">OBSERVACOES:</div>
            <div className="text-xs italic text-gray-700">{order.metadata.notes}</div>
          </div>
        )}
      </div>

      {/* Acoes */}
      <div className="px-4 py-3 border-t border-black/20 bg-black/10 flex gap-2">
        {isPending && (
          <button
            onClick={() => onAccept(order)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <FiCheck size={16} />
            ACEITAR
          </button>
        )}
        {isPreparing && (
          <button
            onClick={() => onReady(order)}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <FiCheck size={16} />
            PRONTO
          </button>
        )}
        {isReady && (
          <button
            onClick={() => onServed(order)}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <FiCheck size={16} />
            ENTREGAR
          </button>
        )}
        {!isServed && order.priority !== 'urgent' && (
          <button
            onClick={() => onRush(order)}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
            title="Marcar como urgente"
          >
            <FiAlertTriangle size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
const KitchenDisplay = () => {
  const queryClient = useQueryClient();
  const { socket, connected } = useSocket();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [filterStation, setFilterStation] = useState('kitchen');
  const audioUnlockedRef = useRef(false);

  // Buscar pedidos iniciais
  const { data, isLoading, isError } = useQuery({
    queryKey: ['kdsOrders', filterStation],
    queryFn: () => getKDSOrders({ station: filterStation }),
    refetchInterval: 30000, // Fallback: polling a cada 30s
    staleTime: 10000,
  });

  const orders = data?.data?.data || data?.data || [];

  // Filtrar apenas pedidos ativos (nao servidos/cancelados)
  const activeOrders = orders.filter(o => !['served', 'cancelled'].includes(o.status));

  // ============================================
  // MUTACOES
  // ============================================
  const acceptMutation = useMutation({
    mutationFn: acceptKDSOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kdsOrders'] });
      enqueueSnackbar('Pedido aceito!', { variant: 'success' });
    },
    onError: (err) => {
      enqueueSnackbar(err?.response?.data?.message || 'Erro ao aceitar pedido', { variant: 'error' });
    }
  });

  const readyMutation = useMutation({
    mutationFn: markKDSReady,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kdsOrders'] });
      enqueueSnackbar('Pedido marcado como pronto!', { variant: 'success' });
    },
    onError: (err) => {
      enqueueSnackbar(err?.response?.data?.message || 'Erro ao marcar pronto', { variant: 'error' });
    }
  });

  const servedMutation = useMutation({
    mutationFn: markKDSServed,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kdsOrders'] });
      enqueueSnackbar('Pedido entregue!', { variant: 'success' });
    },
    onError: (err) => {
      enqueueSnackbar(err?.response?.data?.message || 'Erro ao entregar pedido', { variant: 'error' });
    }
  });

  const rushMutation = useMutation({
    mutationFn: rushKDSOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kdsOrders'] });
      enqueueSnackbar('Pedido marcado como urgente!', { variant: 'warning' });
    },
    onError: (err) => {
      enqueueSnackbar(err?.response?.data?.message || 'Erro ao marcar urgente', { variant: 'error' });
    }
  });

  // ============================================
  // WEBSOCKET EVENT HANDLERS
  // ============================================
  const handleNewOrder = useCallback((data) => {
    console.log('[KDS] Novo pedido recebido:', data);
    queryClient.invalidateQueries({ queryKey: ['kdsOrders'] });

    // Tocar beep
    if (soundEnabled) {
      playBeep();
    }

    enqueueSnackbar(`Novo pedido: ${data.orderNumber || data.kdsOrderId?.slice(-6)}`, {
      variant: 'info',
      autoHideDuration: 5000
    });
  }, [queryClient, soundEnabled]);

  const handleOrderReady = useCallback((data) => {
    console.log('[KDS] Pedido pronto:', data);
    queryClient.invalidateQueries({ queryKey: ['kdsOrders'] });
  }, [queryClient]);

  const handleOrderServed = useCallback((data) => {
    console.log('[KDS] Pedido entregue:', data);
    queryClient.invalidateQueries({ queryKey: ['kdsOrders'] });
  }, [queryClient]);

  const handleOrderCancelled = useCallback((data) => {
    console.log('[KDS] Pedido cancelado:', data);
    queryClient.invalidateQueries({ queryKey: ['kdsOrders'] });
    enqueueSnackbar(`Pedido ${data.orderNumber || ''} cancelado`, { variant: 'warning' });
  }, [queryClient]);

  const handleOrderRushed = useCallback((data) => {
    console.log('[KDS] Pedido urgente:', data);
    queryClient.invalidateQueries({ queryKey: ['kdsOrders'] });
    if (soundEnabled) {
      playBeep();
    }
  }, [queryClient, soundEnabled]);

  // Registrar listeners WebSocket
  useEffect(() => {
    if (!socket) return;

    socket.on('kds:order-synced', handleNewOrder);
    socket.on('kds:order-ready', handleOrderReady);
    socket.on('kds:order-served', handleOrderServed);
    socket.on('kds:order-cancelled', handleOrderCancelled);
    socket.on('kds:order-rushed', handleOrderRushed);

    return () => {
      socket.off('kds:order-synced', handleNewOrder);
      socket.off('kds:order-ready', handleOrderReady);
      socket.off('kds:order-served', handleOrderServed);
      socket.off('kds:order-cancelled', handleOrderCancelled);
      socket.off('kds:order-rushed', handleOrderRushed);
    };
  }, [socket, handleNewOrder, handleOrderReady, handleOrderServed, handleOrderCancelled, handleOrderRushed]);

  // Desbloquear audio no primeiro clique
  const handleUnlockAudio = () => {
    if (!audioUnlockedRef.current) {
      playBeep();
      audioUnlockedRef.current = true;
    }
  };

  // ============================================
  // RENDER
  // ============================================
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl">Carregando pedidos...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-xl text-red-400">Erro ao carregar pedidos</p>
          <p className="text-sm text-gray-400 mt-2">Verifique sua conexao e tente novamente</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white" onClick={handleUnlockAudio}>
      {/* Header */}
      <div className="bg-gray-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-gray-700">
        <div className="flex items-center gap-3 sm:gap-4">
          <h1 className="text-lg sm:text-2xl font-bold whitespace-nowrap">🍳 COZINHA</h1>
          <div className={`flex items-center gap-2 text-sm ${connected ? 'text-emerald-400' : 'text-red-400'}`}>
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'} animate-pulse`}></div>
            {connected ? 'Online' : 'Offline'}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Filtro de estação */}
          <select
            value={filterStation}
            onChange={(e) => setFilterStation(e.target.value)}
            className="bg-gray-700 text-white px-2 sm:px-3 py-1.5 rounded-lg text-sm border border-gray-600"
          >
            <option value="kitchen">Cozinha</option>
            <option value="bar">Bar</option>
            <option value="expo">Expedição</option>
          </select>

          {/* Toggle som */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSoundEnabled(!soundEnabled);
            }}
            className={`p-2 rounded-lg transition-colors ${soundEnabled ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-600 hover:bg-gray-700'}`}
            title={soundEnabled ? 'Som ativado' : 'Som desativado'}
          >
            <FiVolume2 size={20} />
          </button>

          {/* Contador de pedidos */}
          <div className="bg-gray-700 px-2 sm:px-3 py-1.5 rounded-lg text-sm">
            <span className="text-gray-400 hidden sm:inline">Pedidos: </span>
            <span className="text-gray-400 sm:hidden">P: </span>
            <span className="font-bold text-lg">{activeOrders.length}</span>
          </div>
        </div>
      </div>

      {/* Grid de pedidos */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeOrders.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <FiCheckCircle className="mx-auto mb-4 text-emerald-500" size={48} />
              <p className="text-2xl text-gray-400">Nenhum pedido na fila</p>
              <p className="text-sm text-gray-500 mt-2">Os pedidos aparecerão aqui automaticamente</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {activeOrders.map(order => (
              <OrderCard
                key={order.kdsOrderId || order._id}
                order={order}
                onAccept={(o) => acceptMutation.mutate(o.kdsOrderId || o._id)}
                onReady={(o) => readyMutation.mutate(o.kdsOrderId || o._id)}
                onServed={(o) => servedMutation.mutate(o.kdsOrderId || o._id)}
                onRush={(o) => rushMutation.mutate(o.kdsOrderId || o._id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default KitchenDisplay;
