import PropTypes from 'prop-types';

const MiniCard = ({ title, icon, number, footer, accent = 'blue' }) => {
  const lowerTitle = title.toLowerCase();
  const isRevenue = lowerTitle.includes('venda') || lowerTitle.includes('receita');

  const accentMap = {
    blue: 'bg-blue-600',
    emerald: 'bg-emerald-600',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    slate: 'bg-slate-600',
  };
  const iconBg = accentMap[accent] || accentMap.blue;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex-1 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-gray-500 text-sm font-semibold uppercase tracking-wide truncate">
          {title}
        </h3>
        <span className={`p-2.5 rounded-lg text-white text-lg shadow-sm shrink-0 ${iconBg}`}>
          {icon}
        </span>
      </div>
      <div className="mt-4">
        <h2 className="text-gray-900 text-2xl sm:text-3xl font-extrabold tracking-tight truncate">
          {isRevenue ? `R$ ${Number(number).toLocaleString('pt-BR')}` : number}
        </h2>
        {footer && (
          <p className="text-gray-500 text-sm mt-1 truncate">{footer}</p>
        )}
      </div>
    </div>
  );
};

MiniCard.propTypes = {
  title: PropTypes.string.isRequired,
  icon: PropTypes.element.isRequired,
  number: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  footer: PropTypes.string,
  accent: PropTypes.oneOf(['blue', 'emerald', 'amber', 'rose', 'slate']),
};

export default MiniCard;
