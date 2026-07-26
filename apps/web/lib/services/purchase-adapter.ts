/**
 * Adaptador para usar purchase-service.ts en token-provider.tsx
 * Convierte la interfaz del servicio puro a la interfaz del proveedor de contexto
 * TDD: Testeable y desacoplado
 */

import {
  buyTokens as buyTokensService,
  PurchaseError,
} from "./purchase-service";
import { sendSignedTransaction } from "@/lib/transaction-sender";
import { getSolPriceFromClient } from "@/lib/price-client";

/**
 * Adaptador que envuelve buyTokens para ser usado en token-provider
 * Retorna transactionId y maneja errors similares al proveedor anterior
 */
export async function buyTokensAdapter(params: {
  holder: string;
  tokenAmount: number;
  isAuthenticated: boolean;
  user: any;
  rpcUrl: string;
  onTransactionIdReceived?: (txId: string) => void;
  onTransactionSigned?: (sig: string) => void;
}): Promise<{
  transactionId: string;
  signature: string;
  tokenAmount: number;
}> {
  const {
    holder,
    tokenAmount,
    isAuthenticated,
    user,
    rpcUrl,
    onTransactionIdReceived,
    onTransactionSigned,
  } = params;

  try {
    // Adapter function to normalize request parameters
    const sendTxAdapter = async (req: any) => {
      return sendSignedTransaction({
        signedTransaction: req.signedTransaction,
        transactionType:
          req.transactionType === "token" ? "settlement" : "payment",
        skipPreflight: req.skipPreflight,
        maxRetries: req.maxRetries,
      });
    };

    const result = await buyTokensService({
      walletAddress: holder,
      tokenAmount,
      isAuthenticated,
      user,
      rpcUrl,
      getSolPriceFromClient,
      sendSignedTransaction: sendTxAdapter as any,
      onTransactionIdReceived,
      onTransactionSigned,
    });

    return result;
  } catch (error) {
    if (error instanceof PurchaseError) {
      throw new Error(error.message);
    }
    throw error;
  }
}
