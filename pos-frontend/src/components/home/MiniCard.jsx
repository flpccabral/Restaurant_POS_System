import React from 'react';

const MiniCard = ({ title, icon, number, footerNum }) => {
  const isRevenue = title === 'Ganhos Totais';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex-1">
      <div className="flex items-start justify-between">
        <h3 className="text-gray-500 text-sm font-semibold uppercase tracking-wide">
          {title}
        </h3>
        <span
          className={`p-3 rounded-lg text-white text-xl shadow-sm ${
            isRevenue ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
        >
          {icon}
        </span>
      </div>
      <div className="mt-4">
        <h2 className="text-gray-900 text-3xl font-extrabold tracking-tight">
          {isRevenue ? `R$${number}` : number}
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          <span className="text-emerald-500 font-semibold">{footerNum}%</span> do que ontem
        </p>
      </div>
    </div>
  );
};

export default MiniCard;
