import { useCallback, useEffect, useState } from "react";
import {
  isMobileDevice,
  isAndroidDevice,
  isIOSDevice,
  generatePhantomDeepLink,
  generatePhantomIOSDeepLink,
  generateBackpackDeepLink,
  generateSolflareDeepLink,
  saveConnectionAttempt,
  getConnectionAttempt,
  clearConnectionAttempts,
  getIOSWalletScheme,
} from "./solana-mobile-config";

/**
 * Información sobre la plataforma actual
 */
export interface PlatformInfo {
  isMobile: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  userAgent: string;
}

/**
 * Hook para detectar si estamos en móvil y obtener info de la plataforma
 */
export function useMobileDetection(): PlatformInfo {
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>({
    isMobile: false,
    isAndroid: false,
    isIOS: false,
    userAgent: "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    setPlatformInfo({
      isMobile: isMobileDevice(),
      isAndroid: isAndroidDevice(),
      isIOS: isIOSDevice(),
      userAgent: navigator.userAgent.toLowerCase(),
    });
  }, []);

  return platformInfo;
}

/**
 * Hook para manejar conexión de wallet en móvil
 * Detecta si está en móvil y usa deep links para abrir las apps nativas
 */
export function useMobileWalletConnection() {
  const platform = useMobileDetection();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingForWallet, setWaitingForWallet] = useState<string | null>(null);

  /**
   * Intenta obtener el provider de una wallet con reintentos
   * Muy importante: espera hasta 3 segundos a que se inyecte
   */
  const getWalletProvider = useCallback(
    async (walletName: string, maxRetries = 20): Promise<any | null> => {
      console.log(
        `🔍 Buscando provider ${walletName} (max ${maxRetries} intentos)...`,
      );

      for (let i = 0; i < maxRetries; i++) {
        let provider = null;

        switch (walletName) {
          case "Phantom":
            provider = (window as any).phantom?.solana;
            break;
          case "Backpack":
            provider = (window as any).backpack?.solana;
            break;
          case "Solflare":
            provider = (window as any).solflare;
            break;
        }

        if (provider) {
          console.log(
            `✅ ${walletName} provider encontrado en intento ${i + 1}/${maxRetries}`,
          );
          console.log(`   - isConnected: ${provider.isConnected || false}`);
          console.log(
            `   - publicKey: ${provider.publicKey?.toString?.() || provider._pubkey?.toString?.() || "N/A"}`,
          );
          return provider;
        }

        console.log(
          `⏳ ${walletName} no encontrado (${i + 1}/${maxRetries})...`,
        );

        // Esperar 150ms antes de reintentar
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      console.warn(
        `❌ ${walletName} provider no encontrado después de ${maxRetries} intentos (${maxRetries * 150}ms)`,
      );
      return null;
    },
    [],
  );

  /**
   * Conectar a Phantom en móvil
   */
  const connectToPhantomMobile = useCallback(async () => {
    if (!platform.isMobile) {
      throw new Error("This method is only for mobile devices");
    }

    setIsConnecting(true);
    setWaitingForWallet("Phantom");
    setError(null);

    try {
      // Guardar intento
      saveConnectionAttempt("Phantom");
      console.log("📱 Abriendo Phantom...");
      console.log(`Platform: ${platform.isIOS ? "iOS" : "Android"}`);

      let deepLink: string;

      if (platform.isIOS) {
        // iOS: usar el deep link específico
        const currentUrl =
          typeof window !== "undefined" ? window.location.href : "";
        deepLink = generatePhantomIOSDeepLink(currentUrl);
        console.log(`Deep link (iOS): ${deepLink}`);
      } else if (platform.isAndroid) {
        // Android: usar el deep link HTTP
        const currentUrl =
          typeof window !== "undefined" ? window.location.href : "";
        deepLink = generatePhantomDeepLink(currentUrl);
        console.log(`Deep link (Android): ${deepLink}`);
      } else {
        throw new Error("Unsupported platform for mobile wallet");
      }

      // Abrir la app con el deep link
      console.log("🔗 Redirigiendo a Phantom...");
      window.location.href = deepLink;

      // Si llegamos aquí, algo está mal (no debería redirigir)
      throw new Error("Failed to open Phantom");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to connect to Phantom";
      console.error(`✗ Error: ${message}`);
      setError(message);
      setIsConnecting(false);
      setWaitingForWallet(null);
      throw err;
    }
  }, [platform]);

  /**
   * Conectar a Backpack en móvil
   */
  const connectToBackpackMobile = useCallback(async () => {
    if (!platform.isMobile) {
      throw new Error("This method is only for mobile devices");
    }

    setIsConnecting(true);
    setWaitingForWallet("Backpack");
    setError(null);

    try {
      saveConnectionAttempt("Backpack");
      console.log("📱 Abriendo Backpack...");

      const redirectUrl =
        typeof window !== "undefined" ? window.location.href : "";

      if (platform.isIOS) {
        const scheme = getIOSWalletScheme("Backpack");
        if (!scheme) throw new Error("Backpack not available on iOS");

        window.location.href = `${scheme}connect?url=${encodeURIComponent(
          redirectUrl,
        )}`;
      } else if (platform.isAndroid) {
        const deepLink = generateBackpackDeepLink(redirectUrl);
        window.location.href = deepLink;
      }

      throw new Error("Failed to open Backpack");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to connect to Backpack";
      console.error(`✗ Error: ${message}`);
      setError(message);
      setIsConnecting(false);
      setWaitingForWallet(null);
      throw err;
    }
  }, [platform]);

  /**
   * Conectar a Solflare en móvil
   */
  const connectToSolflareMobile = useCallback(async () => {
    if (!platform.isMobile) {
      throw new Error("This method is only for mobile devices");
    }

    setIsConnecting(true);
    setWaitingForWallet("Solflare");
    setError(null);

    try {
      saveConnectionAttempt("Solflare");
      console.log("📱 Abriendo Solflare...");

      const redirectUrl =
        typeof window !== "undefined" ? window.location.href : "";

      if (platform.isIOS) {
        const scheme = getIOSWalletScheme("Solflare");
        if (!scheme) throw new Error("Solflare not available on iOS");

        window.location.href = `${scheme}connect?url=${encodeURIComponent(
          redirectUrl,
        )}`;
      } else if (platform.isAndroid) {
        const deepLink = generateSolflareDeepLink(redirectUrl);
        window.location.href = deepLink;
      }

      throw new Error("Failed to open Solflare");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to connect to Solflare";
      console.error(`✗ Error: ${message}`);
      setError(message);
      setIsConnecting(false);
      setWaitingForWallet(null);
      throw err;
    }
  }, [platform]);

  /**
   * ✅ CRÍTICO: Detectar y completar conexión cuando regresa de la app
   * Se llama automáticamente desde wallet-button.tsx al detectar visibilitychange
   */
  const completeWalletConnection = useCallback(
    async (
      walletName: string,
    ): Promise<{ wallet: string; address: string } | null> => {
      try {
        console.log(`\n🔗 ========== COMPLETANDO CONEXIÓN ==========`);
        console.log(`   Wallet: ${walletName}`);
        console.log(`   Hora: ${new Date().toLocaleTimeString()}`);

        // Obtener el provider con reintentos agresivos (3 segundos max)
        const provider = await getWalletProvider(walletName, 20);

        if (!provider) {
          console.error(
            `❌ ${walletName} provider no disponible después de 3 segundos`,
          );
          console.log(
            `   Wallets disponibles en window:`,
            Object.keys(window as any).filter((k) =>
              k.includes("solana") || k.includes("phantom") ? true : false,
            ),
          );
          return null;
        }

        console.log(`✅ ${walletName} provider encontrado`);

        // Verificar si ya está conectado
        if (provider.isConnected) {
          const address =
            provider.publicKey?.toString?.() || provider._pubkey?.toString?.();

          if (address) {
            console.log(`✅ ${walletName} YA ESTÁ CONECTADO`);
            console.log(
              `   Address: ${address.substring(0, 8)}...${address.substring(address.length - 4)}`,
            );
            console.log(`========================================\n`);

            return {
              wallet: walletName,
              address,
            };
          }
        }

        // Si no está conectado, intentar conectar
        console.log(`🔗 Provider no está conectado, intentando...`);

        if (provider.connect && typeof provider.connect === "function") {
          try {
            console.log(`   Llamando a provider.connect()...`);
            const result = await provider.connect();
            const address = result.publicKey.toString();

            console.log(`✅ ${walletName} CONECTADO AUTOMÁTICAMENTE`);
            console.log(
              `   Address: ${address.substring(0, 8)}...${address.substring(address.length - 4)}`,
            );
            console.log(`========================================\n`);

            return {
              wallet: walletName,
              address,
            };
          } catch (connectErr) {
            console.error(`❌ Error al llamar provider.connect():`, connectErr);
            return null;
          }
        } else {
          console.error(`❌ Provider no tiene método connect()`);
          return null;
        }
      } catch (err) {
        console.error(`❌ Error completando conexión con ${walletName}:`, err);
        console.log(`========================================\n`);
        return null;
      }
    },
    [getWalletProvider],
  );

  /**
   * Detectar si volvemos de una app de wallet
   * Se llama desde el evento visibilitychange
   */
  const checkMobileWalletReturn = useCallback(async () => {
    if (!platform.isMobile) return null;

    try {
      const walletNames = ["Phantom", "Backpack", "Solflare"];

      for (const walletName of walletNames) {
        const attempt = getConnectionAttempt(walletName);
        if (!attempt) continue;

        const timeDiff = Date.now() - attempt.timestamp;

        // Si fue hace menos de 5 minutos, probablemente volvemos de la app
        if (timeDiff < 300000) {
          console.log(
            `✓ Detectado intento de ${walletName} (hace ${Math.round(timeDiff / 1000)}s)`,
          );

          // Limpiar el intento
          clearConnectionAttempts();

          // Completar la conexión
          const result = await completeWalletConnection(walletName);
          if (result) {
            setWaitingForWallet(null);
            setIsConnecting(false);
            return result;
          }
        }
      }

      return null;
    } catch (err) {
      console.warn("Error checking mobile wallet return:", err);
      return null;
    }
  }, [platform, completeWalletConnection]);

  return {
    isMobile: platform.isMobile,
    isAndroid: platform.isAndroid,
    isIOS: platform.isIOS,
    isConnecting,
    error,
    waitingForWallet,
    connectToPhantomMobile,
    connectToBackpackMobile,
    connectToSolflareMobile,
    completeWalletConnection,
    checkMobileWalletReturn,
  };
}
