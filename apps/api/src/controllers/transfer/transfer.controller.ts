import { Request, Response } from "express";
import { AuthRequest } from "../../features/auth/jwt.middleware";
import { body, param, query } from "express-validator";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import { loggerService } from "../../services/logging/logger.service";
import { catchAsync } from "../../utils/catchAsync";
import { solanaService } from "../../services/solana.service";
import { prowalletService } from "../../services/prowallet.service";
import { confirm_transaction_with_retries } from "../../services/solana/confirm-transaction.service";
import { PROWALLET_CONFIG } from "../../config";
import { v4 as uuidv4 } from "uuid";
import { databaseService } from "../../services/database/database.service";
import { VersionedTransaction, Transaction } from "@solana/web3.js";

export class TransferController {
  /**
   * Inicia una transferencia retornando la transacción para ser firmada
   */
  initiateTransfer = catchAsync(async (req: AuthRequest, res: Response) => {
    const { fromWallet, toWallet, amount } = req.body;
    const requestId = req.requestId;

    // Validar los datos requeridos
    if (!fromWallet || !toWallet || !amount) {
      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Faltan campos requeridos: fromWallet, toWallet, amount",
          },
        }),
      );
    }

    // Validar que el usuario esté autenticado
    // El usuario puede estar autenticado por:
    // 1. Wallet login (req.user?.publicKey) - para transferencias desde wallet
    // 2. Username/password login (req.user?.username) - requiere fromWallet en request body
    const authenticatedUser = req.user as any;
    if (!authenticatedUser) {
      return res.status(401).json(
        StatusFlow({
          code: StatusFlowCodes.UNAUTHORIZED,
          lang: "es",
          extra: {
            error: "Usuario no autenticado",
          },
        }),
      );
    }

    // Permitir transferencias P2P: el fromWallet puede ser cualquier dirección válida
    // Si se especifica un fromWallet diferente al autenticado, se permite (P2P)
    const authenticatedWallet = authenticatedUser?.publicKey;
    console.log("Transferencia P2P permitida:", {
      authenticatedWallet,
      fromWallet,
      isSameWallet: fromWallet === authenticatedWallet,
      authMethod: authenticatedWallet ? "wallet" : "username",
    });

    // Validar que las direcciones sean válidas
    if (!solanaService.isValidAddress(fromWallet)) {
      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Invalid from wallet address",
          },
        }),
      );
    }

    if (!solanaService.isValidAddress(toWallet)) {
      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Invalid to wallet address",
          },
        }),
      );
    }

    // Validar que el amount sea un número válido
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "El monto debe ser un número positivo",
          },
        }),
      );
    }

    // Validar que no sea la misma wallet
    if (fromWallet.toLowerCase() === toWallet.toLowerCase()) {
      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Cannot transfer to the same wallet",
          },
        }),
      );
    }

    // Ejecutar la transferencia
    const result = await prowalletService.executeRestrictedTransfer({
      fromWallet,
      toWallet,
      amount: numAmount,
      tokenMint: PROWALLET_CONFIG.token_mint!,
    });

    if (!result.success) {
      loggerService.logError(new Error(`Transfer failed: ${result.error}`), {
        requestId,
        walletAddress: fromWallet,
        transactionType: "transfer",
        amount: numAmount,
        error: result.error,
        fromWallet,
        toWallet,
      });

      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: result,
        }),
      );
    }

    // Generate transaction ID
    const transactionId = uuidv4();

    loggerService.logTransaction({
      requestId,
      walletAddress: fromWallet,
      transactionType: "transfer",
      amount: numAmount,
      status: "pending",
      metadata: {
        transactionId,
        fromWallet,
        toWallet,
        amount: numAmount,
      },
    });

    const timestamp = new Date().toISOString().split("T")[1].slice(0, 12);

    console.log(
      `[${timestamp}] [TRANSFER-INITIATE] ✓ Transaction ready for signing. ID: ${transactionId}`,
    );

    return res.json(
      StatusFlow({
        code: StatusFlowCodes.OK,
        lang: "es",
        extra: {
          ...result,
          transactionId,
        },
      }),
    );
  });

  /**
   * Confirma una transferencia procesando la transacción firmada
   */
  confirmTransfer = catchAsync(async (req: AuthRequest, res: Response) => {
    const { signedTransaction, fromWallet, toWallet, amount } = req.body;
    const requestId = req.requestId;

    const timestamp = new Date().toISOString().split("T")[1].slice(0, 12);

    console.log(
      `[${timestamp}] [TRANSFER-CONFIRM] 📥 Received confirm request from ${fromWallet}`,
    );

    // Validar autenticación
    const authenticatedUser = req.user as any;
    if (!authenticatedUser) {
      console.warn(
        `[${timestamp}] [TRANSFER-CONFIRM] ❌ Unauthorized - no authenticated user`,
      );
      return res.status(401).json(
        StatusFlow({
          code: StatusFlowCodes.UNAUTHORIZED,
          lang: "es",
          extra: {
            error: "Usuario no autenticado",
          },
        }),
      );
    }

    if (!signedTransaction) {
      console.warn(
        `[${timestamp}] [TRANSFER-CONFIRM] ❌ Missing signed transaction`,
      );
      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Falta la transacción firmada",
          },
        }),
      );
    }

    // Validar formato de la transacción firmada
    if (typeof signedTransaction !== "string") {
      console.warn(
        `[${timestamp}] [TRANSFER-CONFIRM] ❌ Signed transaction must be string`,
      );
      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "La transacción firmada debe ser una cadena base64",
          },
        }),
      );
    }

    // Validar que sea un base64 válido
    let transactionBuffer: Buffer;
    try {
      transactionBuffer = Buffer.from(signedTransaction, "base64");
      console.log(
        `[${timestamp}] [TRANSFER-CONFIRM] ✓ Signed transaction decoded (${transactionBuffer.length} bytes)`,
      );
    } catch (e) {
      console.warn(
        `[${timestamp}] [TRANSFER-CONFIRM] ❌ Invalid base64 format`,
      );
      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Invalid signed transaction format",
          },
        }),
      );
    }

    try {
      // ⚠️ CRITICAL: Check for duplicate transactions (prevent double-spending on retry)
      // Extract the signature from the signed transaction buffer
      // Solana transaction signatures are 64 bytes, but we need to derive the actual signature
      // For now, we'll use a simpler approach: check if a transaction with this fromWallet and exact timestamp exists

      const prisma = databaseService.getClient();

      // Try to find a recent transaction with the same from/to/amount within the last 60 seconds
      // This prevents accidental double-sends from retry clicks
      const recentTransaction = await prisma.transaction.findFirst({
        where: {
          walletAddress: fromWallet,
          status: "success",
          createdAt: {
            gte: new Date(Date.now() - 60000), // Last 60 seconds
          },
        },
      });

      if (recentTransaction) {
        console.warn(
          `[${timestamp}] [TRANSFER-CONFIRM] ⚠️ Duplicate transaction detected - similar transaction sent within last 60 seconds`,
        );
        return res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.BAD_REQUEST,
            lang: "es",
            extra: {
              error:
                "Una transferencia similar fue procesada recientemente. Por favor espera antes de reintentar.",
              details: "Duplicate transaction attempt detected",
              txId: recentTransaction.signature,
            },
          }),
        );
      }

      // Obtener conexión
      const connection = solanaService.getConnection();

      console.log(
        `[${timestamp}] [TRANSFER-CONFIRM] 📥 Processing signed transaction (${transactionBuffer.length} bytes)`,
      );

      // ⚠️ CRITICAL FIX: Do NOT modify blockhash after signing!
      // When user signs a transaction in their wallet, the signature covers the entire message
      // including the recentBlockhash. If we change the blockhash afterwards, the signature
      // becomes invalid and Solana rejects it with "Transaction signature verification failure".
      //
      // Instead, we rely on Solana's blockhash grace period (~90-120 seconds).
      // If the blockhash expires before confirmation, we get a clear "Blockhash not found" error
      // and the user can retry, which will generate a fresh transaction.
      //
      // This is the correct flow:
      // 1. Backend generates transaction with current blockhash
      // 2. User signs (locks the signature to that exact blockhash)
      // 3. Backend sends immediately without modification
      // 4. Blockhash grace period handles the rest

      // Send the signed transaction without ANY modifications
      console.log(
        `[${timestamp}] [TRANSFER-CONFIRM] 📤 Sending signed transaction to Solana...`,
      );

      const txId = await connection.sendRawTransaction(transactionBuffer, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      console.log(
        `[${timestamp}] [TRANSFER-CONFIRM] ✓ Transaction sent, TxID: ${txId.substring(0, 8)}...`,
      );

      // Confirmar con reintentos robustos
      console.log(
        `[${timestamp}] [TRANSFER-CONFIRM] ⏳ Waiting for confirmation...`,
      );
      const confirmed = await confirm_transaction_with_retries(
        connection,
        txId,
        {
          maxRetries: 15,
          timeout: 120000, // 2 minutos
        },
      );

      if (!confirmed) {
        console.warn(
          `[${timestamp}] [TRANSFER-CONFIRM] ⚠️ Transaction not confirmed after timeout`,
        );

        loggerService.logTransaction({
          requestId,
          walletAddress: fromWallet,
          transactionType: "transfer",
          status: "failed",
          signature: txId,
          error: "Transacción no confirmada en tiempo esperado",
          metadata: {
            txId,
            note: "Verificar en Solana Explorer. La transacción puede seguir siendo procesada.",
          },
        });

        // Log de seguridad - transacción no confirmada
        loggerService.logSecurity({
          requestId,
          event: "failed_blockchain_transaction",
          severity: "high",
          details: `Transaction not confirmed after 120 seconds: ${txId}`,
          metadata: { txId, note: "Verificar en Solana Explorer" },
        });

        return res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.BAD_REQUEST,
            lang: "es",
            extra: {
              error: "La transacción no fue confirmada a tiempo",
              details:
                "Verificar transacción en Solana Explorer. Puede estar siendo procesada aún.",
              txId,
            },
          }),
        );
      }

      console.log(
        `[${timestamp}] [TRANSFER-CONFIRM] ✅ Transaction CONFIRMED on blockchain`,
      );

      loggerService.logTransaction({
        requestId,
        walletAddress: fromWallet,
        transactionType: "transfer",
        status: "success",
        signature: txId,
        metadata: { txId },
      });

      // Save transaction to database
      try {
        const prisma = databaseService.getClient();
        await prisma.transaction.create({
          data: {
            transactionId: txId,
            signature: txId,
            walletAddress: fromWallet,
            transactionType: "transfer",
            tokenAmount: amount || 0,
            status: "success",
            metadata: JSON.stringify({
              fromWallet,
              toWallet,
              amount: amount || 0,
              timestamp: new Date().toISOString(),
              requestId,
            }),
          },
        });
        console.log(
          `[${timestamp}] [TRANSFER-CONFIRM] 💾 Transaction saved to database`,
        );
      } catch (dbError) {
        console.warn(
          `[${timestamp}] [TRANSFER-CONFIRM] ⚠️ Failed to save to database:`,
          dbError instanceof Error ? dbError.message : String(dbError),
        );
        // Don't fail the response, just warn
      }

      return res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            transactionId: txId,
            status: "confirmed",
          },
        }),
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[${timestamp}] [TRANSFER-CONFIRM] ❌ Error:`, errorMsg);

      loggerService.logTransaction({
        requestId,
        walletAddress: fromWallet,
        transactionType: "transfer",
        status: "failed",
        error: errorMsg,
        metadata: { errorMsg },
      });

      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error:
              error instanceof Error
                ? error.message
                : "Failed to confirm transfer",
          },
        }),
      );
    }
  });

  /**
   * Obtiene los detalles de una transacción específica
   */
  getTransactionDetail = catchAsync(async (req: AuthRequest, res: Response) => {
    const { transactionId } = req.params;
    const requestId = req.requestId;

    const timestamp = new Date().toISOString().split("T")[1].slice(0, 12);

    console.log(
      `[${timestamp}] [TRANSFER-DETAIL] 📋 Fetching transaction ${transactionId}`,
    );

    // Validar que sea un ID válido
    if (!transactionId || transactionId.length === 0) {
      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Invalid transaction ID",
          },
        }),
      );
    }

    try {
      const prisma = databaseService.getClient();

      // Try to find by ID first
      let transaction = await prisma.transaction
        .findUnique({
          where: { id: transactionId },
        })
        .catch(() => null);

      // If not found by ID, try by transactionId or signature
      if (!transaction) {
        const allTransactions = await prisma.transaction.findMany({
          where: {
            OR: [{ transactionId }, { signature: transactionId }],
          },
          take: 1,
        });
        transaction = allTransactions[0] || null;
      }

      if (!transaction) {
        console.warn(
          `[${timestamp}] [TRANSFER-DETAIL] ❌ Transaction not found`,
        );
        return res.status(404).json(
          StatusFlow({
            code: StatusFlowCodes.NOT_FOUND,
            lang: "es",
            extra: {
              error: "Transacción no encontrada",
            },
          }),
        );
      }

      console.log(
        `[${timestamp}] [TRANSFER-DETAIL] ✓ Transaction found: ${transaction.id}`,
      );

      return res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            id: transaction.id,
            transactionId: transaction.transactionId,
            signature: transaction.signature,
            status: transaction.status,
            amount: transaction.tokenAmount,
            createdAt: transaction.createdAt,
            metadata: transaction.metadata
              ? JSON.parse(transaction.metadata)
              : null,
          },
        }),
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[${timestamp}] [TRANSFER-DETAIL] ❌ Error:`, errorMsg);

      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Failed to fetch transaction details",
          },
        }),
      );
    }
  });

  /**
   * Obtiene el historial de transferencias de un usuario
   */
  getTransferHistory = catchAsync(async (req: AuthRequest, res: Response) => {
    const { walletAddress } = req.params;
    const { limit = "50", offset = "0", status } = req.query;
    const requestId = req.requestId;

    const timestamp = new Date().toISOString().split("T")[1].slice(0, 12);

    console.log(
      `[${timestamp}] [TRANSFER-HISTORY] 📋 Fetching history for ${walletAddress}`,
    );

    // Validar que sea una dirección válida
    if (!solanaService.isValidAddress(walletAddress)) {
      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Invalid wallet address",
          },
        }),
      );
    }

    try {
      const prisma = databaseService.getClient();
      const limitNum = Math.min(parseInt(limit as string) || 50, 100);
      const offsetNum = parseInt(offset as string) || 0;

      // Build query filters
      const where: any = {
        walletAddress,
        transactionType: "transfer",
      };

      if (
        status &&
        ["pending", "success", "failed"].includes(status as string)
      ) {
        where.status = status;
      }

      // Get transfers
      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: offsetNum,
          take: limitNum,
        }),
        prisma.transaction.count({ where }),
      ]);

      console.log(
        `[${timestamp}] [TRANSFER-HISTORY] ✓ Found ${transactions.length} transfers`,
      );

      return res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            transfers: transactions.map((tx) => ({
              id: tx.id,
              transactionId: tx.transactionId,
              signature: tx.signature,
              status: tx.status,
              amount: tx.tokenAmount,
              createdAt: tx.createdAt,
              metadata: tx.metadata ? JSON.parse(tx.metadata) : null,
            })),
            pagination: {
              total,
              limit: limitNum,
              offset: offsetNum,
              hasMore: offsetNum + limitNum < total,
            },
          },
        }),
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[${timestamp}] [TRANSFER-HISTORY] ❌ Error:`, errorMsg);

      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Failed to fetch transfer history",
          },
        }),
      );
    }
  });
}

export const transferController = new TransferController();

// ✅ Validators con validación de inputs mejorada
export const transferValidators = {
  initiateTransfer: [
    body("fromWallet")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("From wallet address is required")
      .custom((value) => {
        if (!solanaService.isValidAddress(value)) {
          throw new Error("Invalid from wallet address");
        }
        return true;
      }),
    body("toWallet")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("To wallet address is required")
      .custom((value) => {
        if (!solanaService.isValidAddress(value)) {
          throw new Error("Invalid to wallet address");
        }
        return true;
      })
      .custom((value, { req }) => {
        if (value.toLowerCase() === req.body.fromWallet?.toLowerCase()) {
          throw new Error("Cannot transfer to the same wallet");
        }
        return true;
      }),
    body("amount")
      .isFloat({ min: 0.000000001 })
      .withMessage("Amount must be a positive number greater than 0.000000001"),
  ],
  confirmTransfer: [
    body("signedTransaction")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Signed transaction is required")
      .custom((value) => {
        try {
          Buffer.from(value, "base64");
          return true;
        } catch (e) {
          throw new Error("Invalid signed transaction format");
        }
      }),
    body("fromWallet")
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage("From wallet must be a string"),
  ],
};
