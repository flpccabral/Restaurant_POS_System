"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Tags,
  Warehouse,
  Leaf,
  Truck,
  ClipboardList,
  Users,
  Store,
  Monitor,
  ShieldCheck,
  CreditCard,
  Receipt,
  ChefHat,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavSection {
  label: string;
  items: { label: string; href: string; icon: typeof LayoutDashboard }[];
}

const navSections: NavSection[] = [
  {
    label: "GERAL",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "PDV / Caixa", href: "/pdv", icon: Receipt },
      { label: "Cozinha (KDS)", href: "/kds", icon: ChefHat },
    ],
  },
  {
    label: "CADASTROS",
    items: [
      { label: "Produtos", href: "/products", icon: Package },
      { label: "Categorias", href: "/categories", icon: Tags },
      { label: "Ingredientes", href: "/ingredients", icon: Leaf },
      { label: "Fornecedores", href: "/suppliers", icon: Truck },
    ],
  },
  {
    label: "OPERACIONAL",
    items: [
      { label: "Estoque", href: "/inventory", icon: Warehouse },
      { label: "Pedidos de Compra", href: "/purchase-orders", icon: ClipboardList },
    ],
  },
  {
    label: "ADMINISTRATIVO",
    items: [
      { label: "Usuários", href: "/users", icon: Users },
      { label: "Lojas", href: "/stores", icon: Store },
      { label: "Dispositivos", href: "/devices", icon: Monitor },
      { label: "Perfis de Acesso", href: "/roles", icon: ShieldCheck },
      { label: "Assinatura", href: "/subscription", icon: CreditCard },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border overflow-y-auto">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-brand-muted">
          <ChefHat className="h-5 w-5 text-brand" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-base font-bold text-sidebar-foreground leading-tight tracking-tight">POS Admin</h1>
          <span className="text-[11px] text-sidebar-foreground/40 font-medium tracking-wider uppercase">
            Gestao Operacional
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-5 p-4">
        {navSections.map((section) => (
          <div key={section.label} className="flex flex-col gap-0.5">
            <span className="px-3 pb-1 text-[10px] font-semibold text-sidebar-foreground/30 uppercase tracking-widest">
              {section.label}
            </span>
            {section.items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                    isActive
                      ? "text-brand bg-brand-muted"
                      : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-brand" />
                  )}
                  <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-brand" : "")} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-sidebar-border mt-2">
        <p className="text-[10px] text-sidebar-foreground/30 text-center">
          POS Admin v1.0
        </p>
      </div>
    </aside>
  );
}
