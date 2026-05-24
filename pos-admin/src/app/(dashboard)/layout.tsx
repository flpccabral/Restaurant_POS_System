import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { StoreProviderWrapper } from "@/components/layout/store-provider-wrapper";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StoreProviderWrapper>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="ml-64">
          <Header />
          <main className="pt-14 min-h-screen">{children}</main>
        </div>
      </div>
    </StoreProviderWrapper>
  );
}
