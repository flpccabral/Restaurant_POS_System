import React from 'react';

const PdvModeBadge = ({ orderType, tableNo }) => {
  const isCounter = orderType === 'counter';
  const isPickup = orderType === 'pickup';
  const isDelivery = orderType === 'delivery';

  const config = isCounter
    ? { label: 'BALCAO', bg: 'bg-emerald-500', text: 'text-white', icon: '■' }
    : isPickup
    ? { label: 'PICKUP', bg: 'bg-purple-500', text: 'text-white', icon: '▲' }
    : isDelivery
    ? { label: 'DELIVERY', bg: 'bg-orange-500', text: 'text-white', icon: '●' }
    : { label: `MESA ${tableNo || ''}`, bg: 'bg-amber-500', text: 'text-white', icon: '◆' };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-sm tracking-wider ${config.bg} ${config.text} shadow-sm`}
    >
      <span className="text-base">{config.icon}</span>
      {config.label}
    </span>
  );
};

export default PdvModeBadge;
