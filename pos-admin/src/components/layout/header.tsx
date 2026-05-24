"use client";

import { User, LogOut, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authService } from "@/services/api/auth";
import { useRouter } from "next/navigation";
import { StoreContextSelector } from "@/components/console/StoreContextSelector";

export function Header() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // Logout even if API call fails
    }
    router.push("/login");
  };

  return (
    <header className="fixed top-0 left-64 right-0 z-30 h-14 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between px-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="hidden md:inline">Sistema POS</span>
        <span className="hidden md:inline text-muted-foreground/50">&mdash;</span>
        <span>Painel Administrativo</span>
        {/* Store context selector — visible for master admin, informative for regular users */}
        <div className="ml-4 pl-4 border-l border-border">
          <StoreContextSelector />
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-brand-muted">
            <User className="h-3.5 w-3.5 text-brand" />
          </div>
          <span className="text-sm font-medium">Admin</span>
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem className="text-sm cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            Perfil
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-critical cursor-pointer"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
