import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTopProducts } from '../../https';
import { BiSolidDish } from 'react-icons/bi';

const PopularDishes = () => {
  const { data: resData, isLoading } = useQuery({
    queryKey: ['topProducts'],
    queryFn: () => getTopProducts({ period: '30days', limit: 10 }),
  });

  const products = resData?.data?.data?.products || [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-gray-900 text-lg font-bold tracking-tight">
          Pratos Populares
        </h2>
      </div>

      <div className="max-h-[620px] overflow-y-auto scrollbar-hide p-3">
        {isLoading ? (
          <p className="text-gray-400 text-center py-10 text-sm">Carregando...</p>
        ) : products.length === 0 ? (
          <p className="text-gray-400 text-center py-10 text-sm">
            Nenhum pedido no periodo
          </p>
        ) : (
          products.map((product, index) => (
            <div
              key={product.productId || index}
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="text-gray-300 font-bold text-lg w-8 flex-shrink-0 text-center">
                {index < 9 ? `0${index + 1}` : index + 1}
              </span>
              <span className="text-amber-500 text-3xl flex-shrink-0">
                <BiSolidDish />
              </span>
              <div className="flex-1 min-w-0">
                <h4 className="text-gray-900 font-semibold text-sm truncate">
                  {product.productName}
                </h4>
                <p className="text-gray-400 text-xs mt-0.5">
                  Pedidos: <span className="text-gray-700 font-semibold">{product.timesOrdered}</span>
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PopularDishes;
