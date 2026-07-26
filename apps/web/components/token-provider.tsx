"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  useEffect,
} from "react";
import { Connection } from "@solana/web3.js";
import useSocket from "@/hooks/useSocket";
import {
  type TokenInfo,
  type Transaction,
  initialTokenInfo,
  initialTransactions,
  generateId,
} from "@/lib/token-store";
import { useAuth } from "@/lib/auth-context";
import { authService } from "@/lib/auth-service";
import { apiClient, API_BASE_URL } from "@/lib/api-client";
import { exchangeService } from "@/lib/exchange-service";
import { transactionSigner } from "@/lib/transaction-signer";
import { getSolPriceFromClient } from "@/lib/price-client";
import { PurchaseEvents } from "@/lib/purchase-events";
import { sendSignedTransaction } from "@/lib/transaction-sender";
import { buyTokensAdapter } from "@/lib/services/purchase-adapter";

export interface TokenContextType {
  tokenInfo: TokenInfo;
  transactions: Transaction[];
  userBalance: number;
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
  buyTokens: (
    holder: string,
    tokenAmount: number,
  ) => Promise<string | undefined>;
  sellTokens: (holder: string, tokenAmount: number) => Promise<void>;
  transferTokens: (from: string, to: string, amount: number) => Promise<void>;
  refreshBalance: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  refreshPrice: () => Promise<void>;
}

export const TokenContext = createContext<TokenContextType | null>(null);

export function TokenProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [tokenInfo, setTokenInfo] = useState<TokenInfo>(initialTokenInfo);
  const [transactions, setTransactions] =
    useState<Transaction[]>(initialTransactions);
  const [userBalance, setUserBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const socket = useSocket();

  const CACHE_KEY = "prowallet.tokenInfo.v1";
  const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hora

  // Cargar caché local (si existe y es reciente) antes de hacer consultas
  const loadCachedTokenInfo = () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as any;
      if (!parsed) return;
      const age = Date.now() - (parsed.lastUpdated || 0);
      // Si tiene menos de 1 hora, considerarlo fresco; si no, aún lo
      // mostramos como respaldo pero marcado como stale.
      const isStale = age > CACHE_TTL_MS;
      const withinMaxAge = age <= CACHE_TTL_MS;

      setTokenInfo((prev) => ({
        ...prev,
        name: parsed.name || prev.name,
        symbol: parsed.symbol || prev.symbol,
        price: typeof parsed.price === "number" ? parsed.price : prev.price,
        solPriceUsd:
          typeof parsed.solPriceUsd === "number"
            ? parsed.solPriceUsd
            : prev.solPriceUsd,
        totalSupply:
          typeof parsed.totalSupply === "number"
            ? parsed.totalSupply
            : prev.totalSupply,
        circulatingSupply:
          typeof parsed.circulatingSupply === "number"
            ? parsed.circulatingSupply
            : prev.circulatingSupply,
        holders: parsed.holders || prev.holders,
        lastUpdated: parsed.lastUpdated || Date.now(),
        // Si está dentro del TTL lo marcamos frescamente; si no, stale=true
        isStale: !withinMaxAge,
      }));
    } catch (e) {
      console.warn("No se pudo cargar caché local de tokenInfo:", e);
    }
  };

  // Fetch price on mount and every 30 seconds (PÚBLICO - sin autenticación)
  useEffect(() => {
    // Primero intentar cargar datos cacheados para evitar valores por defecto
    // engañosos en la UI. Luego forzar una recarga en background.
    loadCachedTokenInfo();
    refreshPrice();
    refreshTokenInfo();
    const interval = setInterval(() => {
      refreshPrice();
      refreshTokenInfo();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch balance and history only when user is authenticated (SENSIBLE - requiere autenticación)
  useEffect(() => {
    if (isAuthenticated && user) {
      refreshBalance();
      refreshHistory();
    } else {
      // Limpiar balance e historial si usuario no está autenticado
      setUserBalance(0);
      setTransactions([]);
    }
  }, [user, isAuthenticated]);

  // Suscripción SSE para notificaciones (webhook -> SSE)
  useEffect(() => {
    if (typeof window === "undefined") return;

    let es: EventSource | null = null;
    try {
      es = new EventSource(`${API_BASE_URL}/notifications/stream`);

      es.addEventListener("connected", (e: MessageEvent) => {
        console.log("SSE connected:", e.data);
      });

      es.addEventListener("purchase.completed", (ev: MessageEvent) => {
        try {
          const parsed = JSON.parse(ev.data);
          // Normalizar: algunos emisores envían { type, payload }, otros envían el payload directo
          const payload =
            parsed && typeof parsed === "object"
              ? (parsed.payload ?? parsed)
              : parsed;
          console.log(
            "SSE purchase.completed ->",
            parsed,
            "-> normalized:",
            payload,
          );

          // Refrescar historial y balance si hay usuario
          if (isAuthenticated && user) {
            refreshHistory();
            refreshBalance();
          }

          // Notificar al resto de la app (por si hay modales pendientes)
          try {
            window.dispatchEvent(
                new CustomEvent("prowallet:purchase.completed", {
                detail: payload,
              }),
            );
          } catch (e) {
            console.warn(
              "Could not dispatch DOM event for purchase.completed",
              e,
            );
          }

          // Mostrar mensaje breve en UI
          setSuccessMessage(
            `Compra procesada: ${payload?.transactionId || "(id desconocido)"}`,
          );
          setTimeout(() => setSuccessMessage(null), 4000);
        } catch (e) {
          console.warn("Failed to parse SSE purchase.completed payload", e);
        }
      });

      es.addEventListener("history.updated", (ev: MessageEvent) => {
        try {
          console.log("SSE history.updated ->", ev.data);
          if (isAuthenticated && user) refreshHistory();
        } catch (e) {}
      });

      es.addEventListener("balance.updated", (ev: MessageEvent) => {
        try {
          console.log("SSE balance.updated ->", ev.data);
          if (isAuthenticated && user) refreshBalance();
        } catch (e) {}
      });

      es.addEventListener("user.login", (ev: MessageEvent) => {
        console.log("SSE user.login ->", ev.data);
        // Forzar refresco de datos relevantes
        refreshBalance();
        refreshHistory();
      });

      es.addEventListener("user.logout", (ev: MessageEvent) => {
        console.log("SSE user.logout ->", ev.data);
        setUserBalance(0);
        setTransactions([]);
      });
    } catch (e) {
      console.warn("Could not open SSE connection to notifications stream", e);
    }

    return () => {
      try {
        es?.close();
      } catch (e) {}
    };
  }, [isAuthenticated, user]);

  const refreshPrice = async () => {
    try {
      console.log("💎 Actualizando precios (token + SOL)...");

      // 1️⃣ Obtener precio de SOL/USD desde el cliente (consultas desde frontend)
      let solPrice: number | null = null;
      try {
        const solResp = await getSolPriceFromClient({ ttlMs: 30000 });
        const parsedPrice = Number(solResp.price);
        if (!isFinite(parsedPrice) || parsedPrice <= 0) {
          throw new Error("Invalid SOL price from client");
        }
        solPrice = parsedPrice;
        console.log("📡 SOL price from client providers ->", solResp);
      } catch (e) {
        console.warn("⚠️ Client-side SOL price failed, falling back to API", e);
        try {
          const solPriceResponse =
            await apiClient.get<any>("/exchange/solPrice");
          console.log("📡 GET /exchange/solPrice ->", solPriceResponse);
          const apiPrice =
            solPriceResponse?.extra?.solPriceUsd ||
            solPriceResponse?.solPriceUsd ||
            solPriceResponse?.data?.solPriceUsd ||
            null;
          const parsedApiPrice = apiPrice ? Number(apiPrice) : null;
          if (
            parsedApiPrice &&
            isFinite(parsedApiPrice) &&
            parsedApiPrice > 0
          ) {
            solPrice = parsedApiPrice;
          } else {
            throw new Error("Invalid SOL price from API");
          }
        } catch (apiError) {
          console.warn(
            "⚠️ API SOL price also failed, using default price of 1 USD",
            apiError,
          );
          solPrice = 1; // Precio por defecto: 1 USD por SOL
        }
      }

      // 2️⃣ Obtener precio del token en USD (precio fijo: 0.01 USD)
      // El endpoint /exchange/getPrice siempre retorna 0.01 USD
      const tokenPriceResponse = await apiClient.get<any>("/exchange/getPrice");
      console.log("📡 GET /exchange/getPrice ->", tokenPriceResponse);

      // El precio del token es siempre 0.01 USD (constante del sistema)
      let tokenPriceUsd = 0.01;

      // Validación: asegurarse que el precio es válido
      if (
        tokenPriceResponse?.data?.priceUSD &&
        typeof tokenPriceResponse.data.priceUSD === "number" &&
        isFinite(tokenPriceResponse.data.priceUSD) &&
        tokenPriceResponse.data.priceUSD > 0
      ) {
        tokenPriceUsd = tokenPriceResponse.data.priceUSD;
      }

      console.log("💰 Token price set:", {
        tokenPriceUsd,
        responseStructure: tokenPriceResponse,
      });

      // 3️⃣ Validación final: ambos precios deben ser números válidos
      // solPrice ahora siempre tiene un valor (cliente, API o defecto de 1)
      if (!solPrice || !isFinite(solPrice) || solPrice <= 0) {
        console.warn("⚠️ SOL price validation failed, using fallback of 1 USD");
        solPrice = 1; // Fallback final
      }
      // tokenPriceUsd ahora siempre tiene un valor (API o defecto de 0.01)
      if (!tokenPriceUsd || !isFinite(tokenPriceUsd) || tokenPriceUsd <= 0) {
        console.warn(
          "⚠️ Token price validation failed, using fallback of 0.01 USD",
        );
        tokenPriceUsd = 0.01; // Fallback final
      }

      // 4️⃣ Calcular precio en SOL
      const tokenPriceInSol = tokenPriceUsd / solPrice;
      if (!isFinite(tokenPriceInSol)) {
        throw new Error(
          "Token price in SOL calculation resulted in invalid number",
        );
      }

      // 5️⃣ Actualizar estado con precios reales
      setTokenInfo((prev) => ({
        ...prev,
        price: tokenPriceUsd, // Precio real del token en USD (desde bonding curve)
        solPriceUsd: solPrice, // Precio de SOL para referencia
      }));

      console.log("✅ Precios actualizados exitosamente:", {
        tokenPriceUsd: tokenPriceUsd.toFixed(8),
        solPriceUsd: solPrice.toFixed(2),
        tokenPriceInSol: tokenPriceInSol.toFixed(9),
      });

      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch prices";
      console.warn("⚠️ Error fetching prices:", message, err);
      // Mantener datos previos y marcarlos stale; no escribir nuevos
      // valores numéricos falsos.
      setTokenInfo((prev) => ({
        ...prev,
        isStale: true,
        lastUpdated: prev.lastUpdated || Date.now(),
      }));
    }
  };

  const refreshTokenInfo = async () => {
    try {
      const tokenData = await exchangeService.getTokenInfo();
      // Sanear valores numéricos y usar fallback si vienen undefined/null
      const safePrice =
        tokenData && typeof tokenData.price !== "undefined"
          ? Number(tokenData.price) || 0.01
          : 0.01;
      const safeTotalSupply =
        tokenData && typeof tokenData.totalSupply !== "undefined"
          ? Number(tokenData.totalSupply) || 0
          : 0;
      const safeCirculating =
        tokenData && typeof tokenData.circulatingSupply !== "undefined"
          ? Number(tokenData.circulatingSupply) || 0
          : 0;
      const safeHolders =
        tokenData && tokenData.holders ? tokenData.holders : {};

      setTokenInfo((prev) => ({
        ...prev,
        name: tokenData.name || prev.name,
        symbol: tokenData.symbol || prev.symbol,
        totalSupply: safeTotalSupply,
        circulatingSupply: safeCirculating,
        price: typeof safePrice === "number" ? safePrice : prev.price,
        holders: safeHolders,
        lastUpdated: Date.now(),
        isStale: false,
      }));
      // Guardar caché local
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            name: tokenData.name,
            symbol: tokenData.symbol,
            price: safePrice,
            solPriceUsd: tokenInfo.solPriceUsd,
            totalSupply: safeTotalSupply,
            circulatingSupply: safeCirculating,
            holders: safeHolders,
            lastUpdated: Date.now(),
          }),
        );
      } catch (e) {
        console.warn("No se pudo guardar caché local:", e);
      }
      setError(null);
    } catch (err) {
      // Si falla, mantener los datos iniciales
      console.warn(
        "Failed to fetch token info, using defaults:",
        err instanceof Error ? err.message : "Unknown error",
      );
      // Marcar stale para que UI no muestre datos inventados
      setTokenInfo((prev) => ({ ...prev, isStale: true }));
    }
  };

  const refreshBalance = async () => {
    if (!user) return;
    try {
      const balanceData = await exchangeService.getBalance(user.username);
      const tokenBalance = balanceData?.tokenBalance;
      if (tokenBalance !== undefined && tokenBalance !== null) {
        setUserBalance(parseFloat(tokenBalance));
      }
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch balance";
      setError(message);
    }
  };

  const refreshHistory = async () => {
    if (!user) return;
    try {
      console.log("📜 Cargando historial desde el servidor...");
      const historyData = await exchangeService.getHistory(user.username);

      // Mapear datos de la BD a formato de transacción del frontend
      const mappedTransactions: typeof transactions = historyData.map(
        (tx: any) => {
          let type: "BUY" | "SELL" | "TRANSFER" = "BUY";

          if (tx.transactionType === "purchase") {
            type = "BUY";
          } else if (tx.transactionType === "sale") {
            type = "SELL";
          } else if (tx.transactionType === "transfer") {
            type = "TRANSFER";
          }

          return {
            id: tx.id,
            type,
            holder: tx.walletAddress,
            holderTo: tx.metadata?.to,
            tokenAmount: tx.tokenAmount,
            fiatAmount: tx.paymentAmount,
            timestamp: new Date(tx.createdAt),
          };
        },
      );

      console.log("✅ Historial mapeado:", {
        totalTransactions: mappedTransactions.length,
        first: mappedTransactions[0],
      });

      setTransactions(mappedTransactions);
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch history";
      console.warn("⚠️ Error cargando historial:", message);
      // No setear error aquí para que no se vea un error al usuario
      // Las transacciones iniciales servirán como fallback
    }
  };

  // Helper para extraer mensajes de error de simulación
  const extractSimulationError = (err: any, logs?: string[]): string => {
    // Buscar mensajes comunes de error en los logs
    if (logs && Array.isArray(logs)) {
      for (const log of logs) {
        if (typeof log === "string") {
          // Error de balance insuficiente
          if (log.includes("insufficient lamports")) {
            const match = log.match(/insufficient lamports (\d+), need (\d+)/);
            if (match) {
              const have = parseInt(match[1]) / 1e9;
              const need = parseInt(match[2]) / 1e9;
              return `Balance insuficiente. Tienes ${have.toFixed(6)} SOL pero necesitas ${need.toFixed(6)} SOL`;
            }
            return "Balance insuficiente en tu wallet";
          }
          // Error de programa
          if (log.includes("custom program error")) {
            return "Error en el programa de la transacción. Verifica que tengas suficiente balance.";
          }
        }
      }
    }

    // Si no encontramos un mensaje específico, usar el error genérico
    if (err && typeof err === "object") {
      if (err.toString) {
        return err.toString();
      }
      if (err.message) {
        return err.message;
      }
    }

    return "Error desconocido en la simulación de la transacción";
  };

  const buyTokens = async (holder: string, tokenAmount: number) => {
    setIsLoading(true);
    setError(null);
    let transactionId = "";

    console.log("🚀 INICIANDO FLUJO DE COMPRA (nuevo servicio)");

    try {
      // Usar el nuevo adaptador del purchase-service
      const rpcUrl =
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

      const result = await buyTokensAdapter({
        holder,
        tokenAmount,
        isAuthenticated,
        user,
        rpcUrl,
        onTransactionIdReceived: (txId: string) => {
          transactionId = txId;
          console.log("📝 Transaction ID recibido:", txId);

          // Emit event
          try {
            window.dispatchEvent(
              new CustomEvent("prowallet:purchase.started", {
                detail: {
                  transactionId: txId,
                  holder,
                  tokenAmount,
                },
              }),
            );
          } catch (e) {
            console.warn("Error emitiendo evento", e);
          }

          // Join socket room
          try {
            if (socket && txId) {
              socket.joinPurchase(txId);
            }
          } catch (e) {
            console.warn("Error uniendo socket room", e);
          }
        },
        onTransactionSigned: (sig: string) => {
          console.log("✍️ Transacción firmada:", sig);
        },
      });

      transactionId = result.transactionId;

      console.log("✅ Compra completada:", {
        transactionId,
        signature: result.signature,
        tokenAmount,
      });

      // Refresh balance y history
      await Promise.all([refreshBalance(), refreshHistory()]);

      // Set success message
      setSuccessMessage(
        `¡Compra exitosa! Recibiste ${tokenAmount} tokens. TransactionID: ${transactionId}`,
      );

      // Auto-hide success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);

      // Emit success event
      try {
        PurchaseEvents.emitConfirmed({
          transactionId,
          tokenAmount,
          mintSignature: result.signature,
          timestamp: Date.now(),
        });
      } catch (e) {
        console.warn("Error emitiendo evento de éxito", e);
      }

      return transactionId;
    } catch (err) {
      console.error("❌ Error en buyTokens:", err);

      const message = err instanceof Error ? err.message : "Compra fallida";
      let errorMessage = message;

      // Si el error es específico, enriquecerlo
      if (
        message.includes("Timeout") ||
        message.includes("mint") ||
        message.includes("minted")
      ) {
        const txId = transactionId || "N/A";
        errorMessage = `${message}\n\nSi el pago se procesó pero los tokens no llegaron, contacta soporte con: ${txId}`;
      }

      setError(errorMessage);
      setSuccessMessage(null);

      // Emit error event
      if (transactionId) {
        try {
          PurchaseEvents.emitFailed({
            transactionId,
            error: errorMessage,
            timestamp: Date.now(),
          });
        } catch (e) {
          console.warn("Error emitiendo evento de error", e);
        }
      }

      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  const sellTokens = async (holder: string, tokenAmount: number) => {
    setIsLoading(true);
    setError(null);
    try {
      // ✅ VALIDACIÓN REAL: Verificar que el usuario está autenticado
      if (!isAuthenticated || !user) {
        throw new Error(
          "❌ Debes estar autenticado para vender tokens. Por favor, conecta tu wallet.",
        );
      }

      // ✅ VALIDACIÓN REAL: Verificar que hay un holder/wallet válido
      if (!holder || holder.trim().length === 0) {
        throw new Error(
          "❌ Se requiere una wallet/holder válido para la transacción.",
        );
      }

      // ✅ VALIDACIÓN REAL: Verificar que el monto es válido
      if (tokenAmount <= 0) {
        throw new Error("❌ La cantidad de tokens debe ser mayor a 0.");
      }

      // 🔐 PASO CRÍTICO: Solicitar firma de wallet
      console.log("🔐 Solicitando firma de wallet para venta...");
      const signed = await transactionSigner.signTransaction({
        type: "SELL",
        walletAddress: holder,
        tokenAmount: tokenAmount,
        amount: 0, // No hay monto en USD para venta
        timestamp: Date.now(),
      });

      // ✅ Proceder con la venta real (ahora con firma)
      const response = await exchangeService.sell({
        username: holder,
        tokenAmount,
        signature: signed.signature,
        signedMessage: JSON.stringify(signed.transactionData),
      });

      setTokenInfo((prev) => ({
        ...prev,
        holders: {
          ...prev.holders,
          [holder]: parseFloat(response.totalBalance),
        },
        circulatingSupply: prev.circulatingSupply - tokenAmount,
      }));

      setTransactions((prev) => [
        {
          id: response.transactionId,
          type: "SELL",
          holder,
          tokenAmount,
          fiatAmount: response.usdReceived,
          timestamp: new Date(),
        },
        ...prev,
      ]);

      setUserBalance(parseFloat(response.totalBalance));

      // ✅ Mostrar mensaje de éxito
      setSuccessMessage(`✅ ¡Venta exitosa! Vendiste ${tokenAmount} token(s)`);
      setTimeout(() => setSuccessMessage(null), 3000);

      // ✅ Recargar historial para mostrar la nueva transacción
      await refreshHistory();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sale failed";
      setError(message);
      setSuccessMessage(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const transferTokens = async (from: string, to: string, amount: number) => {
    setIsLoading(true);
    setError(null);
    try {
      // ✅ VALIDACIÓN REAL: Verificar que el usuario está autenticado
      if (!isAuthenticated || !user) {
        throw new Error(
          "❌ Debes estar autenticado para transferir tokens. Por favor, conecta tu wallet.",
        );
      }

      // ✅ VALIDACIÓN REAL: Verificar que hay wallets válidas
      if (!from || from.trim().length === 0 || !to || to.trim().length === 0) {
        throw new Error(
          "❌ Se requieren wallets válidas (origen y destino) para la transferencia.",
        );
      }

      // ✅ VALIDACIÓN REAL: Verificar que no son la misma wallet
      if (from.trim() === to.trim()) {
        throw new Error("❌ No puedes transferir a la misma wallet.");
      }

      // ✅ VALIDACIÓN REAL: Verificar que el monto es válido
      if (amount <= 0) {
        throw new Error("❌ La cantidad de tokens debe ser mayor a 0.");
      }

      // 🔐 PASO CRÍTICO: Solicitar firma de wallet
      console.log("🔐 Solicitando firma de wallet para transferencia...");
      const signed = await transactionSigner.signTransaction({
        type: "TRANSFER",
        walletAddress: from,
        tokenAmount: amount,
        recipient: to,
        amount: 0, // No hay monto en USD
        timestamp: Date.now(),
      });

      // ✅ Proceder con la transferencia real (ahora con firma)
      const response = await exchangeService.transfer({
        fromUsername: from,
        toUsername: to,
        tokenAmount: amount,
        signature: signed.signature,
        signedMessage: JSON.stringify(signed.transactionData),
      });

      setTransactions((prev) => [
        {
          id: response.transactionId,
          type: "TRANSFER",
          holder: from,
          holderTo: to,
          tokenAmount: amount,
          timestamp: new Date(),
        },
        ...prev,
      ]);

      // ✅ Mostrar mensaje de éxito
      setSuccessMessage(
        `✅ ¡Transferencia exitosa! Enviaste ${amount} token(s) a ${to}`,
      );
      setTimeout(() => setSuccessMessage(null), 3000);

      await refreshBalance();
      await refreshHistory();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transfer failed";
      setError(message);
      setSuccessMessage(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TokenContext.Provider
      value={{
        tokenInfo,
        transactions,
        userBalance,
        isLoading,
        error,
        successMessage,
        buyTokens,
        sellTokens,
        transferTokens,
        refreshBalance,
        refreshHistory,
        refreshPrice,
      }}
    >
      {children}
    </TokenContext.Provider>
  );
}

export function useToken() {
  const context = useContext(TokenContext);
  if (!context) {
    throw new Error("useToken must be used within a TokenProvider");
  }
  return context;
}
