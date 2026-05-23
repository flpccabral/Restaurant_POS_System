import React from "react";
import { MdErrorOutline } from "react-icons/md";

const ErrorState = ({ message = "Falha ao carregar dados.", onRetry }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <MdErrorOutline className="text-5xl text-[#ff6b6b] mb-4" />
    <p className="text-[#f5f5f5] text-lg font-medium mb-2">Erro de Conexão</p>
    <p className="text-[#ababab] text-sm mb-6">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="bg-[#262626] hover:bg-[#333] text-[#f5f5f5] px-6 py-2 rounded-lg font-medium text-sm"
      >
        Tentar Novamente
      </button>
    )}
  </div>
);

export default ErrorState;
