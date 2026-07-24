"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FileText,
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
  MonitorCog,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
      { label: "Fichas Técnicas", href: "/recipes", icon: FileText },
      { label: "Categorias", href: "/categories", icon: Tags },
      { label: "Ingredientes", href: "/ingredients", icon: Leaf },
      { label: "Fornecedores", href: "/suppliers", icon: Truck },
    ],
  },
  {
    label: "OPERACIONAL",
    items: [
      { label: "Console Operacional", href: "/console", icon: MonitorCog },
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
      { label: "Configurações", href: "/settings", icon: Settings },
    ],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  const handleLinkClick = () => {
    if (onMobileClose) onMobileClose();
  };

  const renderNav = () => (
    <nav className="flex flex-col gap-5 p-4">
      {navSections.map((section) => (
        <div key={section.label} className="flex flex-col gap-0.5">
          <div className="flex items-center gap-3 px-3 pb-1">
            <span className="text-[10px] font-semibold text-sidebar-foreground/45 uppercase tracking-widest">
              {section.label}
            </span>
            <span className="flex-1 h-px bg-sidebar-border/30" />
          </div>
          {section.items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleLinkClick}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  isActive
                    ? "text-brand bg-brand-muted shadow-[inset_0_1px_0_0_rgba(255,180,0,0.06)]"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full bg-brand shadow-[0_0_8px_rgba(255,180,0,0.35)]" />
                )}
                <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-brand" : "")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border overflow-y-auto flex-col">
        <SidebarBrand />
        {renderNav()}
        <div className="mt-auto px-5 py-4 border-t border-sidebar-border">
          <p className="text-[10px] text-sidebar-foreground/30 text-center">
            POS Admin v1.0
          </p>
        </div>
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen ? (
        <div
          className="lg:hidden fixed inset-0 z-50 transition-opacity duration-200 opacity-100"
          aria-hidden="false"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onMobileClose}
            aria-label="Fechar menu"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onMobileClose?.()}
          />
          <aside
            className="absolute left-0 top-0 h-full w-[260px] max-w-[80vw] bg-sidebar border-r border-sidebar-border overflow-y-auto flex-col shadow-elevated"
            aria-label="Menu de navegação"
          >
            <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
              <SidebarBrand />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onMobileClose}
                aria-label="Fechar menu"
                className="text-sidebar-foreground/60 hover:text-sidebar-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {renderNav()}
            <div className="mt-auto px-5 py-4 border-t border-sidebar-border">
              <p className="text-[10px] text-sidebar-foreground/30 text-center">
                POS Admin v1.0
              </p>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function SidebarBrand() {
  return (
    <Link href="/" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded-lg">
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-brand-muted">
        <ChefHat className="h-5 w-5 text-brand" />
      </div>
      <div className="flex flex-col">
        <h1 className="text-base font-bold text-sidebar-foreground leading-tight tracking-tight">POS Admin</h1>
        <span className="text-[11px] text-sidebar-foreground/40 font-medium tracking-wider uppercase">
          Gestão Operacional
        </span>
      </div>
    </Link>
  );
}
