import { useSelector } from "react-redux";

/**
 * Hook para verificar permissoes do usuario logado.
 *
 * A estrutura de permissoes segue o modelo Role:
 *   { inventory: { read: true, adjust: true, transfer: false } }
 *
 * Uso:
 *   const { can } = useCapabilities();
 *   if (can('inventory', 'adjust')) { ... }
 */
export const useCapabilities = () => {
  const user = useSelector((state) => state.user);

  /**
   * Verifica se o usuario tem permissao para um modulo/acao.
   * @param {string} module - Modulo (ex: 'inventory', 'orders')
   * @param {string} action - Acao (ex: 'read', 'adjust', 'transfer')
   * @returns {boolean}
   */
  const can = (module, action) => {
    // Master admin bypasses all checks
    if (user.isMasterAdmin) return true;

    // Legacy string role 'Admin' bypasses all checks
    if (user.role === "Admin") return true;

    // Check permissions from the populated Role document
    const permissions = user.rolePermissions;
    if (!permissions) return false;

    const modulePerms = permissions[module];
    if (!modulePerms) return false;

    return modulePerms[action] === true;
  };

  return { can };
};
