/**
 * SocketProvider — Provider singleton para Socket.io
 *
 * Responsabilidades:
 * - Criar conexao Socket.io UMA unica vez
 * - Fazer join:store quando o usuario autenticado mudar de loja
 * - Disponibilizar socket e estado de conexao via context
 * - Cleanup (disconnect) no unmount
 *
 * Uso em main.jsx:
 *   <SocketProvider>
 *     <App />
 *   </SocketProvider>
 */
import React, { createContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useSelector } from 'react-redux';

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  // Obter usuario e loja do Redux
  const user = useSelector((state) => state.user);
  const storeId = user?.store || user?.user?.store;

  useEffect(() => {
    // URL do backend (mesma usada pelo axios)
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

    // Criar socket singleton (uma vez por sessao)
    if (!socketRef.current) {
      const socket = io(backendUrl, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socket.on('connect', () => {
        console.log(`[Socket] Conectado: ${socket.id}`);
        setConnected(true);
      });

      socket.on('disconnect', (reason) => {
        console.log(`[Socket] Desconectado: ${reason}`);
        setConnected(false);
      });

      socket.on('connect_error', (err) => {
        console.warn(`[Socket] Erro de conexao: ${err.message}`);
      });

      socketRef.current = socket;
    }

    // Cleanup ao desmontar
    return () => {
      if (socketRef.current) {
        console.log('[Socket] Encerrando conexao...');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []); // Executar apenas uma vez no mount

  // Fazer join:store quando o usuario autenticado mudar de loja
  useEffect(() => {
    if (socketRef.current && storeId) {
      console.log(`[Socket] Entrando na sala da loja: ${storeId}`);
      socketRef.current.emit('join:store', storeId);
    }
  }, [storeId]);

  const value = {
    socket: socketRef.current,
    connected,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketProvider;
