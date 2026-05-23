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

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Produtos", href: "/products", icon: Package },
  { label: "Categorias", href: "/categories", icon: Tags },
  { label: "Estoque", href: "/inventory", icon: Warehouse },
  { label: "Ingredientes", href: "/ingredients", icon: Leaf },
  { label: "Fornecedores", href: "/suppliers", icon: Truck },
  { label: "Pedidos de Compra", href: "/purchase-orders", icon: ClipboardList },
  { label: "Usuários", href: "/users", icon: Users },
  { label: "Lojas", href: "/stores", icon: Store },
  { label: "Dispositivos", href: "/devices", icon: Monitor },
  { label: "Perfis de Acesso", href: "/roles", icon: ShieldCheck },
  { label: "Assinatura", href: "/subscription", icon: CreditCard },
  { label: "PDV / Caixa", href: "/pdv", icon: Receipt },
  { label: "Cozinha (KDS)", href: "/kds", icon: ChefHat },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-zinc-950 border-r border-zinc-800 overflow-y-auto">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-zinc-800">
        <ChefHat className="h-6 w-6 text-brand" />
        <h1 className="text-lg font-bold text-white">POS Admin</h1>
      </div>

      <nav className="flex flex-col gap-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-muted text-brand"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
