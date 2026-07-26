/**
 * Transaction Sending Routes
 *
 * Endpoint para que el frontend envíe transacciones ya firmadas
 * El backend las envía a Solana RPC (autorizado, sin riesgos de 403)
 */

import { Router, Request, Response } from "express";
import { solanaService } from "../../services/solana/solana.service";
import { loggerService } from "../../services/logging/logger.service";
import { sendSuccess, sendError } from "../../utils/response.util";
import { StatusFlowCodes } from "status-flow";
import { loadPayerKeypair } from "../../services/solana/load-payer";
import { Transaction } from "@solana/web3.js";
import { reconstructTokenTransactionWithAuthority } from "../../services/solana/reconstruct-transaction.service";
import {
  confirm_transaction_with_retries,
  monitor_transaction_in_background,
} from "../../services/solana/confirm-transaction.service";

const router: Router = Router();

interface SendTransactionRequest {
  signedTransaction: string; // Base64 encoded signed transaction
  transactionType: "payment" | "settlement" | "other";
  skipPreflight?: boolean;
  maxRetries?: number;
  // Parámetros adicionales para reconstrucción si es necesario
  paymentAmount?: number; // En SOL
  tokenAmount?: number; // Para transferencias de tokens
  buyerAddress?: string;
  treasuryAddress?: string;
}

interface SendTransactionResponse {
  signature: string;
  status: "pending" | "confirmed";
  timestamp: string;
  transactionType: string;
}

/**
 * POST /send (mounted at /api/v1/transactions)
 *
 * Envía una transacción ya firmada a la blockchain
 *
 * IMPORTANTE:
 * - Si es una transacción de PAGO (SOL transfer), la envía directamente
 * - Si es una transacción de TOKENS, la reconstruye con autoridad como signer
 *
 * Body:
 * {
 *   "signedTransaction": "base64-encoded-transaction",
 *   "transactionType": "payment" | "settlement",
 *   "skipPreflight": false,
 *   "maxRetries": 3,
 *   "tokenAmount": 100,  // opcional, para transferencias de tokens
 *   "buyerAddress": "...",  // opcional
 *   "treasuryAddress": "..."  // opcional
 * }
 */
router.post("/send", async (req: Request, res: Response) => {
  try {
    const {
      signedTransaction,
      transactionType,
      skipPreflight,
      maxRetries,
      tokenAmount,
      buyerAddress,
    } = req.body;

    loggerService.logInfo("📨 Recibiendo transacción para enviar", {
      context: "send-transaction",
      transactionType,
      txSize: signedTransaction.length,
    });

    try {
      // 1. Convertir base64 a buffer
      loggerService.logInfo("📦 Decodificando transacción base64...", {
        context: "send-transaction",
        bufferSize: signedTransaction.length,
      });

      let txBuffer: Buffer;
      try {
        txBuffer = Buffer.from(signedTransaction, "base64");
        loggerService.logInfo("✅ Base64 decodificado correctamente", {
          context: "send-transaction",
          decodedSize: txBuffer.length,
        });
      } catch (decodeError: any) {
        loggerService.logError(decodeError, {
          context: "send-transaction:decode",
        });
        throw new Error(`Error decodificando base64: ${decodeError.message}`);
      }

      // 2. Deserializar la transacción del cliente
      loggerService.logInfo("🔄 Deserializando transacción...", {
        context: "send-transaction",
        bufferLength: txBuffer.length,
      });

      let clientSignedTx: Transaction;
      try {
        clientSignedTx = Transaction.from(txBuffer);
        loggerService.logInfo("✅ Transacción deserializada correctamente", {
          context: "send-transaction",
          signatures: clientSignedTx.signatures.length,
          feePayer: clientSignedTx.feePayer?.toString(),
          instructions: clientSignedTx.instructions.length,
        });
      } catch (deserializeError: any) {
        loggerService.logError(deserializeError, {
          context: "send-transaction:deserialize",
          bufferHex: txBuffer.toString("hex").substring(0, 100),
        });
        throw new Error(
          `Error deserializando transacción: ${deserializeError.message}`,
        );
      }

      // 3. OPERACIÓN CRÍTICA: Procesar según tipo de transacción
      // Para transacciones de TOKENS, necesitamos autoridad como signer
      // Para transacciones de PAGO (SOL), podemos enviar tal como está

      let finalTx = clientSignedTx;
      let authorityKeypair: any = null;

      if (transactionType === "settlement" && tokenAmount && buyerAddress) {
        // Es una transacción de TRANSFERENCIA DE TOKENS
        // SOLO AQUÍ necesitamos cargar la keypair

        loggerService.logInfo(
          "🔑 Cargando authority keypair para procesar transacción de TOKENS...",
          {
            context: "send-transaction",
            transactionType,
            tokenAmount,
            buyerAddress,
          },
        );

        try {
          authorityKeypair = await loadPayerKeypair();
          loggerService.logInfo("✅ Authority keypair cargado", {
            context: "send-transaction",
            publicKey: authorityKeypair.publicKey.toString(),
          });
        } catch (keypairError: any) {
          loggerService.logError(keypairError, {
            context: "send-transaction:keypair-load",
          });
          throw new Error(
            `Error cargando authority keypair: ${keypairError.message}`,
          );
        }

        // La autoridad DEBE ser signer porque es propietaria de treasuryATA
        // Reconstruir con autoridad como feePayer para registrarla como signer

        loggerService.logInfo(
          "🏗️ Reconstruyendo transacción de tokens con autoridad como signer...",
          {
            context: "send-transaction",
            transactionType,
            tokenAmount,
            buyerAddress,
            authorityAddress: authorityKeypair.publicKey.toString(),
          },
        );

        try {
          const connection = solanaService.getConnection();
          const { blockhash } = await connection.getLatestBlockhash();

          finalTx = await reconstructTokenTransactionWithAuthority(
            clientSignedTx,
            authorityKeypair.publicKey,
            blockhash,
            connection,
          );

          loggerService.logInfo("✅ Transacción reconstruida exitosamente", {
            context: "send-transaction",
            instructions: finalTx.instructions.length,
            feePayer: finalTx.feePayer?.toString(),
          });
        } catch (reconstructError: any) {
          loggerService.logError(reconstructError, {
            context: "send-transaction:reconstruct",
          });
          throw new Error(
            `Error reconstruyendo transacción: ${reconstructError.message}`,
          );
        }
      } else {
        // Es una transacción de PAGO (SOL)
        // Se envía tal como está, solo la firma del cliente
        // NO necesitamos cargar la keypair para este tipo
        loggerService.logInfo(
          "💳 Transacción de pago SOL, enviando tal como está (sin necesidad de keypair)",
          {
            context: "send-transaction",
            transactionType,
            feePayer: clientSignedTx.feePayer?.toString(),
          },
        );
      }

      // 5. Firmar la transacción con la autoridad si es necesario
      loggerService.logInfo("✍️ Procesando firmas...", {
        context: "send-transaction",
        currentSignatures: finalTx.signatures.length,
        transactionType,
      });

      try {
        // Para transacciones de tokens, agregar firma de autoridad
        // Para transacciones de pago, solo enviar la que ya está firmada
        if (transactionType === "settlement" && tokenAmount) {
          // Verificar que autoridad está como signer requerido
          const requiredSigners = new Set<string>();

          if (finalTx.feePayer) {
            requiredSigners.add(finalTx.feePayer.toString());
          }

          finalTx.instructions.forEach((instruction) => {
            instruction.keys.forEach((key) => {
              if (key.isSigner) {
                requiredSigners.add(key.pubkey.toString());
              }
            });
          });

          const authorityAddress = authorityKeypair.publicKey.toString();

          loggerService.logInfo("📋 Signers requeridos:", {
            context: "send-transaction",
            signers: Array.from(requiredSigners),
            authorityIncluded: requiredSigners.has(authorityAddress),
          });

          if (!requiredSigners.has(authorityAddress)) {
            throw new Error(
              `Authority (${authorityAddress}) no está en signers requeridos. ` +
                `Signers: ${Array.from(requiredSigners).join(", ")}`,
            );
          }

          // Firmar con autoridad
          finalTx.partialSign(authorityKeypair);

          loggerService.logInfo(
            "✅ Transacción firmada con authority keypair",
            {
              context: "send-transaction",
              totalSignatures: finalTx.signatures.length,
            },
          );
        }
      } catch (signError: any) {
        loggerService.logError(signError, {
          context: "send-transaction:sign",
          errorMessage: signError.message,
        });
        throw new Error(`Error en firma: ${signError.message}`);
      }

      // 6. Serializar la transacción
      loggerService.logInfo("📦 Serializando transacción para envío...", {
        context: "send-transaction",
        signaturesCount: finalTx.signatures.length,
        transactionType,
      });

      let fullySignedBuffer: Buffer;
      try {
        fullySignedBuffer = finalTx.serialize({
          requireAllSignatures: transactionType === "settlement",
        });
        loggerService.logInfo("✅ Transacción serializada correctamente", {
          context: "send-transaction",
          serializedSize: fullySignedBuffer.length,
        });
      } catch (serializeError: any) {
        loggerService.logError(serializeError, {
          context: "send-transaction:serialize",
        });
        throw new Error(`Error serializando: ${serializeError.message}`);
      }

      // 7. Obtener conexión del servicio Solana
      loggerService.logInfo("🔌 Obteniendo conexión Solana...", {
        context: "send-transaction",
      });

      const connection = solanaService.getConnection();

      // 8. Enviar transacción a Solana
      loggerService.logInfo("🚀 Enviando transacción a Solana...", {
        context: "send-transaction",
        size: fullySignedBuffer.length,
        skipPreflight: skipPreflight ?? false,
        transactionType,
      });

      let signature: string;
      try {
        signature = await connection.sendRawTransaction(fullySignedBuffer, {
          skipPreflight: skipPreflight ?? false,
          maxRetries: maxRetries ?? 3,
        });
        loggerService.logInfo(`✅ Transacción enviada exitosamente`, {
          context: "send-transaction",
          signature,
          transactionType,
        });
      } catch (sendError: any) {
        loggerService.logError(sendError, {
          context: "send-transaction:send-raw",
          message: sendError.message,
        });
        throw new Error(`Error enviando transacción: ${sendError.message}`);
      }

      // Iniciar confirmación con reintentos exponenciales
      // No bloquear la respuesta, ejecutar en background
      monitor_transaction_in_background(
        connection,
        signature,
        (sig) => {
          loggerService.logInfo(`✅ Transacción confirmada (background)`, {
            context: "send-transaction",
            signature: sig,
          });
        },
        (sig, reason) => {
          loggerService.logInfo(
            `⚠️ Transacción no confirmada en tiempo esperado`,
            {
              context: "send-transaction",
              signature: sig,
              reason,
              note: "Verificar en Solana Explorer. La transacción puede seguir siendo procesada.",
            },
          );
        },
      );

      // Retornar inmediatamente con el signature
      return sendSuccess(
        res,
        {
          signature,
          status: "pending",
          timestamp: new Date().toISOString(),
          transactionType,
        } as SendTransactionResponse,
        "Transacción enviada exitosamente. Se confirmará en background.",
        StatusFlowCodes.CREATED,
      );
    } catch (solanaError: any) {
      loggerService.logError(solanaError as Error, {
        context: "send-transaction:solana-error",
        transactionType,
      });

      // Extraer mensaje de error de Solana
      const errorMessage =
        solanaError?.message || "Error al enviar transacción a blockchain";

      return sendError(
        res,
        errorMessage,
        StatusFlowCodes.INTERNAL_SERVER_ERROR,
        {
          error: errorMessage,
          transactionType,
          details: solanaError?.logs || undefined,
        },
      );
    }
  } catch (error) {
    loggerService.logError(error as Error, {
      context: "send-transaction:handler",
    });

    return sendError(
      res,
      error instanceof Error ? error.message : "Error desconocido",
      StatusFlowCodes.INTERNAL_SERVER_ERROR,
      { error: error instanceof Error ? error.message : String(error) },
    );
  }
});

export default router;
