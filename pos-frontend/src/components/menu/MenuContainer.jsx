import { useState, useMemo } from 'react';
import { FiPlus, FiMinus, FiCheck, FiTag } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { getProducts } from '../../https';
import { addItems } from '../../redux/slices/cartSlice';

const READINESS_WARN = ['ready_missing_recipe', 'ready_missing_direct', 'incomplete_config'];

const variationSku = (product) => {
  const vars = product.variations || [];
  if (vars.length === 1) return vars[0].sku || null;
  return null;
};

const chooseVariation = (product) => {
  const vars = product.variations || [];
  if (!vars.length) return null;
  const active = vars.filter((v) => v.isActive !== false);
  if (active.length === 1) return active[0];
  return active.length > 0 ? active[0] : vars[0];
};

const plural = (n, singular, pluralForm) =>
  n === 1 ? `${n} ${singular}` : `${n} ${pluralForm || singular + 's'}`;

const MenuContainer = () => {
  const dispatch = useDispatch();
  const storeId = useSelector((s) => s.user?.store?._id || s.user?.store);
  const [selectedCat, setSelectedCat] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [selectedVariations, setSelectedVariations] = useState({});
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['products', storeId],
    queryFn: () => getProducts({ isActive: 'true', isCurrent: 'true', storeId }),
  });

  const products = useMemo(() => {
    const list = data?.data?.data || data?.data || [];
    return Array.isArray(list) ? list : [];
  }, [data]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const lowerQuery = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const nameMatch = p.name?.toLowerCase().includes(lowerQuery);
      const skuMatch = p.sku?.toLowerCase().includes(lowerQuery);
      const variations = p.variations || [];
      const varMatch = variations.some(
        (v) =>
          (v.name || '').toLowerCase().includes(lowerQuery) ||
          (v.sku || '').toLowerCase().includes(lowerQuery)
      );
      return nameMatch || skuMatch || varMatch;
    });
  }, [products, searchQuery]);

  const menus = useMemo(() => {
    const grouped = {};
    for (const p of filteredProducts) {
      const catName = p.category?.name || p.category || 'Sem categoria';
      if (!grouped[catName]) grouped[catName] = [];
      grouped[catName].push(p);
    }
    return Object.entries(grouped).map(([catName, items]) => ({
      id: catName,
      name: catName,
      items,
    }));
  }, [filteredProducts]);

  const selected = useMemo(() => {
    if (!menus.length) return null;
    if (selectedCat) return menus.find((m) => m.id === selectedCat) || menus[0];
    return menus[0];
  }, [menus, selectedCat]);

  const inc = (id) => {
    setQuantities((prev) => {
      const cur = prev[id] || 0;
      return { ...prev, [id]: cur >= 99 ? 99 : cur + 1 };
    });
  };

  const dec = (id) => {
    setQuantities((prev) => {
      const cur = prev[id] || 0;
      return { ...prev, [id]: cur <= 0 ? 0 : cur - 1 };
    });
  };

  const handleAddToCart = (product) => {
    const qty = quantities[product._id] || 0;
    if (qty <= 0) return;

    const chosenVar =
      selectedVariations[product._id] || chooseVariation(product);
    const varName = chosenVar?.name || 'Padrão';
    const varSku = chosenVar?.sku || variationSku(product) || '';
    const varPrice =
      chosenVar?.price ?? product.price ?? product.variations?.[0]?.price ?? 0;

    const newItem = {
      id: Date.now(),
      product: product._id,
      productId: product._id,
      name: `${product.name}${varName !== 'Padrão' ? ` (${varName})` : ''}`,
      quantity: qty,
      pricePerQuantity: varPrice,
      price: varPrice * qty,
      variation: varSku,
      sku: varSku,
      sellableType: product.sellableType,
      stockImpactRule: product.stockImpactRule,
      productReadinessStatus: product.productReadinessStatus,
      notes: '',
    };
    dispatch(addItems(newItem));
    setQuantities((prev) => ({ ...prev, [product._id]: 0 }));
  };

  const setVariation = (productId, variation) => {
    setSelectedVariations((prev) => ({ ...prev, [productId]: variation }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Carregando produtos...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 px-4">
        <p className="text-red-500 text-sm font-medium">Erro ao carregar produtos</p>
        <button
          onClick={() => refetch()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!menus.length) {
    return (
      <div className="flex items-center justify-center h-64 px-4">
        <p className="text-gray-400 text-sm">
          {searchQuery
            ? `Nenhum produto encontrado para "${searchQuery}"`
            : 'Nenhum produto disponível'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {searchQuery && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex-shrink-0">
          <p className="text-blue-700 text-sm font-medium">
            Resultados para: &ldquo;{searchQuery}&rdquo; ({filteredProducts.length} encontrados)
          </p>
        </div>
      )}

      {!searchQuery && (
        <div className="flex-shrink-0 px-4 pt-4 pb-2">
          <div className="flex lg:grid lg:grid-cols-6 gap-2 overflow-x-auto scrollbar-hide pb-1">
            {menus.map((menu) => {
              const isActive = selected?.id === menu.id;
              return (
                <button
                  key={menu.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-300 hover:text-blue-700'
                  }`}
                  onClick={() => {
                    setSelectedCat(menu.id);
                    setQuantities({});
                  }}
                  title={menu.name}
                >
                  <FiTag size={14} />
                  <span className="truncate max-w-[120px]">{menu.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
                    {menu.items.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!searchQuery && selected && (
        <div className="flex-shrink-0 px-4 pb-1">
          <p className="text-gray-500 text-xs font-medium">
            {selected.name} · {plural(selected.items.length, 'produto', 'produtos')}
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-4 lg:pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2 pb-16 lg:pb-0">
          {selected?.items.map((product) => {
            const vars = (product.variations || []).filter(
              (v) => v.isActive !== false
            );
            const selVar =
              selectedVariations[product._id] || chooseVariation(product);
            const displayPrice =
              selVar?.price ?? product.price ?? vars[0]?.price ?? 0;
            const readiness = product.productReadinessStatus;
            const isWarn = READINESS_WARN.includes(readiness);
            const qty = quantities[product._id] || 0;
            const hasQty = qty > 0;

            return (
              <div
                key={product._id}
                className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all duration-150 flex flex-col ${
                  isWarn
                    ? 'border-red-200 bg-red-50'
                    : hasQty
                    ? 'border-blue-300 ring-1 ring-blue-200'
                    : 'border-gray-200 hover:shadow-md hover:border-gray-300'
                }`}
              >
                <div className="p-3 pb-2 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-gray-900 text-sm font-bold leading-tight">
                        {product.name}
                      </h3>
                      {isWarn && (
                        <span className="text-red-500 text-[10px] font-medium block mt-0.5">
                          {product.productReadinessLabel || 'Configuração pendente'}
                        </span>
                      )}
                    </div>
                  </div>

                  {vars.length > 1 && (
                    <select
                      value={selVar?.sku || vars[0]?.sku || ''}
                      onChange={(e) => {
                        const chosen = vars.find(
                          (v) => v.sku === e.target.value
                        );
                        if (chosen) setVariation(product._id, chosen);
                      }}
                      className="bg-gray-50 text-gray-700 text-xs p-1.5 rounded w-full mt-2 border border-gray-200 outline-none focus:border-blue-400"
                    >
                      {vars.map((v) => (
                        <option key={v.sku} value={v.sku || v._id}>
                          {v.name} — R$ {Number(v.price || 0).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  )}

                  {vars.length === 1 && vars[0].name !== 'Padrão' && (
                    <p className="text-gray-500 text-[11px] mt-1">
                      {vars[0].name}
                    </p>
                  )}

                  <div className="mt-2">
                    <span className="text-gray-900 text-base font-extrabold">
                      R$ {Number(displayPrice).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => dec(product._id)}
                      className="w-9 h-9 rounded-md bg-white border border-gray-200 text-gray-500 font-bold text-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                      aria-label="Diminuir quantidade"
                    >
                      <FiMinus size={14} />
                    </button>
                    <span className="text-gray-900 font-bold text-sm min-w-[24px] text-center tabular-nums">
                      {qty}
                    </span>
                    <button
                      onClick={() => inc(product._id)}
                      className="w-9 h-9 rounded-md bg-white border border-gray-200 text-gray-700 font-bold text-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                      aria-label="Aumentar quantidade"
                    >
                      <FiPlus size={14} />
                    </button>
                  </div>

                  <button
                    onClick={() => handleAddToCart(product)}
                    disabled={isWarn}
                    className={`w-full rounded-lg py-2 text-sm font-bold flex items-center justify-center gap-1.5 transition-colors ${
                      isWarn
                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                        : hasQty
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100'
                    }`}
                  >
                    {hasQty ? <FiCheck size={14} /> : <FiPlus size={14} />}
                    {hasQty ? 'Adicionado' : 'Adicionar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MenuContainer;
