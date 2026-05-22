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
    <header className="fixed top-0 left-64 right-0 z-30 h-14 bg-zinc-950/80 backdrop-blur border-b border-zinc-800 flex items-center justify-between px-6">
      <div className="text-sm text-zinc-400">
        Sistema POS &mdash; Painel Administrativo
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors outline-none">
          <User className="h-4 w-4" />
          <span className="text-sm">Admin</span>
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-zinc-900 border-zinc-800 text-zinc-300">
          <DropdownMenuItem className="text-sm cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            Perfil
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-zinc-800" />
          <DropdownMenuItem
            className="text-red-400 cursor-pointer"
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
