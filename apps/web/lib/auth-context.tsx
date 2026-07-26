"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import bs58 from "bs58";
import toast from "react-hot-toast";
import { authService, type AuthUser } from "./auth-service";
import { csrfProtection } from "./csrf-protection";
import {
  clearWalletCache,
  disconnectAllWalletsAndClearCache,
} from "./wallet-cache";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    password: string,
    email?: string,
  ) => Promise<void>;
  loginWithWallet: (walletName?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Mark component as mounted to prevent hydration issues
    setIsMounted(true);

    // Inicializar protección CSRF
    csrfProtection.setupAPIInterceptor();
  }, []);

  useEffect(() => {
    // Only run auth check after component is mounted (client-side only)
    if (!isMounted) return;

    const checkAuth = async () => {
      try {
        // Primero verificar si hay sesión válida
        if (authService.isAuthenticated()) {
          // Obtener usuario del localStorage (ya fue guardado en login)
          const cachedUser = authService.getUser();
          if (cachedUser) {
            setUser(cachedUser);
          } else {
            // Si no hay usuario en caché, intentar obtenerlo del backend
            const fetchedUser = await authService.getMe();
            setUser(fetchedUser);
          }
        }
      } catch (err) {
        console.warn("Auth verification failed", err);
        authService.logout();
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [isMounted]);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await authService.login({ username, password });
      setUser(result.user);
      toast.success(`¡Bienvenido, ${result.user.username}!`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithWallet = async (walletName?: string) => {
    setIsLoading(true);
    setError(null);

    // Timeout de 30 segundos para prevenir cuelgues infinitos
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Wallet login timeout. Please try again.")),
        30000,
      ),
    );

    try {
      await Promise.race([
        (async () => {
          // 🔥 PASO 1: LIMPIAR TODOS LOS CACHÉS ANTES DE EMPEZAR
          console.log("🧹 Limpiando caché de wallets...");
          clearWalletCache();

          // 🔥 PASO 2: DESCONECTAR COMPLETAMENTE DE TODOS LOS PROVIDERS
          console.log("🔌 Desconectando de todos los providers...");
          await disconnectAllWalletsAndClearCache();

          // 🔥 PASO 3: ESPERAR A QUE SE PROCESE - Solflare puede necesitar más tiempo
          console.log("⏳ Esperando limpieza de caché en proveedor...");
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Obtener el proveedor de la wallet
          let provider: any = null;
          let detectedWalletName: string = "Unknown";

          console.log(
            `📋 Buscando wallet. walletName especificado: ${walletName}`,
          );
          console.log(
            `   Phantom disponible: ${!!(window as any).phantom?.solana}`,
          );
          console.log(`   Solflare disponible: ${!!(window as any).solflare}`);

          // Si se especifica el nombre de wallet, usarlo
          if (walletName === "Solflare") {
            console.log(`🔍 Solicitando Solflare específicamente...`);
            provider = (window as any).solflare;
            detectedWalletName = "Solflare";
            if (!provider) {
              throw new Error("Solflare no está instalado");
            }
            console.log(`✓ Solflare obtenido`);
          } else if (walletName === "Phantom") {
            console.log(`🔍 Solicitando Phantom específicamente...`);
            provider = (window as any).phantom?.solana;
            detectedWalletName = "Phantom";
            if (!provider) {
              throw new Error("Phantom no está instalado");
            }
            console.log(`✓ Phantom obtenido`);
          } else {
            console.log(
              `🔍 Sin wallet específica, detectando automáticamente...`,
            );
            // Si no se especifica, intentar ambas (Phantom primero como default)
            if ((window as any).phantom?.solana) {
              provider = (window as any).phantom.solana;
              detectedWalletName = "Phantom";
              console.log(`✓ Auto-detectado: Phantom`);
            } else if ((window as any).solflare) {
              provider = (window as any).solflare;
              detectedWalletName = "Solflare";
              console.log(`✓ Auto-detectado: Solflare`);
            }
          }

          if (!provider) {
            throw new Error(
              "No Solana wallet found. Install Phantom or compatible wallet.",
            );
          }

          // 🔥 PASO 4: RECONECTAR FORZANDO LECTURA FRESCA
          let publicKey: string;
          let lastPublicKey: string | null = null;
          let attempts = 0;
          const maxAttempts = 3;

          // Intentar obtener dirección fresca
          do {
            attempts++;
            console.log(
              `🔗 Intento ${attempts}/${maxAttempts}: Conectando con ${detectedWalletName}...`,
            );

            const connectPromise = provider.connect();
            const connectTimeout = new Promise((_, reject) =>
              setTimeout(
                () =>
                  reject(new Error(`${detectedWalletName} connection timeout`)),
                10000,
              ),
            );
            const resp = await Promise.race([connectPromise, connectTimeout]);
            publicKey =
              (resp as any).publicKey?.toString?.() ||
              provider.publicKey?.toString?.();

            if (!publicKey) {
              throw new Error("Failed to obtain public key from wallet");
            }

            console.log(`   Obtenido: ${publicKey} (intento ${attempts})`);

            // Si es la misma dirección que antes, podría ser caché
            if (
              lastPublicKey &&
              lastPublicKey === publicKey &&
              attempts < maxAttempts
            ) {
              console.warn(
                `⚠️ Dirección repetida detectada (caché). Limpiando e intentando de nuevo...`,
              );
              lastPublicKey = publicKey;

              // Forzar desconexión más agresiva
              try {
                if (provider.disconnect) {
                  await provider.disconnect().catch(() => {});
                }
                if (provider._publicKey) delete provider._publicKey;
                if (provider.publicKey) provider.publicKey = null;
                if (provider._selectedAccount) provider._selectedAccount = null;
              } catch (e) {
                // Ignorar
              }

              await new Promise((resolve) => setTimeout(resolve, 1500));
              continue;
            }

            // Dirección nueva o es la primera vez
            break;
          } while (attempts < maxAttempts);

          console.log(`✓ ${detectedWalletName} conectado: ${publicKey}`);

          // Solicitar challenge del backend
          console.log(`📝 Solicitando challenge para: ${publicKey}`);
          const { message } = await authService.requestChallenge(publicKey);

          // Firmar el mensaje
          const encoded = new TextEncoder().encode(message);
          const signRequestTime = Date.now();
          console.log(
            `✍️ Pidiendo firma en ${detectedWalletName}... [${signRequestTime}]`,
          );

          // Mostrar feedback al usuario
          toast.loading(`Esperando firma de ${detectedWalletName}...`, {
            duration: Infinity,
          });

          let signed: any;

          // Verificar qué método de firma está disponible
          let signPromise: Promise<any>;

          if (typeof provider.signMessage === "function") {
            console.log(`  Usando provider.signMessage()`);
            signPromise = provider
              .signMessage(encoded, "utf8")
              .then((result: any) => {
                const elapsed = Date.now() - signRequestTime;
                console.log(`  ✓ Firma recibida después de ${elapsed}ms`);
                return result;
              });
          } else if (typeof provider.sign === "function") {
            console.log(`  Usando provider.sign()`);
            signPromise = provider.sign(encoded).then((result: any) => {
              const elapsed = Date.now() - signRequestTime;
              console.log(`  ✓ Firma recibida después de ${elapsed}ms`);
              return result;
            });
          } else {
            console.error(`  ❌ Wallet provider no tiene métodos de firma:`, {
              hasSignMessage: typeof provider.signMessage,
              hasSign: typeof provider.sign,
              providerKeys: Object.keys(provider).slice(0, 10),
            });
            signPromise = Promise.reject(
              new Error(
                "Wallet does not support signing. Available methods: " +
                  Object.keys(provider).slice(0, 10).join(", "),
              ),
            );
          }

          const signTimeout = new Promise((_, reject) =>
            setTimeout(() => {
              const elapsed = Date.now() - signRequestTime;
              reject(
                new Error(
                  `Sign request timeout after ${elapsed}ms (limit: 15000ms)`,
                ),
              );
            }, 15000),
          );

          signed = await Promise.race([signPromise, signTimeout]);

          // Limpiar toast de carga
          toast.dismiss();

          const signature = signed.signature || signed;
          const signatureBase58 = bs58.encode(
            signature instanceof Uint8Array
              ? signature
              : new Uint8Array(signature),
          );

          // Completar el login en el backend
          console.log(`📤 Enviando firma al backend...`);
          const result = await authService.completeWalletLogin(
            publicKey,
            message,
            signatureBase58,
          );
          console.log("✓ Wallet login successful", result);

          // Guardar wallet address (solo la address, sin prefijos)
          authService.setWalletAddress(publicKey);

          setUser(result.user);
          toast.success(
            `¡${walletName} conectado! Bienvenido, ${result.user.username}`,
          );

          // Actualizar actividad de sesión
          authService.updateActivity();
        })(),
        timeoutPromise,
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("✗ Wallet login failed", err);
      setError(msg);
      toast.error(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    username: string,
    password: string,
    email?: string,
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await authService.register({
        username,
        password,
        email,
      });
      setUser(result.user);
      toast.success(`¡Cuenta creada! Bienvenido, ${result.user.username}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Registration failed";
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    console.log("🚪 Cerrando sesión...");

    // 🔥 Desconectar y limpiar wallets (lo hace authService.logout ahora)
    authService.logout();
    csrfProtection.clear();
    setUser(null);
    setError(null);
    toast.success("Sesión cerrada");
  };

  const value = {
    user,
    isLoading,
    error,
    login,
    register,
    loginWithWallet,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
