"use client";

import { useState, useCallback, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { apiClient } from "@/lib/api-client";

interface UseTokenBalanceApiReturn {
  gapcBalance: number;
  gapcBalanceFormatted: string;
  solBalance: number;
  solBalanceFormatted: string;
  solPriceUsd: number | null;
  balanceUsd: number;
  isLoading: boolean;
  error: string | null;
  refresh(): Promise<void>;
}

/**
 * Hook para obtener balance desde el BACKEND (no directamente del RPC)
 * Esto evita problemas de CORS y rate limiting del RPC público
 *
 * Usa:
 * 1. Balance endpoint desde API backend
 * 2. Precio del SOL desde /exchange/solPrice
 * 3. Cache local con TTL de 10s
 */
export function useTokenBalanceApi(): UseTokenBalanceApiReturn {
  const { publicKey } = useWallet();

  const [gapcBalance, setGapcBalance] = useState(0);
  const [solBalance, setSolBalance] = useState(0);
  const [solPriceUsd, setSolPriceUsd] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);

  const CACHE_TTL_MS = 10000; // 10 segundos

  const formatBalance = (value: number, decimals: number = 2): string => {
    return new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setGapcBalance(0);
      setSolBalance(0);
      setSolPriceUsd(null);
      return;
    }

    // Check cache
    const now = Date.now();
    if (now - lastRefreshTime < CACHE_TTL_MS) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const walletAddress = publicKey.toString();

      // 1. Obtener balance de SOL desde el backend (endpoint de balance)
      let solBalanceValue = 0;
      try {
        const balanceResponse = await apiClient.get<any>(
          `/exchange/getBalance/${walletAddress}`,
        );

        const solFromApi =
          balanceResponse?.extra?.balance ||
          balanceResponse?.data?.balance ||
          balanceResponse?.balance ||
          null;

        if (solFromApi !== null && solFromApi !== undefined) {
          solBalanceValue = Number(solFromApi);
          if (!isFinite(solBalanceValue)) {
            solBalanceValue = 0;
          }
        }
      } catch (err) {
        console.warn("Error fetching SOL balance from API:", err);
        // Continuar sin balance
      }

      setSolBalance(solBalanceValue);

      // 2. Obtener GAPC balance desde historial de compras
      let totalGapc = 0;
      try {
        const historyData = await apiClient.getPurchaseHistory(walletAddress, {
          limit: 1000,
          sort: "desc",
        });

        if (
          historyData &&
          historyData.transactions &&
          Array.isArray(historyData.transactions)
        ) {
          totalGapc = historyData.transactions.reduce(
            (sum: number, tx: any) => {
              if (tx && tx.status === "success" && tx.minted) {
                return sum + (tx.tokenAmount || 0);
              }
              return sum;
            },
            0,
          );
        }
      } catch (historyErr) {
        console.warn("Error fetching GAPC balance from history:", historyErr);
      }

      setGapcBalance(totalGapc);

      // 3. Obtener precio del SOL en USD desde backend
      let solPriceValue: number | null = null;
      try {
        const priceResponse = await apiClient.get<any>("/exchange/solPrice");

        const priceFromApi =
          priceResponse?.extra?.solPriceUsd ||
          priceResponse?.solPriceUsd ||
          priceResponse?.data?.solPriceUsd ||
          null;

        if (priceFromApi !== null && priceFromApi !== undefined) {
          const parsedPrice = Number(priceFromApi);
          if (isFinite(parsedPrice) && parsedPrice > 0) {
            solPriceValue = parsedPrice;
          }
        }
      } catch (priceErr) {
        console.warn("Error fetching SOL price:", priceErr);
      }

      setSolPriceUsd(solPriceValue);
      setLastRefreshTime(now);
    } catch (err: any) {
      const errorMsg = err.message || "Error al obtener balance";
      setError(errorMsg);
      console.error("useTokenBalanceApi error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, lastRefreshTime]);

  // Auto-refresh al conectar wallet
  useEffect(() => {
    if (publicKey) {
      refresh();
    }
  }, [publicKey, refresh]);

  const gapcBalanceFormatted = formatBalance(gapcBalance, 0);
  const solBalanceFormatted = formatBalance(solBalance, 4);
  const balanceUsd = solPriceUsd ? solBalance * solPriceUsd : 0;

  return {
    gapcBalance,
    gapcBalanceFormatted,
    solBalance,
    solBalanceFormatted,
    solPriceUsd,
    balanceUsd,
    isLoading,
    error,
    refresh,
  };
}
