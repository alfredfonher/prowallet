"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LinkWalletWidget } from "@/components/widgets/link-wallet-widget";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import Link from "next/link";

/**
 * Página para vincular wallet Solana a la cuenta del usuario
 * Accesible desde: /dashboard/wallet-linking
 *
 * Flujo esperado:
 * 1. Usuario logs in
 * 2. Se le muestra esta página para vincular wallet
 * 3. Después de vincular, puede hacer compras/transferencias
 */
type View = "dashboard" | "trade" | "transfer" | "history" | "balances";

export default function WalletLinkingPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [currentView] = React.useState<View>("dashboard");

  // Redirigir si no está autenticado
  React.useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Sidebar
        currentView={currentView}
        onViewChange={() => {}}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-col flex-1">
        <Header
          title="Vincular Wallet"
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex-1 overflow-auto p-6 lg:p-8">
          <div className="max-w-md mx-auto">
            {/* Encabezado */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">
                Vincular Wallet
              </h1>
              <p className="text-gray-400">
                Conecta tu wallet Solana para comenzar a comprar, vender y
                transferir tokens
              </p>
            </div>

            {/* Card con beneficios */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold text-white mb-4">
                ¿Por qué vincular tu wallet?
              </h2>
              <ul className="space-y-3">
                <li className="flex items-start text-gray-300">
                  <span className="text-green-500 mr-3 mt-1">✓</span>
                  <span>Compra y venta de tokens de forma segura</span>
                </li>
                <li className="flex items-start text-gray-300">
                  <span className="text-green-500 mr-3 mt-1">✓</span>
                  <span>Transferencias peer-to-peer</span>
                </li>
                <li className="flex items-start text-gray-300">
                  <span className="text-green-500 mr-3 mt-1">✓</span>
                  <span>Control total sobre tus activos</span>
                </li>
                <li className="flex items-start text-gray-300">
                  <span className="text-green-500 mr-3 mt-1">✓</span>
                  <span>Seguridad mediante firma de blockchain</span>
                </li>
              </ul>
            </div>

            {/* Wallet linking widget */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-6">
              <LinkWalletWidget
                onSuccess={() => {
                  // Después de vincular exitosamente, mostrar mensaje o redirigir
                  setTimeout(() => {
                    router.push("/");
                  }, 2000);
                }}
                onError={(error) => {
                  console.error("Error linking wallet:", error);
                }}
              />
            </div>

            {/* Link para volver */}
            <div className="text-center">
              <Link
                href="/"
                className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
              >
                ← Volver al dashboard
              </Link>
            </div>

            {/* Info de usuario actual */}
            {user && (
              <div className="mt-8 p-4 bg-slate-700 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Conectado como:</p>
                <p className="text-white font-mono text-sm">
                  {user.email || user.username}
                </p>
                {user.walletAddress && (
                  <>
                    <p className="text-xs text-gray-400 mt-3 mb-1">
                      Wallet vinculada:
                    </p>
                    <p className="text-green-400 font-mono text-sm">
                      {user.walletAddress.slice(0, 8)}...
                      {user.walletAddress.slice(-8)}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
