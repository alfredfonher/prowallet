/**
 * Hook para manejo de transacciones Solana
 * Principio de Single Responsibility
 */

import { useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import {
  validateTransactionBase64,
  createErrorHandler,
  createPurchaseLogger,
  withTimeout,
} from "./validators";
import { PurchaseState, PurchaseStep, TransactionConfirmation } from "./types";

interface UseTransactionHandlerReturn {
  signAndSendTransaction: (txBase64: string) => Promise<string | null>;
  confirmTransaction: (signature: string) => Promise<TransactionConfirmation>;
}

const TRANSACTION_TIMEOUT_MS = 30000; // 30 segundos
const CONFIRMATION_TIMEOUT_MS = 60000; // 1 minuto

export const useTransactionHandler = (
  setState: (updater: (prev: PurchaseState) => PurchaseState) => void,
): UseTransactionHandlerReturn => {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  const logger = createPurchaseLogger(publicKey?.toString() || "unknown");
  const handleError = createErrorHandler(setState);

  const sendTransactionViaBackend = useCallback(
    async (signedTransaction: Transaction): Promise<string> => {
      const transactionBase64 = Buffer.from(
        signedTransaction.serialize(),
      ).toString("base64");

      const apiBaseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const endpoint = `${apiBaseUrl}/api/v1/transactions/send`;

      logger.log("POST request a backend", {
        endpoint,
        method: "POST",
      });

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transactionBase64,
          skipPreflight: false,
          maxRetries: 3,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}`;
        throw new Error(`Backend error: ${errorMessage}`);
      }

      const result = await response.json();
      logger.log("✅ Backend envió transacción exitosamente", {
        signature: result.signature,
        rpcUsed: result.rpcUsed,
      });

      return result.signature;
    },
    [logger],
  );

  const signAndSendTransaction = useCallback(
    async (txBase64: string): Promise<string | null> => {
      if (!publicKey || !signTransaction) {
        const error = new Error("Wallet no configurada para firmar");
        handleError(error, PurchaseStep.SIGNING_TRANSACTION);
        return null;
      }

      try {
        // Validar formato con early return
        validateTransactionBase64(txBase64);

        logger.log("Iniciando firma y envío de transacción");

        // Deserializar transacción
        const transactionBuffer = Buffer.from(txBase64, "base64");
        const transaction = Transaction.from(transactionBuffer);
        transaction.feePayer = publicKey;

        // Firmar con timeout
        logger.log("Solicitando firma de wallet...");
        const signedTransaction = await withTimeout(
          signTransaction(transaction),
          TRANSACTION_TIMEOUT_MS,
          "Timeout firmando transacción",
        );

        // Enviar con timeout a NUESTRO BACKEND (no a RPC directamente)
        logger.log("Enviando transacción al backend para procesamiento...");
        const signature = await withTimeout(
          sendTransactionViaBackend(signedTransaction),
          TRANSACTION_TIMEOUT_MS,
          "Timeout enviando transacción al backend",
        );

        logger.log(`Transacción enviada: ${signature}`);

        // Actualizar estado con firma
        setState((prev) => ({
          ...prev,
          transactionSignature: signature,
          currentStep: PurchaseStep.CONFIRMING_TRANSACTION,
        }));

        return signature;
      } catch (error) {
        handleError(error, PurchaseStep.SIGNING_TRANSACTION);
        return null;
      }
    },
    [
      publicKey,
      signTransaction,
      connection,
      logger,
      handleError,
      sendTransactionViaBackend,
    ],
  );

  const confirmTransaction = useCallback(
    async (signature: string): Promise<TransactionConfirmation> => {
      try {
        logger.log(`Confirmando transacción: ${signature}`);

        // Confirmar con timeout
        const confirmation = await withTimeout(
          connection.confirmTransaction(signature, "confirmed"),
          CONFIRMATION_TIMEOUT_MS,
          "Timeout confirmando transacción",
        );

        if (confirmation.value.err) {
          throw new Error(
            `Transacción rechazada: ${JSON.stringify(confirmation.value.err)}`,
          );
        }

        const result: TransactionConfirmation = {
          signature,
          confirmed: true,
        };

        logger.log(`Transacción confirmada en bloque: ${result.blockSlot}`);
        return result;
      } catch (error) {
        const errorResult: TransactionConfirmation = {
          signature,
          confirmed: false,
          error: error instanceof Error ? error.message : "Error desconocido",
        };

        logger.error("Error confirmando transacción", error);
        return errorResult;
      }
    },
    [connection, logger],
  );

  return {
    signAndSendTransaction,
    confirmTransaction,
  };
};
