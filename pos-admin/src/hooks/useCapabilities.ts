"use client";

import { useQuery } from "@tanstack/react-query";
import { authService } from "@/services/api/auth";
import type { User } from "@/types";

interface RolePermissions {
  [module: string]: {
    [action: string]: boolean;
  };
}

interface ExtendedUser extends User {
  rolePermissions?: RolePermissions;
  isMasterAdmin?: boolean;
  store?: { _id: string; name: string };
}

interface UserResponse {
  success: boolean;
  data: ExtendedUser;
}

/**
 * Hook for checking user capabilities / permissions.
 *
 * Fetches the current user and derives permissions from the role.
 * Master admin bypasses all checks.
 *
 * @example
 * ```tsx
 * const { can, user, isLoading } = useCapabilities();
 * if (can("inventory", "adjust")) { ... }
 * ```
 */
export function useCapabilities() {
  const {
    data: userData,
    isLoading,
    isError,
  } = useQuery<ExtendedUser>({
    queryKey: ["current-user"],
    queryFn: () => authService.getUser().then((r: UserResponse) => r.data),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const isMasterAdmin = userData?.isMasterAdmin === true;
  const permissions = userData?.rolePermissions;
  const storeId = userData?.store?._id;

  /**
   * Check if the user has permission for a module/action.
   */
  const can = (module: string, action: string): boolean => {
    if (isMasterAdmin) return true;
    if (!permissions) return false;
    const modulePerms = permissions[module];
    if (!modulePerms) return false;
    return modulePerms[action] === true;
  };

  return {
    can,
    user: userData,
    storeId,
    isLoading,
    isError,
    isMasterAdmin,
  };
}
