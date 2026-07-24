"use client";

import { User, LogOut, ChevronDown, Menu } from "lucide-react";
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
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
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
    <header className="fixed top-0 left-0 lg:left-64 right-0 z-30 h-14 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 lg:px-6 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onMenuToggle}
          aria-label="Abrir menu de navegação"
          className="lg:hidden -ml-1 shrink-0"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground shrink-0">
          <span>Sistema POS</span>
          <span className="text-muted-foreground/50">—</span>
          <span>Painel Administrativo</span>
        </div>

        {/* Store context selector — visible for master admin, informative for regular users */}
        <div className="hidden sm:flex items-center ml-2 pl-2 lg:pl-4 lg:border-l border-border min-w-0">
          <div className="min-w-0 max-w-[140px] md:max-w-[200px] lg:max-w-[240px]">
            <StoreContextSelector />
          </div>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 px-2 lg:px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background shrink-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-brand-muted shrink-0">
            <User className="h-3.5 w-3.5 text-brand" />
          </div>
          <span className="text-sm font-medium hidden sm:inline">Admin</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
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
