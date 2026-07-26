/**
 * Auto-Settle Retry Service
 *
 * Handles retrying failed minting transactions with exponential backoff.
 * Persists retry state to database for reliability.
 *
 * Retry strategy:
 * - Attempt 1: Immediate
 * - Attempt 2: After 1 second
 * - Attempt 3: After 3 seconds
 * - If all fail: Queue for manual review / create recovery job
 */

import { autoSettlePurchase } from "./auto-settle.service";
import { TransactionValidatorService } from "./transaction-validator.service";
import { databaseService } from "../database/database.service";
import { loggerService } from "../logging/logger.service";
import { notificationsService } from "../notifications.service";

export interface RetryableTransaction {
  transactionId: string;
  walletAddress: string;
  tokenAmount: number;
  paymentSignature: string;
  attempt: number;
  maxAttempts: number;
  nextRetryAt: Date | null;
}

export interface SettlementResult {
  success: boolean;
  signature?: string;
  error?: string;
  attempt: number;
  totalAttempts: number;
  retriedAt?: Date;
}

const RETRY_DELAYS = [0, 1000, 3000]; // ms: immediate, 1s, 3s
const MAX_ATTEMPTS = 3;

/**
 * Attempt to settle a purchase with automatic retry on failure
 */
export async function autoSettleWithRetry(
  transactionId: string,
  walletAddress: string,
  tokenAmount: number,
  paymentSignature: string,
): Promise<SettlementResult> {
  const requestId = loggerService.generateRequestId();

  loggerService.logInfo(`Starting auto-settle for tx ${transactionId}`, {
    requestId,
    walletAddress,
    tokenAmount,
  });

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // Calculate delay for this attempt
      const delayMs = RETRY_DELAYS[attempt - 1] || 0;

      if (delayMs > 0) {
        loggerService.logInfo(
          `Waiting ${delayMs}ms before retry attempt ${attempt}...`,
          { requestId, transactionId },
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      loggerService.logInfo(
        `Attempt ${attempt}/${MAX_ATTEMPTS} for ${transactionId}`,
        {
          requestId,
          walletAddress,
        },
      );

      // Try to settle on-chain
      const result = await autoSettlePurchase(
        walletAddress,
        tokenAmount,
        paymentSignature,
      );

      if (result.success) {
        loggerService.logInfo(
          `✅ Auto-settle succeeded on attempt ${attempt}`,
          {
            requestId,
            transactionId,
            mintSignature: result.signature,
          },
        );

        // Validate on-chain confirmation (async, don't wait for full confirmation)
        // Start validation in background, it will update the record as it completes
        TransactionValidatorService.validateMintTransaction(
          result.signature || "",
          30000, // Wait up to 30 seconds for confirmation
        )
          .then((confirmation) => {
            TransactionValidatorService.updateTransactionConfirmation(
              transactionId,
              confirmation,
              result.signature,
            ).catch((err) => {
              loggerService.logError(
                new Error(`Failed to update confirmation: ${err}`),
                { transactionId },
              );
            });
          })
          .catch((err) => {
            loggerService.logError(
              new Error(`On-chain validation error (non-blocking): ${err}`),
              { transactionId },
            );
          });

        // Update transaction in DB
        await databaseService.getClient().transaction.update({
          where: { transactionId },
          data: {
            minted: true,
            minting: false,
            mintSignature: result.signature || undefined,
            completedAt: new Date(),
            metadata: JSON.stringify({
              attempts: attempt,
              finalStatus: "success",
              lastAttemptAt: new Date().toISOString(),
              onChainValidationStarted: new Date().toISOString(),
            }),
          },
        });

        // Emitir notificación SSE para frontends suscritos
        try {
          await notificationsService.broadcast("purchase.completed", {
            transactionId,
            walletAddress,
            tokenAmount,
            minted: true,
            mintSignature: result.signature || null,
          });
        } catch (e) {
          loggerService.logError(e as Error, {
            requestId,
            context: "notifications:auto-settle-retry",
          });
        }

        return {
          success: true,
          signature: result.signature,
          attempt,
          totalAttempts: MAX_ATTEMPTS,
        };
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      loggerService.logInfo(`Attempt ${attempt} failed: ${lastError.message}`, {
        requestId,
        transactionId,
        attempt,
      });

      // If this is the last attempt, don't wait for next retry
      if (attempt < MAX_ATTEMPTS) {
        // Schedule next retry in DB
        const delayMs = RETRY_DELAYS[attempt] || 0;
        const nextRetryAt = new Date(Date.now() + delayMs);

        await databaseService.getClient().transaction.update({
          where: { transactionId },
          data: {
            metadata: JSON.stringify({
              attempts: attempt,
              lastError: lastError.message,
              nextRetryAt: nextRetryAt.toISOString(),
              status: "retrying",
            }),
          },
        });
      }
    }
  }

  // All attempts failed
  loggerService.logError(
    new Error(`Auto-settle failed after ${MAX_ATTEMPTS} attempts`),
    {
      requestId,
      transactionId,
      walletAddress,
      finalError: lastError?.message,
    },
  );

  // Mark as failed and flag for manual review
  await databaseService.getClient().transaction.update({
    where: { transactionId },
    data: {
      status: "failed",
      minting: false,
      metadata: JSON.stringify({
        attempts: MAX_ATTEMPTS,
        finalStatus: "failed",
        error: lastError?.message || "Unknown error",
        requiresManualReview: true,
      }),
    },
  });

  return {
    success: false,
    error: lastError?.message || "Unknown error",
    attempt: MAX_ATTEMPTS,
    totalAttempts: MAX_ATTEMPTS,
  };
}

/**
 * Queue a transaction for retry (used by worker/scheduler)
 */
export async function queueTransactionForRetry(
  transactionId: string,
  delayMs: number = 5 * 60 * 1000, // Default: 5 minutes
): Promise<void> {
  loggerService.logInfo(`Queuing ${transactionId} for retry in ${delayMs}ms`, {
    context: "auto-settle-retry",
  });

  const retryAt = new Date(Date.now() + delayMs);

  await databaseService.getClient().transaction.update({
    where: { transactionId },
    data: {
      metadata: JSON.stringify({
        retryQueuedAt: new Date().toISOString(),
        retryScheduledFor: retryAt.toISOString(),
        inRetryQueue: true,
      }),
    },
  });
}

/**
 * Get pending transactions that need retry
 */
export async function getPendingRetries(): Promise<RetryableTransaction[]> {
  const now = new Date();

  const transactions = await databaseService.getClient().transaction.findMany({
    where: {
      status: { in: ["pending", "failed"] },
      minted: false,
      minting: false,
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      },
    },
    select: {
      transactionId: true,
      walletAddress: true,
      tokenAmount: true,
      signature: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return transactions
    .map((tx: any) => {
      const meta = tx.metadata || {};
      const attempts = meta.attempts || 0;

      // Calculate if it's time to retry
      const nextRetryAt = meta.nextRetryAt ? new Date(meta.nextRetryAt) : null;
      const shouldRetry =
        !nextRetryAt || nextRetryAt <= now || meta.attempts === 0;

      if (!shouldRetry) {
        return null;
      }

      return {
        transactionId: tx.transactionId,
        walletAddress: tx.walletAddress,
        tokenAmount: parseFloat(String(tx.tokenAmount)),
        paymentSignature: tx.signature || "",
        attempt: attempts + 1,
        maxAttempts: MAX_ATTEMPTS,
        nextRetryAt,
      };
    })
    .filter(
      (tx: RetryableTransaction | null): tx is RetryableTransaction =>
        tx !== null,
    );
}
