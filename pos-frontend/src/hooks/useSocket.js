/**
 * Hook singleton para acesso ao Socket.io
 *
 * Uso:
 *   const { socket, connected } = useSocket();
 *   socket.on('kds:order-synced', (data) => { ... });
 */
import { useContext } from 'react';
import { SocketContext } from '../components/socket/SocketProvider';

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket deve ser usado dentro de um SocketProvider');
  }
  return context;
};

export default useSocket;
