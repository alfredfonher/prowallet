"use client";

import React from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  History,
  Wallet,
  X,
  RefreshCw,
} from "lucide-react";

import { cn } from "@/lib/utils";

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
  // REMOVED: isMounted state
  // Using suppressHydrationWarning + responsive classes instead
  // Server and client both render the same HTML initially

  // Sidebar logic: use responsive classes to prevent hydration issues
  // On desktop (lg+): always visible
  // On mobile: show when open, hidden by default
  const sidebarClass = cn(
    "fixed left-0 top-0 z-40 flex h-full w-64 flex-col bg-background/95 backdrop-blur-sm border-r border-border/50 transition-transform duration-300 ease-in-out",
    // Desktop: always visible
    "lg:translate-x-0 lg:block",
    // Mobile: toggle with hidden/block to prevent hydration mismatch
    // Use !hidden on lg+ to ensure it's never hidden on desktop
    isOpen ? "translate-x-0 block" : "-translate-x-full hidden lg:block",
  );

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "trade", label: "Comprar/Vender", icon: RefreshCw },
    { id: "transfer", label: "Transferir", icon: ArrowLeftRight },
    { id: "history", label: "Historial", icon: History },
    { id: "balances", label: "Saldos", icon: Wallet },
  ];

  return (
    <aside className={sidebarClass} suppressHydrationWarning>
      <div className="flex h-16 items-center justify-between border-b border-border/50 bg-card/50 backdrop-blur-sm p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-solana-purple to-solana-green">
            <svg
              className="h-5 w-5 text-white"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="12" cy="12" r="10" />
              <path
                d="M12 4 L12 20 M4 12 L20 12"
                stroke="white"
                strokeWidth="2"
                fill="none"
              />
            </svg>
            <span className="text-white font-bold text-xs">PRO</span>
          </div>
          <h1 className="text-lg font-bold text-foreground">ProWallet</h1>
        </div>
        {/* Mobile close button only */}
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-secondary transition-colors duration-200 text-sm lg:hidden"
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
                onClick={() => onViewChange(item.id as View)}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-lg transition-colors duration-200 flex items-center gap-3",
                  currentView === item.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-secondary text-foreground hover:text-secondary-foreground",
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Desktop: no close button needed, Mobile: show close button */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border lg:hidden">
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
