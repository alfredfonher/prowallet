"use client";

import { useState, useCallback, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { TOKEN_MINT_ADDRESS, TOKEN_DECIMALS } from "@/lib/config";

interface UseTokenBalanceReturn {
  gapcBalance: number;
  gapcBalanceFormatted: string;
  solBalance: number;
  solBalanceFormatted: string;
  balanceUsd: number;
  isLoading: boolean;
  error: string | null;
  refresh(): Promise<void>;
}

export function useTokenBalance(): UseTokenBalanceReturn {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { user } = useAuth();

  const [gapcBalance, setGapcBalance] = useState(0);
  const [solBalance, setSolBalance] = useState(0);
  const [solPriceUsd, setSolPriceUsd] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatBalance = (value: number, decimals: number = 2): string => {
    return new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let gapcBalance = 0;
      let solBalance = 0;
      let solPriceUsd = 0;

      // PRIORITY 1: Try to get balance from authenticated endpoint first
      // This works for logged-in users WITHOUT a wallet connected
      if (user) {
        try {
          const balanceResponse =
            await apiClient.get<any>(`/exchange/getBalance`);

          if (balanceResponse?.extra) {
            gapcBalance = Number(balanceResponse.extra.tokenBalance || 0);
            // Note: getBalance returns fiatSpent, not SOL balance
            // We need to fetch SOL balance separately
          }
        } catch (apiErr: any) {
          console.warn(
            "Failed to get balance from authenticated endpoint:",
            apiErr,
          );
        }
      }

      // PRIORITY 2: If user has wallet connected, get token balance from on-chain
      if (publicKey) {
        try {
          // Calcular el Associated Token Account para GAPC
          const tokenMint = new PublicKey(TOKEN_MINT_ADDRESS);
          const tokenAccount = getAssociatedTokenAddressSync(
            tokenMint,
            publicKey,
          );

          // Obtener el balance del token account
          const tokenAccountInfo =
            await connection.getTokenAccountBalance(tokenAccount);

          if (tokenAccountInfo && tokenAccountInfo.value) {
            gapcBalance = tokenAccountInfo.value.uiAmount || 0;
          }
        } catch (tokenErr: any) {
          console.warn("Token account not found or error fetching:", tokenErr);
          // Don't error out - balance is just 0
        }

        // Get SOL balance from wallet
        try {
          const lamports = await connection.getBalance(publicKey);
          solBalance = lamports / LAMPORTS_PER_SOL;
        } catch (solErr) {
          console.error("Failed to get SOL balance:", solErr);
          solBalance = 0;
        }
      }

      // Get SOL price from API
      try {
        const priceResponse = await apiClient.get<any>("/exchange/solPrice");
        const apiPrice =
          priceResponse?.extra?.solPriceUsd ||
          priceResponse?.solPriceUsd ||
          priceResponse?.data?.solPriceUsd ||
          null;

        if (apiPrice && Number(apiPrice) > 0) {
          solPriceUsd = Number(apiPrice);
        }
      } catch (e: any) {
        console.warn("Failed to get SOL price:", e);
        solPriceUsd = 0;
      }

      setGapcBalance(gapcBalance);
      setSolBalance(solBalance);
      setSolPriceUsd(solPriceUsd);
    } catch (err: any) {
      const errorMsg = err.message || "Error al obtener balance";
      setError(errorMsg);
      console.error("Error fetching balance:", err);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, connection, user]);

  // Auto-refresh when user logs in or wallet connects
  useEffect(() => {
    if (user || publicKey) {
      refresh();
    }
  }, [user, publicKey, refresh]);

  const gapcBalanceFormatted = formatBalance(gapcBalance, 0);
  const solBalanceFormatted = formatBalance(solBalance, 4);
  const balanceUsd = solBalance * solPriceUsd;

  return {
    gapcBalance,
    gapcBalanceFormatted,
    solBalance,
    solBalanceFormatted,
    balanceUsd,
    isLoading,
    error,
    refresh,
  };
}
