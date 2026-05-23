import React from "react";
import { motion } from "framer-motion";
import { MdWarning, MdCheckCircle, MdClose } from "react-icons/md";

const actionLabels = {
  resolve: {
    title: "Resolver Alerta",
    confirm: "Resolver",
    description:
      "This will mark the alert as resolved. The system will stop showing this alert unless the condition reoccurs.",
    icon: <MdCheckCircle className="text-[#2ed573] text-2xl" />,
  },
  dismiss: {
    title: "Ignorar Alerta",
    confirm: "Ignorar",
    description:
      "This will dismiss the alert. It will be hidden from the active alerts list.",
    icon: <MdClose className="text-[#ababab] text-2xl" />,
  },
  central_to_store: {
    title: "Transferencia Central -> Loja",
    confirm: "Executar Transferencia",
    description:
      "This will transfer stock from the central warehouse to the store. This action cannot be undone automatically.",
    icon: <MdWarning className="text-[#feca57] text-2xl" />,
  },
  inter_store_transfer: {
    title: "Transferencia entre Lojas",
    confirm: "Executar Transferencia",
    description:
      "This will transfer stock from one store to another. Verify that both stores are compatible before proceeding.",
    icon: <MdWarning className="text-[#feca57] text-2xl" />,
  },
  purchase_needed: {
    title: "Registrar Compra",
    confirm: "Registrar",
    description:
      "This will register a purchase note. No actual purchase order is created -- this is just a record.",
    icon: <MdCheckCircle className="text-[#54a0ff] text-2xl" />,
  },
};

const ConfirmActionModal = ({
  isOpen,
  onClose,
  onConfirm,
  actionType,
  details,
  isLoading,
}) => {
  if (!isOpen) return null;

  const config = actionLabels[actionType] || {
    title: "Confirmar Acao",
    confirm: "Confirmar",
    description: "Tem certeza que deseja executar esta acao?",
    icon: <MdWarning className="text-[#feca57] text-2xl" />,
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="bg-[#1a1a1a] rounded-lg shadow-lg w-full max-w-lg mx-4 border border-[#333]"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#333]">
          {config.icon}
          <h2 className="text-lg text-[#f5f5f5] font-semibold">
            {config.title}
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <p className="text-[#ababab] text-sm">{config.description}</p>

          {details && (
            <div className="bg-[#1f1f1f] rounded-lg p-4 space-y-2 text-sm">
              {details.ingredient && (
                <div className="flex justify-between">
                  <span className="text-[#ababab]">Ingrediente</span>
                  <span className="text-[#f5f5f5] font-medium">
                    {details.ingredient}
                  </span>
                </div>
              )}
              {details.quantity != null && (
                <div className="flex justify-between">
                  <span className="text-[#ababab]">Quantidade</span>
                  <span className="text-[#f5f5f5] font-medium">
                    {details.quantity}
                    {details.unit || ""}
                  </span>
                </div>
              )}
              {details.origin && (
                <div className="flex justify-between">
                  <span className="text-[#ababab]">Origem</span>
                  <span className="text-[#f5f5f5] font-medium">
                    {details.origin}
                  </span>
                </div>
              )}
              {details.destination && (
                <div className="flex justify-between">
                  <span className="text-[#ababab]">Destino</span>
                  <span className="text-[#f5f5f5] font-medium">
                    {details.destination}
                  </span>
                </div>
              )}
              {details.currentBalance != null && (
                <div className="flex justify-between">
                  <span className="text-[#ababab]">Saldo Atual</span>
                  <span className="text-[#f5f5f5] font-medium">
                    {details.currentBalance}
                    {details.unit || ""}
                  </span>
                </div>
              )}
              {details.justification && (
                <div className="pt-2 border-t border-[#333]">
                  <span className="text-[#ababab] text-xs">Justificativa</span>
                  <p className="text-[#f5f5f5] text-sm mt-1">
                    {details.justification}
                  </p>
                </div>
              )}
              {details.risks && (
                <div className="pt-2 border-t border-[#333]">
                  <span className="text-[#ff6b6b] text-xs font-medium">
                    Riscos
                  </span>
                  <p className="text-[#ff6b6b] text-sm mt-1">
                    {details.risks}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#333]">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="bg-[#262626] hover:bg-[#333] text-[#ababab] px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={
              actionType === "dismiss"
                ? "bg-[#333] hover:bg-[#444] text-[#f5f5f5] px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                : "bg-[#1a3a1a] hover:bg-[#2a5a2a] text-[#2ed573] px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            }
          >
            {isLoading && (
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {config.confirm}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ConfirmActionModal;
