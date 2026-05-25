import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

const Greetings = () => {
  const userData = useSelector((state) => state.user);
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date) => {
    const months = [
      'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];
    return `${months[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
  };

  const formatTime = (date) =>
    `${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes()
    ).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;

  return (
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-gray-900 text-2xl font-bold tracking-tight">
          Bom dia, {userData.name || 'OPERADOR'}
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Ofereca o melhor servico aos clientes
        </p>
      </div>
      <div className="text-right">
        <h1 className="text-gray-900 text-3xl font-extrabold tracking-tight tabular-nums">
          {formatTime(dateTime)}
        </h1>
        <p className="text-gray-400 text-sm">{formatDate(dateTime)}</p>
      </div>
    </div>
  );
};

export default Greetings;
