import { Router, Request, Response, Express } from "express";
import { Connection, Transaction } from "@solana/web3.js";
import { loggerService } from "../../services/logging/logger.service";
import { solanaService } from "../../services/solana/solana.service";

/**
 * Router para envío seguro de transacciones Solana
 * - Centraliza el envío en backend para aplicar retry/failover
 * - Evita que frontend hable directamente con RPC (que es vulnerable a 403)
 * - Implementa circuit breaker y backoff exponencial
 */

const router: ReturnType<typeof Router> = Router();

interface SendTransactionRequest {
  transactionBase64: string;
  skipPreflight?: boolean;
  maxRetries?: number;
}

interface SendTransactionResponse {
  signature: string;
  rpcUsed: string;
  timestamp: string;
}

/**
 * POST /api/v1/transaction/send
 *
 * Envía una transacción firmada a Solana con retry automático y failover
 *
 * Body:
 * - transactionBase64: string (transacción serializada en base64)
 * - skipPreflight: boolean (opcional, default: false)
 * - maxRetries: number (opcional, default: 3)
 *
 * Response:
 * - signature: string (firma de la transacción)
 * - rpcUsed: string (RPC que procesó la transacción)
 * - timestamp: string (ISO timestamp)
 */
router.post("/send", async (req: Request, res: Response): Promise<void> => {
  const requestId = `txn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const {
    transactionBase64,
    skipPreflight = false,
    maxRetries = 3,
  } = req.body as SendTransactionRequest;

  try {
    // Validaciones
    if (!transactionBase64) {
      loggerService.logInfo("Validación falló: transactionBase64 vacío", {
        context: "POST /transaction/send",
        requestId,
      });
      res.status(400).json({
        error: "transactionBase64 requerido",
        code: "INVALID_REQUEST",
      });
      return;
    }

    // Parsear y validar transacción
    let transaction: Transaction;
    try {
      const buffer = Buffer.from(transactionBase64, "base64");
      transaction = Transaction.from(buffer);
    } catch (error) {
      loggerService.logInfo("Validación falló: transactionBase64 inválido", {
        context: "POST /transaction/send",
        requestId,
        error: String(error),
      });
      res.status(400).json({
        error: "transactionBase64 inválido o corrupto",
        code: "INVALID_TRANSACTION",
      });
      return;
    }

    loggerService.logInfo("Enviando transacción con retry/failover", {
      context: "POST /transaction/send",
      requestId,
      skipPreflight,
      maxRetries,
      feePayer: transaction.feePayer?.toString(),
    });

    // Usar servicio Solana para enviar con retry y failover
    const signature = await solanaService.sendSignedTransaction(transaction, {
      skipPreflight,
      maxRetries,
    });

    loggerService.logInfo("✅ Transacción enviada exitosamente", {
      context: "POST /transaction/send",
      requestId,
      signature,
      rpcUsed: solanaService.getCurrentRpcUrl(),
    });

    const response: SendTransactionResponse = {
      signature,
      rpcUsed: solanaService.getCurrentRpcUrl(),
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    loggerService.logInfo("❌ Error al enviar transacción", {
      context: "POST /transaction/send",
      requestId,
      error: errorMessage,
      rpcUsed: solanaService.getCurrentRpcUrl(),
    });

    // Detectar si fue error de 403 (ambas RPCs bloqueadas)
    if (
      errorMessage.includes("403") ||
      errorMessage.includes("Access forbidden")
    ) {
      res.status(503).json({
        error: "Servicio RPC temporalmente no disponible (acceso prohibido)",
        code: "RPC_FORBIDDEN",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Detectar si fue error de 429 (rate limit)
    if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
      res.status(429).json({
        error: "Servicio RPC limitado por tasa, por favor reintenta en 30 segundos",
        code: "RPC_RATE_LIMITED",
        retryAfter: 30,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Error genérico
    res.status(500).json({
      error: "Error al enviar transacción",
      code: "SEND_FAILED",
      message: errorMessage.substring(0, 200),
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/v1/transaction/rpc-status
 *
 * Retorna estado actual de las RPCs (para debugging/monitoreo)
 */
router.get("/rpc-status", (req: Request, res: Response): void => {
  const status = {
    primaryRpc: process.env.SOLANA_RPC_URL,
    fallbackRpc: process.env.FALLBACK_SOLANA_RPC_URL,
    primaryRpcFailing: solanaService.isPrimaryRpcFailing(),
    currentRpcInUse: solanaService.getCurrentRpcUrl(),
    recoveryScheduledIn: solanaService.getRecoveryTimeRemaining(),
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(status);
});

export default router;
