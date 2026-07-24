import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';

const Greetings = () => {
  const userData = useSelector((state) => state.user);
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hour = dateTime.getHours();
  const greeting = useMemo(() => {
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }, [hour]);

  const formatDate = (date) => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];
    return `${months[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
  };

  const formatTime = (date) =>
    `${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes()
    ).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;

  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
      <div>
        <h1 className="text-gray-900 text-2xl font-bold tracking-tight">
          {greeting}, {userData.name || 'Operador'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Ofereça o melhor serviço aos clientes
        </p>
      </div>
      <div className="text-left sm:text-right">
        <h2 className="text-gray-900 text-3xl font-extrabold tracking-tight tabular-nums">
          {formatTime(dateTime)}
        </h2>
        <p className="text-gray-500 text-sm">{formatDate(dateTime)}</p>
      </div>
    </div>
  );
};

Greetings.propTypes = {};

export default Greetings;
