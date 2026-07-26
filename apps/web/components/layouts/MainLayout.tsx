/**
 * MainLayout - Componente orquestador del dashboard
 * Maneja el layout principal: Sidebar + Header + Content
 */

"use client";

import { useState, useMemo } from "react";
import { TokenProvider } from "@/components/token-provider";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { DashboardView } from "@/components/views/dashboard-view";
import { TradeView } from "@/components/views/trade-view";
import { TransferView } from "@/components/views/transfer-view";
import { HistoryView } from "@/components/views/history-view";
import { BalancesView } from "@/components/views/balances-view";
import { ToastNotification } from "@/components/toast-notification";

/**
 * Tipos de vista disponibles en el dashboard
 */
type View = "dashboard" | "trade" | "transfer" | "history" | "balances";

/**
 * Títulos de las vistas
 */
const VIEW_TITLES: Record<View, string> = {
  dashboard: "Dashboard",
  trade: "Comprar / Vender",
  transfer: "Transferir",
  history: "Historial",
  balances: "Saldos",
};

/**
 * MainLayout - Layout principal del dashboard autenticado
 *
 * Responsabilidades:
 * - Manage sidebar open/close state
 * - Switch between views (dashboard, trade, transfer, etc)
 * - Render Sidebar, Header, and current view
 * - Provide TokenProvider context for children
 *
 * @returns Componente React con el layout del dashboard
 */
export function MainLayout() {
  const [current_view, set_current_view] = useState<View>("dashboard");
  const [sidebar_open, set_sidebar_open] = useState(false);

  // Get current view title with memoization
  const current_title = useMemo(
    () => VIEW_TITLES[current_view],
    [current_view],
  );

  /**
   * Renderiza la vista activa basada en el tipo seleccionado
   *
   * @returns Componente React con la vista seleccionada
   */
  const render_view = () => {
    switch (current_view) {
      case "dashboard":
        return <DashboardView onNavigate={set_current_view} />;
      case "trade":
        return <TradeView />;
      case "transfer":
        return <TransferView />;
      case "history":
        return <HistoryView />;
      case "balances":
        return <BalancesView />;
    }
  };

  return (
    <TokenProvider>
      <div
        className="min-h-screen bg-background solana-bg"
        suppressHydrationWarning
      >
        {/* Sidebar */}
        <Sidebar
          currentView={current_view}
          onViewChange={set_current_view}
          isOpen={sidebar_open}
          onClose={() => set_sidebar_open(false)}
        />

        {/* Mobile overlay para cerrar sidebar */}
        {sidebar_open && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => set_sidebar_open(false)}
          />
        )}

        {/* Main content area */}
        <div className="lg:pl-64 relative z-10 min-h-screen">
          {/* Header */}
          <Header
            title={current_title}
            onMenuClick={() => set_sidebar_open(true)}
          />

          {/* Page content */}
          <main className="p-4 lg:p-8">{render_view()}</main>
        </div>

        {/* Toast notifications */}
        <ToastNotification />
      </div>
    </TokenProvider>
  );
}

MainLayout.displayName = "MainLayout";
