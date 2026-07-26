"use client";

import { useState, useEffect, useRef } from "react";
import {
  useWalletStore,
  detectWallets,
  type WalletInfo,
} from "@/lib/wallet-store";
import { useAuth } from "@/lib/auth-context";
import { authService } from "@/lib/auth-service";
import { useWallet } from "@/lib/use-wallet";
import { useMobileWalletConnection } from "@/lib/use-mobile-wallet";
import { Portal } from "@/components/portal";
import {
  Wallet,
  ChevronDown,
  ExternalLink,
  LogOut,
  Copy,
  Check,
  AlertCircle,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  disconnectAllWalletsAndClearCache,
  clearWalletCache,
} from "@/lib/wallet-cache";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function WalletButton() {
  const { connectedWallet, isConnecting, connectWallet, disconnectWallet } =
    useWalletStore();
  const { user, loginWithWallet, isLoading: isAuthLoading, logout } = useAuth();
  const walletAddress = useWallet(); // ✅ Sincroniza con localStorage
  const mobileWallet = useMobileWalletConnection(); // ✅ Manejo de móvil
  const [isOpen, setIsOpen] = useState(false);
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [copied, setCopied] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [authError, setAuthError] = useState<string>("");
  const [showWalletSelector, setShowWalletSelector] = useState(false); // 🔥 NUEVO
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Determinar si tenemos una wallet conectada
  // Priorizar lo que está en localStorage (walletAddress) ya que es más confiable en refresh
  const hasWallet = !!(user && (walletAddress || connectedWallet?.address));

  // ✅ Detectar retorno de app móvil automáticamente
  useEffect(() => {
    if (!mobileWallet.isMobile) return;

    let isCheckingReturn = false;

    const handleVisibilityChange = async () => {
      // Solo chequear cuando la página se vuelve visible
      if (document.hidden || isCheckingReturn) return;

      isCheckingReturn = true;
      try {
        console.log("📱 Página visible nuevamente, detectando retorno...");
        const walletReturn = await mobileWallet.checkMobileWalletReturn();

        if (walletReturn) {
          console.log(`✓ Conexión móvil completada: ${walletReturn.wallet}`);
          // Encontrar la wallet en la lista
          const walletInfo = wallets.find(
            (w) => w.name === walletReturn.wallet,
          );

          if (walletInfo) {
            // Conectar a través del store
            await connectWallet(walletInfo);
            console.log(`✓ Wallet ${walletReturn.wallet} conectada en UI`);
          }
        } else {
          console.log("⚠️ No se detectó conexión de wallet en el retorno");
        }
      } catch (err) {
        console.error("Error procesando retorno de wallet:", err);
      } finally {
        isCheckingReturn = false;
      }
    };

    // Escuchar cuando la página vuelve a estar visible (usuario regresa de la app)
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // También chequear cuando se carga la página (por si ya estaba abierta cuando regresó)
    handleVisibilityChange().catch(console.error);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [mobileWallet, wallets, connectWallet]);

  useEffect(() => {
    setWallets(detectWallets());
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cuando se conecta wallet sin autenticación, mostrar prompt
  useEffect(() => {
    if (connectedWallet && !user && !showAuthPrompt) {
      setShowAuthPrompt(true);
    }
  }, [connectedWallet, user, showAuthPrompt]);

  const handleConnect = async (wallet: WalletInfo) => {
    console.log(
      `🧹 Conectando a ${wallet.name} (isMobile: ${mobileWallet.isMobile})...`,
    );

    // ✅ Si es móvil, usar deep links para apps nativas
    if (mobileWallet.isMobile) {
      try {
        switch (wallet.name) {
          case "Phantom":
            await mobileWallet.connectToPhantomMobile();
            break;
          case "Backpack":
            await mobileWallet.connectToBackpackMobile();
            break;
          case "Solflare":
            await mobileWallet.connectToSolflareMobile();
            break;
          default:
            throw new Error(`No mobile support for ${wallet.name}`);
        }
        return;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Mobile connection failed";
        console.error(`✗ Error conexión móvil:`, msg);
        // Fall back to web if mobile fails
      }
    }

    // 📱 Flujo original para web/desktop
    if (!wallet.installed) {
      window.open(wallet.downloadUrl, "_blank");
      return;
    }
    console.log(`🧹 Limpiando caché antes de conectar a ${wallet.name}...`);
    try {
      // Step 1: Clear cache first
      clearWalletCache();
      console.log("✓ Caché limpiada");

      // Step 2: Disconnect all providers to reset state
      console.log("🔌 Desconectando de todos los providers...");
      await disconnectAllWalletsAndClearCache();
      console.log("✓ Todos los providers desconectados");

      // Step 3: ✅ CRÍTICO para Solflare: esperar más tiempo después de desconexión
      // Solflare necesita tiempo para actualizar su estado interno
      console.log(
        "⏳ Esperando limpieza profunda de caché en proveedor (3s)...",
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Step 4: Now connect fresh wallet
      console.log(`🔗 Conectando a ${wallet.name} con caché limpia...`);
      await connectWallet(wallet);
      console.log(`✓ ${wallet.name} conectado correctamente`);
      setIsOpen(false);
    } catch (err) {
      console.error("✗ Error en conexión de wallet:", err);
      throw err;
    }
  };

  const handleConfirmAuth = async () => {
    setAuthError("");
    try {
      console.log("🔐 Confirmando autenticación con wallet conectada...");
      // Pasar el nombre de la wallet conectada para que use el provider correcto
      await loginWithWallet(connectedWallet?.name);
      console.log("✓ Autenticación exitosa");
      setShowAuthPrompt(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      console.error("✗ Error de autenticación:", msg);
      setAuthError(msg);
    }
  };

  const handleCancelAuth = () => {
    setShowAuthPrompt(false);
    disconnectWallet();
    setAuthError("");
  };

  const handleCopyAddress = () => {
    if (connectedWallet) {
      navigator.clipboard.writeText(connectedWallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handle_change_wallet = async () => {
    /**
     * Permitir cambiar a una wallet diferente
     * 1. Desconectar de la wallet actual
     * 2. Abrir selector de wallets
     * 3. Al conectar nueva wallet, vincularla (pedir firma)
     */
    setIsOpen(false); // Cerrar dropdown
    // Mostrar selector de wallets - similar a showWalletSelector
    // pero con lógica de vincular después
    // Por ahora: desconectar y permitir reconectar
    await disconnectWallet();
    // Agregar un estado para saber que debemos pedir firma después
  };

  const handle_unlink_wallet = async () => {
    /**
     * Desvincular wallet del usuario (sin logout)
     * Mantiene la sesión activa
     */
    try {
      await authService.unlinkWallet();
      disconnectWallet();
      setIsOpen(false);
      alert(
        "Wallet desvinculada correctamente. Puedes conectar otra cuando quieras.",
      );
    } catch (error) {
      console.error("Error desvinculando wallet:", error);
      alert("Error al desvincular wallet. Por favor intenta de nuevo.");
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const installedWallets = wallets.filter((w) => w.installed);
  const notInstalledWallets = wallets.filter((w) => !w.installed);

  // Modal de confirmación de autenticación
  if (showAuthPrompt && connectedWallet) {
    // Si está abierto el selector de wallets, mostrar ese primero
    if (showWalletSelector) {
      return (
        <Portal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 space-y-4 shadow-2xl">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Seleccionar Billetera
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Elige la billetera que deseas usar para autenticarte
                </p>
              </div>

              <div className="space-y-2">
                {installedWallets.map((wallet) => (
                  <button
                    key={wallet.name}
                    onClick={async () => {
                      // Desconectar de la actual
                      await disconnectWallet();

                      // Conectar con la nueva
                      await connectWallet(wallet);

                      // Cerrar el selector
                      setShowWalletSelector(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground transition-all hover:border-solana-purple/50 hover:bg-solana-purple/5"
                  >
                    <WalletIcon name={wallet.icon} className="h-6 w-6" />
                    <span className="flex-1 text-left">{wallet.name}</span>
                    {wallet.name === connectedWallet.name && (
                      <span className="text-xs text-solana-green font-semibold">
                        Activa
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowWalletSelector(false)}
                className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Volver
              </button>
            </div>
          </div>
        </Portal>
      );
    }

    // Mostrar modal de confirmación normal
    return (
      <Portal>
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 space-y-4 shadow-2xl">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Confirmar Autenticación
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Tu billetera está conectada. ¿Deseas autenticarte en ProWallet?
              </p>
            </div>

            {authError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}

            <div className="rounded-lg bg-gradient-to-r from-solana-purple/10 to-solana-green/10 p-4 border border-solana-purple/20">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-solana-purple to-solana-green">
                  <Wallet className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Billetera conectada
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {connectedWallet.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatAddress(connectedWallet.address)}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Se te pedirá que firmes un mensaje en tu wallet para completar la
              autenticación de forma segura.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowWalletSelector(true)}
                className="flex-1 rounded-lg border border-solana-purple/30 bg-solana-purple/5 px-4 py-2 text-sm font-medium text-solana-purple transition-colors hover:bg-solana-purple/10"
              >
                Cambiar Wallet
              </button>
              <button
                onClick={handleCancelAuth}
                disabled={isAuthLoading}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmAuth}
                disabled={isAuthLoading}
                className="flex-1 rounded-lg bg-gradient-to-r from-solana-purple to-solana-green px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isAuthLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Autenticando...
                  </>
                ) : (
                  "Confirmar"
                )}
              </button>
            </div>
          </div>
        </div>
      </Portal>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {hasWallet ? (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-solana-purple/10 to-solana-green/10 border border-solana-green/30 px-3 py-2 text-sm font-medium text-foreground transition-all hover:from-solana-purple/20 hover:to-solana-green/20"
        >
          <div className="h-2 w-2 rounded-full bg-solana-green animate-pulse" />
          <Wallet className="h-5 w-5" />
          <span className="hidden sm:inline">
            {formatAddress(walletAddress || connectedWallet?.address || "")}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </button>
      ) : connectedWallet && !user ? (
        <button
          onClick={() => setShowAuthPrompt(true)}
          disabled={isAuthLoading}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
        >
          {isAuthLoading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <span className="hidden sm:inline">Autenticando...</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4" />
              <span className="hidden sm:inline">⚠️ Confirmar Billetera</span>
            </>
          )}
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isConnecting}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-solana-purple to-solana-green px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
        >
          {isConnecting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <span className="hidden sm:inline">Conectando...</span>
            </>
          ) : (
            <>
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">🚀 Conectar Billetera</span>
            </>
          )}
        </button>
      )}

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
          {hasWallet ? (
            <div className="p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-solana-purple to-solana-green">
                  <Wallet className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Billetera Conectada
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatAddress(
                      walletAddress || connectedWallet?.address || "",
                    )}
                  </p>
                  <p className="text-xs text-solana-green">✓ Autenticado</p>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleCopyAddress}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-solana-green" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "Copiado" : "Copiar dirección"}
                </button>
                <button
                  onClick={async () => {
                    // Mostrar selector de wallets para cambiar
                    // Desconectar de la actual y abrir selector
                    await disconnectWallet();
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-solana-purple transition-colors hover:bg-solana-purple/10"
                >
                  <Wallet className="h-4 w-4" />
                  Cambiar Wallet
                </button>
                <button
                  onClick={handle_unlink_wallet}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  Desvincular Wallet
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <p className="mb-3 text-sm font-medium text-foreground">
                Conectar Billetera
              </p>

              {installedWallets.length > 0 && (
                <div className="mb-4 space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Detectadas
                  </p>
                  {installedWallets.map((wallet) => (
                    <button
                      key={wallet.name}
                      onClick={() => handleConnect(wallet)}
                      className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-3 text-sm font-medium text-foreground transition-all hover:border-solana-purple/50 hover:bg-solana-purple/5"
                    >
                      <WalletIcon name={wallet.icon} className="h-6 w-6" />
                      <div className="flex-1 text-left">
                        {wallet.name}
                        {mobileWallet.isMobile && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs text-solana-green">
                            <Smartphone className="h-3 w-3" />
                            App
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-solana-green">
                        {mobileWallet.isMobile ? "Disponible" : "Instalada"}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {notInstalledWallets.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {installedWallets.length > 0
                      ? "Otras opciones"
                      : "Instalar wallet"}
                  </p>
                  {notInstalledWallets.map((wallet) => (
                    <button
                      key={wallet.name}
                      onClick={() => handleConnect(wallet)}
                      className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground transition-all hover:border-solana-purple/50 hover:bg-secondary hover:text-foreground"
                    >
                      <WalletIcon
                        name={wallet.icon}
                        className="h-6 w-6 opacity-60"
                      />
                      {wallet.name}
                      <ExternalLink className="ml-auto h-4 w-4" />
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 rounded-lg bg-gradient-to-r from-solana-purple/10 to-solana-green/10 p-3">
                <p className="text-xs text-muted-foreground text-center">
                  Powered by{" "}
                  <span className="font-semibold text-foreground">Solana</span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WalletIcon({ name, className }: { name: string; className?: string }) {
  if (name === "phantom") {
    return (
      <svg
        className={className}
        viewBox="0 0 128 128"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="64" cy="64" r="64" fill="url(#phantom-gradient)" />
        <path
          d="M110.5 64C110.5 84.5 93.5 101 72.5 101H27C24.5 101 22.5 99 22.5 96.5C22.5 94 24.5 92 27 92H72.5C88.5 92 101.5 79.5 101.5 64C101.5 48.5 88.5 36 72.5 36H50.5C48 36 46 34 46 31.5C46 29 48 27 50.5 27H72.5C93.5 27 110.5 43.5 110.5 64Z"
          fill="white"
        />
        <circle cx="61" cy="58" r="7" fill="white" />
        <circle cx="85" cy="58" r="7" fill="white" />
        <defs>
          <linearGradient
            id="phantom-gradient"
            x1="0"
            y1="0"
            x2="128"
            y2="128"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#534BB1" />
            <stop offset="1" stopColor="#551BF9" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (name === "solflare") {
    return (
      <svg
        className={className}
        viewBox="0 0 128 128"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="64" cy="64" r="64" fill="url(#solflare-gradient)" />
        <path
          d="M64 28L80 52H48L64 28ZM64 100L48 76H80L64 100ZM28 64L52 48V80L28 64ZM100 64L76 80V48L100 64Z"
          fill="white"
        />
        <circle cx="64" cy="64" r="12" fill="white" />
        <defs>
          <linearGradient
            id="solflare-gradient"
            x1="0"
            y1="0"
            x2="128"
            y2="128"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#FC7227" />
            <stop offset="1" stopColor="#F5C042" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  return <Wallet className={className} />;
}
