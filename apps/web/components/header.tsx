"use client";

import Swal from "sweetalert2";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/components/theme-provider";
import { WalletButton } from "@/components/wallet-button";
import { Menu, Sun, Moon, LogOut } from "lucide-react";

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  onWalletClick?: () => void;
}

export function Header({ title, onMenuClick, onWalletClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: "Cerrar Sesión",
      text: "¿Estás seguro de que deseas cerrar sesión?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, cerrar sesión",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      allowOutsideClick: false,
      allowEscapeKey: true,
    });

    if (result.isConfirmed) {
      logout();
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 backdrop-blur-sm px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <WalletButton />

        <button
          onClick={toggleTheme}
          className="flex items-center justify-center rounded-lg bg-secondary p-2.5 text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
          aria-label={
            theme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"
          }
        >
          {theme === "light" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </button>

        <button
          onClick={handleLogout}
          className="flex items-center justify-center rounded-lg bg-red-500/10 p-2.5 text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-400"
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
