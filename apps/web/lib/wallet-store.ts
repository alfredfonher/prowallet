"use client";

import { create } from "zustand";
import {
  clearWalletCache,
  disconnectAllWalletsAndClearCache,
} from "./wallet-cache";

export interface WalletInfo {
  name: string;
  icon: string;
  installed: boolean;
  downloadUrl: string;
}

export interface ConnectedWallet {
  name: string;
  address: string;
  icon: string;
}

interface WalletState {
  connectedWallet: ConnectedWallet | null;
  isConnecting: boolean;
  connectWallet: (wallet: WalletInfo) => Promise<void>;
  disconnectWallet: () => void;
}

// Detectar wallets instaladas en el navegador
export function detectWallets(): WalletInfo[] {
  const wallets: WalletInfo[] = [
    {
      name: "Phantom",
      icon: "phantom",
      installed:
        typeof window !== "undefined" && !!(window as any).phantom?.solana,
      downloadUrl: "https://phantom.app/download",
    },
    {
      name: "Solflare",
      icon: "solflare",
      installed: typeof window !== "undefined" && !!(window as any).solflare,
      downloadUrl: "https://solflare.com/download",
    },
  ];
  return wallets;
}

export const useWalletStore = create<WalletState>((set) => ({
  connectedWallet: null,
  isConnecting: false,

  connectWallet: async (wallet: WalletInfo) => {
    set({ isConnecting: true });

    try {
      // NOTE: Cache cleaning is handled by handleConnect in wallet-button.tsx
      // This function just handles the actual connection after cleanup

      let address: string | null = null;
      let provider: any = null;

      // Obtener el proveedor basado en la wallet seleccionada
      if (wallet.name === "Phantom") {
        provider = (window as any).phantom?.solana;
        if (!provider) {
          throw new Error("Phantom no está instalado");
        }
      } else if (wallet.name === "Solflare") {
        provider = (window as any).solflare;
        if (!provider) {
          throw new Error("Solflare no está instalado");
        }
      }

      // Conectar con la wallet real
      if (provider) {
        console.log(`🔗 Conectando con ${wallet.name}...`);

        let lastAddress: string | null = null;
        let attempts = 0;
        const maxAttempts = 3;

        // Intentar obtener dirección fresca (especialmente para Solflare)
        do {
          attempts++;

          if (wallet.name === "Phantom") {
            // Phantom: usar connect()
            const response = await provider.connect();
            address = response.publicKey.toString();
            console.log(
              `✓ Phantom conectado (intento ${attempts}): ${address}`,
            );
          } else if (wallet.name === "Solflare") {
            // Solflare: usar connect() y obtener desde response
            const response = await provider.connect();
            address =
              response?.publicKey?.toString?.() ||
              provider.publicKey?.toString?.();

            if (!address) {
              throw new Error("No se pudo obtener la dirección de Solflare");
            }

            console.log(
              `✓ Solflare conectado (intento ${attempts}): ${address}`,
            );

            // ✅ CRÍTICO: Si obtiene la misma dirección, es caché del provider
            // Necesitamos limpiar más agresivamente
            if (
              lastAddress &&
              lastAddress === address &&
              attempts < maxAttempts
            ) {
              console.warn(
                `⚠️ Dirección repetida en Solflare (${address}). Limpiando caché agresivamente...`,
              );

              // Limpieza muy agresiva del provider Solflare
              try {
                // 1. Desconectar
                if (provider.disconnect) {
                  await provider.disconnect().catch(() => {});
                }

                // 2. Eliminar TODAS las propiedades de caché
                const cacheProps = [
                  "_publicKey",
                  "publicKey",
                  "_selectedAccount",
                  "selectedAccount",
                  "_account",
                  "_isConnected",
                  "_connected",
                  "account",
                  "_accounts",
                  "accounts",
                  "_wallet",
                  "_provider",
                  "_address",
                  "_walletAddress",
                ];
                cacheProps.forEach((prop) => {
                  try {
                    if (provider.hasOwnProperty(prop)) {
                      if (
                        typeof provider[prop] === "object" &&
                        provider[prop] !== null
                      ) {
                        try {
                          Object.assign(provider[prop], {});
                        } catch {
                          delete provider[prop];
                        }
                      } else {
                        delete provider[prop];
                      }
                    }
                  } catch (e) {
                    // Read-only properties
                  }
                });

                // 3. Limpiar localStorage/sessionStorage
                clearWalletCache();

                console.log("✓ Caché del provider limpiado agresivamente");
              } catch (e) {
                console.warn("Error limpiando caché:", e);
              }

              // 4. Esperar más tiempo
              await new Promise((resolve) => setTimeout(resolve, 2000));
              continue;
            }

            lastAddress = address;
          }

          if (!address) {
            throw new Error("No se pudo obtener la dirección de la wallet");
          }

          break;
        } while (attempts < maxAttempts);

        // 🔥 NUEVO: Validar que sea una wallet diferente (evitar duplicados)
        set((state) => {
          const previousAddress = state.connectedWallet?.address;
          if (previousAddress && previousAddress === address) {
            console.warn("⚠️ Misma wallet conectada, actualizando estado...");
          } else if (previousAddress) {
            console.log(
              `✅ Wallet diferente detectada: ${previousAddress} → ${address}`,
            );
          }

          return {
            connectedWallet: {
              name: wallet.name,
              address: address,
              icon: wallet.icon,
            },
            isConnecting: false,
          };
        });
      }
    } catch (error) {
      console.error("✗ Error al conectar wallet:", error);
      set({ isConnecting: false });
      throw error;
    }
  },

  disconnectWallet: () => {
    set({ connectedWallet: null });

    // 🔥 Usar función de limpieza completa
    console.log("🧹 Desconectando wallet...");
    disconnectAllWalletsAndClearCache().catch((err) =>
      console.warn("Error desconectando wallet:", err),
    );
  },
}));
