/**
 * Transaction Validator Service
 *
 * Verifies that minted transactions actually appeared on-chain
 * Stores detailed confirmation metadata: blockSlot, fees, instructions
 * Implements automatic retry if confirmation fails within 30s
 *
 * State flow:
 * - pending: Sent to RPC, awaiting confirmation
 * - confirmed: Appeared on-chain with finalized state
 * - failed: After 30s without confirmation → trigger retry
 */

import { Connection, ParsedConfirmedTransaction } from "@solana/web3.js";
import { solanaService } from "../solana.service";
import { databaseService } from "../database/database.service";
import { loggerService } from "../logging/logger.service";
import { notificationsService } from "../notifications.service";

export interface TransactionConfirmation {
  status: "success" | "pending" | "failed";
  blockSlot?: number;
  blockTime?: number;
  fees?: number;
  instructionCount?: number;
  confirmationTime?: number; // ms elapsed since submission
  retrievedAt: string;
  error?: string;
}

export class TransactionValidatorService {
  private static readonly CONFIRMATION_TIMEOUT = 30000; // 30 seconds
  private static readonly POLL_INTERVAL = 500; // 500ms
  private static readonly MAX_POLLS = Math.floor(
    this.CONFIRMATION_TIMEOUT / this.POLL_INTERVAL,
  );

  /**
   * Verify that a minted transaction appeared on-chain
   * Polls connection until confirmed or timeout
   */
  static async validateMintTransaction(
    signature: string,
    maxWaitMs: number = this.CONFIRMATION_TIMEOUT,
  ): Promise<TransactionConfirmation> {
    const connection: Connection = solanaService.getConnection();
    const requestId = loggerService.generateRequestId();
    const startTime = Date.now();

    loggerService.logInfo(
      `[${requestId}] Starting validation for signature: ${signature}`,
      { signature, maxWaitMs },
    );

    // Poll for confirmation
    let pollCount = 0;
    const maxPolls = Math.ceil(maxWaitMs / this.POLL_INTERVAL);

    while (pollCount < maxPolls) {
      try {
        pollCount++;
        const elapsed = Date.now() - startTime;

        // Get transaction details
        const tx = await connection.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (tx) {
          const confirmation: TransactionConfirmation = {
            status: "success",
            blockSlot: tx.slot,
            blockTime: tx.blockTime || undefined,
            fees: tx.meta?.fee || 0,
            instructionCount: tx.transaction.message.instructions.length,
            confirmationTime: elapsed,
            retrievedAt: new Date().toISOString(),
          };

          loggerService.logInfo(
            `[${requestId}] Transaction confirmed on-chain`,
            {
              signature,
              slot: tx.slot,
              fees: tx.meta?.fee,
              confirmationTimeMs: elapsed,
              pollCount,
            },
          );

          return confirmation;
        }

        if (pollCount % 10 === 0) {
          loggerService.logInfo(
            `[${requestId}] Still polling... (${pollCount}/${maxPolls}, ${elapsed}ms)`,
            { signature },
          );
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, this.POLL_INTERVAL));
      } catch (error) {
        loggerService.logError(
          new Error(
            `[${requestId}] Error during validation poll: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          ),
          { signature, pollCount },
        );

        // Continue polling on error
        await new Promise((resolve) => setTimeout(resolve, this.POLL_INTERVAL));
      }
    }

    // Timeout reached
    const elapsed = Date.now() - startTime;
    loggerService.logError(
      new Error(
        `[${requestId}] Transaction validation timeout after ${elapsed}ms`,
      ),
      { signature, pollCount, maxWaitMs },
    );

    return {
      status: "failed",
      confirmationTime: elapsed,
      retrievedAt: new Date().toISOString(),
      error: `Transaction not confirmed after ${elapsed}ms`,
    };
  }

  /**
   * Update transaction record with confirmation data
   * Also updates related database records if needed
   */
  static async updateTransactionConfirmation(
    transactionId: string,
    confirmationData: TransactionConfirmation,
    mintSignature?: string,
  ): Promise<void> {
    const prisma = databaseService.getClient();
    const requestId = loggerService.generateRequestId();

    try {
      // Get existing metadata
      const existingTx = await prisma.transaction.findUnique({
        where: { transactionId },
      });

      const existingMetadata = (existingTx?.metadata as any) || {};

      // Update the transaction record
      await prisma.transaction.update({
        where: { transactionId },
        data: {
          ...(confirmationData.status === "success" && {
            minted: true,
            mintSignature: mintSignature || undefined,
          }),
          metadata: {
            ...existingMetadata,
            onChainValidation: {
              status: confirmationData.status,
              blockSlot: confirmationData.blockSlot,
              blockTime: confirmationData.blockTime,
              fees: confirmationData.fees,
              instructionCount: confirmationData.instructionCount,
              confirmationTimeMs: confirmationData.confirmationTime,
              retrievedAt: confirmationData.retrievedAt,
              error: confirmationData.error,
              validatedAt: new Date().toISOString(),
            },
          },
        },
      });

      loggerService.logInfo(`[${requestId}] Transaction confirmation stored`, {
        transactionId,
        status: confirmationData.status,
        blockSlot: confirmationData.blockSlot,
      });

      // Emitir notificación SSE para frontends suscritos cuando el mint se confirme
      try {
        if (confirmationData.status === "success") {
          const tx = await prisma.transaction.findUnique({
            where: { transactionId },
          });
          await notificationsService.broadcast("purchase.completed", {
            transactionId,
            walletAddress: tx?.walletAddress || null,
            tokenAmount: tx?.tokenAmount || null,
            minted: true,
            mintSignature: mintSignature || null,
          });
        }
      } catch (e) {
        loggerService.logError(e as Error, {
          requestId,
          context: "notifications:transaction-validator",
        });
      }
    } catch (error) {
      loggerService.logError(
        new Error(
          `[${requestId}] Error updating confirmation data: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        ),
        { transactionId },
      );
      throw error;
    }
  }

  /**
   * Get confirmation status for a transaction
   */
  static async getConfirmationStatus(
    transactionId: string,
  ): Promise<TransactionConfirmation | null> {
    const prisma = databaseService.getClient();

    const tx = await prisma.transaction.findUnique({
      where: { transactionId },
    });

    if (!tx || !tx.metadata) {
      return null;
    }

    const metadata = tx.metadata as any;
    return metadata.onChainValidation || null;
  }

  /**
   * Check multiple transactions for confirmation status
   * Returns summary of pending, confirmed, and failed transactions
   */
  static async validatePendingTransactions(): Promise<{
    checked: number;
    confirmed: number;
    timedOut: number;
    errors: Array<{ transactionId: string; error: string }>;
  }> {
    const prisma = databaseService.getClient();
    const requestId = loggerService.generateRequestId();

    loggerService.logInfo(
      `[${requestId}] Starting batch validation of pending transactions`,
      {},
    );

    // Get transactions that were minted but not yet confirmed on-chain
    const allPendingTransactions = await prisma.transaction.findMany({
      where: {
        minted: true,
        mintSignature: { not: null },
      },
      take: 50, // Batch process to avoid RPC overload
    });

    // Filter in-app for those without successful on-chain validation
    const pendingTransactions = allPendingTransactions.filter((tx) => {
      try {
        const metadata = JSON.parse(tx.metadata || "{}");
        return metadata?.onChainValidation?.status !== "success";
      } catch {
        return true; // Include if metadata parsing fails
      }
    });

    let confirmed = 0;
    let timedOut = 0;
    const errors: Array<{ transactionId: string; error: string }> = [];

    for (const tx of pendingTransactions) {
      try {
        if (!tx.mintSignature) continue;

        const confirmation = await this.validateMintTransaction(
          tx.mintSignature,
          30000,
        );

        await this.updateTransactionConfirmation(
          tx.transactionId,
          confirmation,
          tx.mintSignature,
        );

        if (confirmation.status === "success") {
          confirmed++;
        } else {
          timedOut++;
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        errors.push({
          transactionId: tx.transactionId,
          error: errorMsg,
        });
        loggerService.logError(
          new Error(
            `[${requestId}] Validation error for ${tx.transactionId}: ${errorMsg}`,
          ),
          {},
        );
      }
    }

    loggerService.logInfo(`[${requestId}] Batch validation complete`, {
      checked: pendingTransactions.length,
      confirmed,
      timedOut,
      errors: errors.length,
    });

    return {
      checked: pendingTransactions.length,
      confirmed,
      timedOut,
      errors,
    };
  }
}

export default TransactionValidatorService;
