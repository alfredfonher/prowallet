/**
 * Transaction Sender Service
 *
 * Envía transacciones firmadas al backend para que las envíe a Helius
 * Evita problemas con 403 que ocurren cuando el frontend intenta enviar directamente
 */

import { apiClient } from "./api-client";

export interface SendTransactionParams {
  signedTransaction: string; // Base64 encoded
  transactionType?: "payment" | "settlement" | "other";
  skipPreflight?: boolean;
  maxRetries?: number;
}

export interface SendTransactionResponse {
  readonly signature: string;
  readonly status: "pending" | "confirmed";
  readonly timestamp: string;
  readonly transactionType: string;
}

/**
 * Envía una transacción ya firmada al backend
 * El backend la envía a Helius (autorizado sin 403)
 */
export async function sendSignedTransaction(
  params: SendTransactionParams,
): Promise<SendTransactionResponse> {
  try {
    // Wrapper response from apiClient
    interface ApiResponse {
      success: boolean;
      message?: string;
      code?: number;
      extra?: SendTransactionResponse;
    }

    const response = await apiClient.post<ApiResponse>("/transactions/send", {
      signedTransaction: params.signedTransaction,
      transactionType: params.transactionType || "payment",
      skipPreflight: params.skipPreflight ?? false,
      maxRetries: params.maxRetries ?? 3,
    });

    if (!response.success) {
      throw new Error(response.message || "Error al enviar transacción");
    }

    if (!response.extra) {
      throw new Error("Respuesta vacía del servidor");
    }

    console.log(
      "✅ Transacción enviada desde backend:",
      response.extra.signature,
    );

    return response.extra;
  } catch (error) {
    console.error(
      "❌ Error al enviar transacción:",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}

/**
 * Envía transacción y espera confirmación
 * (Versión con timeout)
 */
export async function sendSignedTransactionWithConfirmation(
  params: SendTransactionParams,
  timeoutMs: number = 60000,
): Promise<SendTransactionResponse> {
  try {
    const confirmationPromise = sendSignedTransaction(params);

    const timeoutPromise = new Promise<SendTransactionResponse>((_, reject) =>
      setTimeout(
        () => reject(new Error("Timeout esperando envío de transacción")),
        timeoutMs,
      ),
    );

    return await Promise.race([confirmationPromise, timeoutPromise]);
  } catch (error) {
    console.error("❌ Error en sendSignedTransactionWithConfirmation:", error);
    throw error;
  }
}
