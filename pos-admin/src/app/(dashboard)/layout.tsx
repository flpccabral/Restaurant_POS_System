"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { StoreProviderWrapper } from "@/components/layout/store-provider-wrapper";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <StoreProviderWrapper>
      <div className="min-h-screen bg-background">
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className="lg:ml-64">
          <Header onMenuToggle={() => setMobileMenuOpen((v) => !v)} />
          <main id="main-content" className="pt-14 min-h-screen">{children}</main>
        </div>
      </div>
    </StoreProviderWrapper>
  );
}
