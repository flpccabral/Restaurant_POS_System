import { useEffect, useState } from 'react';
import PdvFooterActions from '../components/pdv/PdvFooterActions';
import MenuContainer from '../components/menu/MenuContainer';
import CustomerInfo from '../components/menu/CustomerInfo';
import CartInfo from '../components/menu/CartInfo';
import Bill from '../components/menu/Bill';
import { useSelector } from 'react-redux';
import PdvModeBadge from '../components/pdv/PdvModeBadge';
import { FaShoppingCart, FaChevronDown } from 'react-icons/fa';

const Menu = () => {
  useEffect(() => {
    document.title = 'POS | PDV';
  }, []);

  const customerData = useSelector((state) => state.customer);
  const cartData = useSelector((state) => state.cart);
  const [cartOpen, setCartOpen] = useState(false);

  const cartCount = cartData.length;

  return (
    <section className="h-[calc(100vh-3.5rem)] bg-gray-100 overflow-hidden flex flex-col relative">
      <div className="flex-1 flex overflow-hidden">
        {/* ===== LEFT PANEL — Cart & Totals (fixed width on desktop) ===== */}
        <div className="hidden lg:flex lg:w-[380px] bg-white border-r border-gray-200 flex-col flex-shrink-0 shadow-sm">
          {/* Customer summary */}
          <div className="flex-shrink-0">
            <CustomerInfo />
          </div>

          {/* Cart items — scrollable */}
          <CartInfo />

          {/* Totals + Payment — fixed at bottom */}
          <Bill />
        </div>

        {/* ===== RIGHT PANEL — Categories + Products ===== */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
          <MenuContainer />
        </div>
      </div>

      {/* ===== MOBILE FLOATING CART TOGGLE ===== */}
      <button
        onClick={() => setCartOpen(true)}
        className="lg:hidden fixed bottom-20 right-4 z-40 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-lg transition-colors"
        aria-label="Abrir carrinho"
      >
        <FaShoppingCart size={18} />
        {cartCount > 0 && (
          <span className="bg-white text-blue-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
            {cartCount}
          </span>
        )}
        <span className="text-sm font-semibold">Carrinho</span>
      </button>

      {/* ===== MOBILE CART DRAWER / BOTTOM SHEET ===== */}
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black bg-opacity-50"
            onClick={() => setCartOpen(false)}
            aria-hidden="true"
          />

          {/* Sheet */}
          <div className="bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh] animate-[slideUp_0.2s_ease-out]"
          >
            {/* Drag handle */}
            <div className="flex items-center justify-center pt-2 pb-1 border-b border-gray-100">
              <button
                onClick={() => setCartOpen(false)}
                className="flex items-center gap-1 text-gray-400 hover:text-gray-600 px-4 py-1"
                aria-label="Fechar carrinho"
              >
                <FaChevronDown size={14} />
                <span className="text-xs font-medium">Fechar</span>
              </button>
            </div>

            {/* Mini mode badge for mobile */}
            <div className="flex-shrink-0 px-4 pt-3 pb-1">
              <PdvModeBadge
                orderType={customerData.orderType}
                tableNo={customerData.table?.tableNo}
              />
            </div>

            <div className="flex-shrink-0">
              <CustomerInfo />
            </div>

            <CartInfo />

            <Bill />
          </div>
        </div>
      )}

      {/* ===== OPERATIONAL FOOTER (Area 5) ===== */}
      <PdvFooterActions />
    </section>
  );
};

export default Menu;
