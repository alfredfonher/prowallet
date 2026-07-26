"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ArrowLeftRight,
  History,
  Wallet,
  X,
  RefreshCw,
} from "lucide-react";

type View = "dashboard" | "trade" | "transfer" | "history" | "balances";

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({
  currentView,
  onViewChange,
  isOpen,
  onClose,
}: SidebarProps) {
  // ✅ Usar className condicional SOLO después de montar en cliente
  // Esto previene hydration mismatch y hace animaciones más suaves
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ✅ Usar className con clases condicionales correctas
  const sidebarClass = cn(
    "fixed left-0 top-0 z-50 flex h-full w-64 flex-col bg-card border-r border-border transition-transform duration-300 ease-in-out",
    isMounted && (isOpen ? "translate-x-0" : "-translate-x-full"),
  );

  const menuItems: Array<{ id: View; label: string; icon: React.ElementType }> =
    [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "trade", label: "Comprar / Vender", icon: RefreshCw },
      { id: "transfer", label: "Transferir", icon: ArrowLeftRight },
      { id: "history", label: "Historial", icon: History },
      { id: "balances", label: "Saldos", icon: Wallet },
    ];

  return (
    <aside className={sidebarClass} suppressHydrationWarning>
      <div className="flex h-16 items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-solana-purple to-solana-green">
            <span className="text-white font-bold text-xs">PRO</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">ProWallet</h1>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-secondary transition-colors duration-200 text-sm"
          aria-label="Cerrar menú"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 py-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onViewChange(item.id)}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-lg transition-colors duration-200",
                  currentView === item.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-secondary text-foreground hover:text-secondary-foreground",
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
        <button
          onClick={onClose}
          className="w-full py-2 rounded-lg hover:bg-secondary transition-colors duration-200 text-sm"
        >
          Cerrar
        </button>
      </div>
    </aside>
  );
}
