/**
 * Hook usePurchase - Interfaz simple para comprar tokens
 * Usa purchase-service.ts bajo el capó
 * TDD: Testeable y modular
 */

"use client";

import { useCallback, useState } from "react";
import { buyTokens, PurchaseError } from "@/lib/services/purchase-service";

export interface UsePurchaseState {
  isLoading: boolean;
  error: string | null;
  errorCode: string | null;
  transactionId: string | null;
  signature: string | null;
}

export interface UsePurchaseReturn extends UsePurchaseState {
  buyToken: (tokenAmount: number) => Promise<{
    transactionId: string;
    signature: string;
    tokenAmount: number;
  }>;
  reset: () => void;
}

export function usePurchase(
  walletAddress: string,
  isAuthenticated: boolean,
  user: any,
  config?: {
    rpcUrl?: string;
    getSolPriceFromClient?: (opts: any) => Promise<any>;
    sendSignedTransaction?: (req: any) => Promise<any>;
    onTransactionIdReceived?: (txId: string) => void;
    onTransactionSigned?: (sig: string) => void;
    onSuccess?: (result: any) => void;
    onError?: (error: PurchaseError) => void;
  },
): UsePurchaseReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const buyToken = useCallback(
    async (tokenAmount: number) => {
      setIsLoading(true);
      setError(null);
      setErrorCode(null);
      setTransactionId(null);
      setSignature(null);

      try {
        const result = await buyTokens({
          walletAddress,
          tokenAmount,
          isAuthenticated,
          user,
          rpcUrl:
            config?.rpcUrl ||
            process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
            "https://api.devnet.solana.com",
          getSolPriceFromClient: config?.getSolPriceFromClient,
          sendSignedTransaction:
            config?.sendSignedTransaction ||
            (async () => ({ signature: "", success: true })),
          onTransactionIdReceived: (txId: string) => {
            setTransactionId(txId);
            config?.onTransactionIdReceived?.(txId);
          },
          onTransactionSigned: (sig: string) => {
            setSignature(sig);
            config?.onTransactionSigned?.(sig);
          },
        });

        setSignature(result.signature);
        config?.onSuccess?.(result);
        return result;
      } catch (err) {
        let errorMessage = "Error desconocido";
        let code = "UNKNOWN_ERROR";

        if (err instanceof PurchaseError) {
          errorMessage = err.message;
          code = err.code || "PURCHASE_ERROR";
          setErrorCode(code);
          config?.onError?.(err);
        } else if (err instanceof Error) {
          errorMessage = err.message;
        } else {
          errorMessage = String(err);
        }

        setError(errorMessage);
        throw new PurchaseError(errorMessage, code);
      } finally {
        setIsLoading(false);
      }
    },
    [walletAddress, isAuthenticated, user, config],
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setErrorCode(null);
    setTransactionId(null);
    setSignature(null);
  }, []);

  return {
    isLoading,
    error,
    errorCode,
    transactionId,
    signature,
    buyToken,
    reset,
  };
}
