import React, { useEffect } from 'react';
import PdvFooterActions from '../components/pdv/PdvFooterActions';
import MenuContainer from '../components/menu/MenuContainer';
import CustomerInfo from '../components/menu/CustomerInfo';
import CartInfo from '../components/menu/CartInfo';
import Bill from '../components/menu/Bill';
import { useSelector } from 'react-redux';
import PdvModeBadge from '../components/pdv/PdvModeBadge';

const Menu = () => {
  useEffect(() => {
    document.title = 'POS | PDV';
  }, []);

  const customerData = useSelector((state) => state.customer);

  return (
    <section className="h-[calc(100vh-3.5rem)] bg-gray-100 overflow-hidden flex flex-col">
      <div className="flex-1 flex overflow-hidden">
        {/* ===== LEFT PANEL — Cart & Totals (fixed width) ===== */}
        <div className="w-[380px] bg-white border-r border-gray-200 flex flex-col flex-shrink-0 shadow-sm">
          {/* Mini mode badge for mobile */}
          <div className="flex-shrink-0 px-4 pt-3 pb-1 md:hidden">
            <PdvModeBadge
              orderType={customerData.orderType}
              tableNo={customerData.table?.tableNo}
            />
          </div>

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

      {/* ===== OPERATIONAL FOOTER (Area 5) ===== */}
      <PdvFooterActions />
    </section>
  );
};

export default Menu;
