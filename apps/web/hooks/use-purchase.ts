/**
 * Hook para manejar el flujo de compra E2E
 * Siguiendo el patrón del frontend legacy (gapstation-frontend-main)
 *
 * Flujo:
 * 1. Validar wallet conectada
 * 2. Validar balance SOL
 * 3. POST /api/v1/purchase/initiate → Recibe txBase64
 * 4. Deserializar y firmar transacción
 * 5. Enviar a la red Solana
 * 6. POST /api/v1/purchase/settle → Confirmar con firma
 */

"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { apiClient } from "@/lib/api-client";
import APP_CONFIG from "@/lib/config";

// Interfaces
export interface PurchaseInitiateResponse {
  success: boolean;
  data?: {
    transactionId: string;
    txBase64: string;
    estimatedFee: number;
    totalCost: number;
  };
  error?: string;
}

export interface PurchaseSettleResponse {
  success: boolean;
  data?: {
    confirmed: boolean;
    signature: string;
    blockSlot: number;
  };
  error?: string;
}

export interface PurchaseParams {
  tokenAmount: number;
  paymentMethod?: string;
  maxSlippage?: number;
}

export interface UsePurchaseState {
  isLoading: boolean;
  error: string | null;
  success: boolean;
  transactionSignature: string | null;
}

/**
 * Hook usePurchase - Maneja todo el flujo de compra
 */
export function usePurchase() {
  const { connection } = useConnection();
  const { publicKey, connected, signTransaction, wallet } = useWallet();

  const [state, setState] = useState<UsePurchaseState>({
    isLoading: false,
    error: null,
    success: false,
    transactionSignature: null,
  });

  /**
   * Paso 1: Validar balance SOL con fallback (API → RPC)
   */
  const validateBalance = useCallback(
    async (requiredSol: number = 0.05): Promise<boolean> => {
      if (!publicKey) {
        setState((prev) => ({
          ...prev,
          error: "Por favor conecta tu wallet",
        }));
        return false;
      }

      try {
        let balanceSol = 0;

        // 1. Intentar desde API backend primero (evita CORS 403)
        try {
          const response = await apiClient.get<any>(
            `/exchange/getBalance/${publicKey.toString()}`,
          );
          const balance =
            response?.extra?.balance ||
            response?.data?.balance ||
            response?.balance ||
            null;

          if (balance !== null && balance !== undefined) {
            const numBalance = Number(balance);
            if (isFinite(numBalance) && numBalance >= 0) {
              balanceSol = numBalance;
            }
          }
        } catch (apiErr) {
          console.warn("Balance from API failed:", apiErr);
          // No hacer fallback a RPC directamente (la API está bloqueada con 403)
          throw new Error(
            "No se pudo obtener el balance. Por favor intenta de nuevo.",
          );
        }

        if (balanceSol < requiredSol) {
          setState((prev) => ({
            ...prev,
            error: `Fondos insuficientes. Necesitas ${requiredSol} SOL, tienes ${balanceSol.toFixed(
              4,
            )} SOL`,
          }));
          return false;
        }

        return true;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Error validando balance";
        setState((prev) => ({
          ...prev,
          error: `No se pudo verificar balance: ${errorMsg}`,
        }));
        return false;
      }
    },
    [publicKey, connection],
  );

  /**
   * Paso 2: Iniciar compra (obtener txBase64)
   */
  const initiateTransaction = useCallback(
    async (
      params: PurchaseParams,
    ): Promise<PurchaseInitiateResponse | null> => {
      if (!publicKey) {
        setState((prev) => ({
          ...prev,
          error: "Wallet no conectada",
        }));
        return null;
      }

      try {
        setState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));

        // Llamar backend para obtener txBase64
        const response = await apiClient.post<PurchaseInitiateResponse>(
          APP_CONFIG.api.endpoints.purchaseInitiate,
          {
            walletAddress: publicKey.toString(),
            tokenAmount: params.tokenAmount,
            paymentMethod: params.paymentMethod || "SOL",
            maxSlippage: params.maxSlippage || 5,
          },
        );

        if (!response.success) {
          throw new Error(response.error || "No se pudo iniciar la compra");
        }

        return response.data ? response : null;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Error iniciando compra";
        setState((prev) => ({
          ...prev,
          error: `Error en backend: ${errorMsg}`,
          isLoading: false,
        }));
        return null;
      }
    },
    [publicKey],
  );

  /**
   * Paso 3: Firmar y enviar transacción
   */
  const signAndSendTransaction = useCallback(
    async (txBase64: string): Promise<string | null> => {
      if (!publicKey || !signTransaction) {
        setState((prev) => ({
          ...prev,
          error: "Wallet no configurada para firmar",
        }));
        return null;
      }

      try {
        setState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));

        // Deserializar transacción
        const txBuffer = Buffer.from(txBase64, "base64");
        const tx = Transaction.from(txBuffer);
        tx.feePayer = publicKey;

        // Firmar con wallet
        console.log("Solicitando firma de wallet...");
        const signed = await signTransaction(tx);

        // Enviar AL BACKEND para que lo re-firme y envíe
        console.log("Enviando transacción al backend para procesamiento...");
        const signedTxBase64 = signed
          .serialize({ requireAllSignatures: false })
          .toString("base64");

        const response = await fetch(
          `${APP_CONFIG.apiBaseUrl}/api/v1/transactions/send`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              signedTransaction: signedTxBase64,
              transactionType: "settlement",
              skipPreflight: false,
              maxRetries: 3,
            }),
          },
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(
            error.message || `Error del servidor: ${response.status}`,
          );
        }

        const result = await response.json();
        const signature = result.signature || result.data?.signature;

        if (!signature) {
          throw new Error("No se recibió firma de transacción del backend");
        }

        console.log("Transacción enviada por backend:", signature);

        // Esperar confirmación en Solana
        console.log("Esperando confirmación en la red...");
        const confirmation = await connection.confirmTransaction(
          signature,
          "confirmed",
        );

        if (confirmation.value.err) {
          throw new Error(
            `Transacción rechazada por la red: ${confirmation.value.err}`,
          );
        }

        setState((prev) => ({
          ...prev,
          transactionSignature: signature,
        }));

        return signature;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Error firmando transacción";
        setState((prev) => ({
          ...prev,
          error: `Error en firma/envío: ${errorMsg}`,
          isLoading: false,
        }));
        return null;
      }
    },
    [publicKey, signTransaction, connection],
  );

  /**
   * Paso 4: Confirmar compra en backend
   */
  const settleTransaction = useCallback(
    async (transactionId: string, signature: string): Promise<boolean> => {
      try {
        setState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));

        const response = await apiClient.post<PurchaseSettleResponse>(
          APP_CONFIG.api.endpoints.purchaseSettle,
          {
            transactionId,
            signature,
          },
        );

        if (!response.success) {
          throw new Error(response.error || "No se pudo confirmar la compra");
        }

        setState((prev) => ({
          ...prev,
          success: true,
          isLoading: false,
        }));

        return true;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Error confirmando compra";
        setState((prev) => ({
          ...prev,
          error: `Error en confirmación: ${errorMsg}`,
          isLoading: false,
        }));
        return false;
      }
    },
    [],
  );

  /**
   * Método principal: Ejecuta todo el flujo
   */
  const executePurchase = useCallback(
    async (params: PurchaseParams): Promise<boolean> => {
      // 1. Validar estado inicial
      if (!publicKey || !connected) {
        setState((prev) => ({
          ...prev,
          error: "Por favor conecta tu wallet primero",
        }));
        return false;
      }

      // 2. Validar balance
      const hasBalance = await validateBalance(0.05);
      if (!hasBalance) {
        return false;
      }

      // 3. Iniciar transacción en backend
      const initiateResponse = await initiateTransaction(params);
      if (!initiateResponse?.data) {
        return false;
      }

      const { transactionId, txBase64 } = initiateResponse.data;

      // 4. Firmar y enviar
      const signature = await signAndSendTransaction(txBase64);
      if (!signature) {
        return false;
      }

      // 5. Confirmar en backend
      const settled = await settleTransaction(transactionId, signature);
      if (!settled) {
        return false;
      }

      return true;
    },
    [
      publicKey,
      connected,
      validateBalance,
      initiateTransaction,
      signAndSendTransaction,
      settleTransaction,
    ],
  );

  /**
   * Resetear estado
   */
  const resetState = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      success: false,
      transactionSignature: null,
    });
  }, []);

  return {
    // Estado
    ...state,

    // Métodos
    executePurchase,
    resetState,

    // Métodos individuales (por si se necesitan separados)
    validateBalance,
    initiateTransaction,
    signAndSendTransaction,
    settleTransaction,

    // Info
    isWalletConnected: connected,
    walletAddress: publicKey?.toString() || null,
  };
}

/**
 * Hook auxiliar para obtener el precio
 */
export function usePriceQuote() {
  const [price, setPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrice = useCallback(async (tokenAmount: number) => {
    if (tokenAmount <= 0) {
      setPrice(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const endpoint = `${APP_CONFIG.api.endpoints.priceQuote}?amount=${tokenAmount}`;

      const response = await apiClient.get<{
        success: boolean;
        extra?: { price: number; solPrice: number };
        data?: { price: number; solPrice: number };
        error?: string;
      }>(endpoint);

      if (!response.success) {
        throw new Error(response.error || "No se pudo obtener el precio");
      }

      // Manejo flexible de estructura de respuesta
      const priceData = response.extra?.price ?? response.data?.price;
      setPrice(priceData || null);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Error obteniendo precio";
      setError(errorMsg);
      setPrice(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { price, isLoading, error, fetchPrice };
}

/**
 * Hook para obtener precio, métodos de pago e historial de compras
 */
export function usePurchaseData() {
  const [priceData, setPriceData] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<any[]>([]);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [isLoadingMethods, setIsLoadingMethods] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrice = useCallback(async (amount: number) => {
    if (amount <= 0) return;

    setIsLoadingPrice(true);
    setError(null);

    try {
      const data = await apiClient.getPurchasePrice(amount);
      setPriceData(data);
    } catch (err: any) {
      const errorMsg = err.message || "Error al obtener precio";
      setError(errorMsg);
    } finally {
      setIsLoadingPrice(false);
    }
  }, []);

  const fetchPaymentMethods = useCallback(async () => {
    setIsLoadingMethods(true);
    setError(null);

    try {
      const methods = await apiClient.getPaymentMethods();
      setPaymentMethods(methods);
    } catch (err: any) {
      const errorMsg = err.message || "Error al obtener métodos de pago";
      setError(errorMsg);
    } finally {
      setIsLoadingMethods(false);
    }
  }, []);

  const fetchHistory = useCallback(
    async (walletAddress: string, options?: any) => {
      if (!walletAddress) return;

      setIsLoadingHistory(true);
      setError(null);

      try {
        const data = await apiClient.getPurchaseHistory(walletAddress, options);
        setTransactionHistory(data.transactions || []);
      } catch (err: any) {
        const errorMsg = err.message || "Error al obtener historial";
        setError(errorMsg);
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    priceData,
    paymentMethods,
    transactionHistory,
    isLoadingPrice,
    isLoadingMethods,
    isLoadingHistory,
    error,
    fetchPrice,
    fetchPaymentMethods,
    fetchHistory,
    clearError,
  };
}
