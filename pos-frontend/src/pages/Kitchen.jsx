/**
 * Pagina de Cozinha (KDS) — Tela de Cozinha Fullscreen
 *
 * - Sem Header (layout alternativo)
 * - Ocupa 100% da tela
 * - Modo quiosque (tela cheia)
 */
import React, { useEffect } from 'react';
import KitchenDisplay from '../components/kds/KitchenDisplay';

const Kitchen = () => {
  useEffect(() => {
    document.title = 'POS | Cozinha';
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900">
      <KitchenDisplay />
    </div>
  );
};

export default Kitchen;
