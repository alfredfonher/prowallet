/**
 * Transaction Validation Worker Service
 *
 * Periodically validates pending transactions that have been minted
 * but not yet confirmed on-chain. Runs as background service.
 *
 * Frequency: Every 10 seconds
 * Batch size: 50 transactions max per cycle
 * Timeout: 30 seconds per validation
 */

import { TransactionValidatorService } from "../services/solana/transaction-validator.service";
import { loggerService } from "../services/logging/logger.service";

export class TransactionValidationWorkerService {
  private static isRunning = false;
  private static intervalId: NodeJS.Timeout | null = null;
  private static readonly CHECK_INTERVAL = 10000; // 10 seconds
  private static runCount = 0;

  static start(): void {
    if (this.isRunning) {
      loggerService.logError(
        new Error("Transaction validation worker already running"),
        {},
      );
      return;
    }

    this.isRunning = true;
    loggerService.logInfo("Starting transaction validation worker service", {
      checkInterval: this.CHECK_INTERVAL,
    });

    // Run first check immediately (but async)
    this.performValidationCycle().catch((err) => {
      loggerService.logError(
        new Error(`Initial validation cycle failed: ${err}`),
        {},
      );
    });

    // Schedule subsequent checks
    this.intervalId = setInterval(() => {
      this.performValidationCycle().catch((err) => {
        loggerService.logError(new Error(`Validation cycle error: ${err}`), {});
      });
    }, this.CHECK_INTERVAL);
  }

  static stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    loggerService.logInfo("Transaction validation worker service stopped", {
      cyclesCompleted: this.runCount,
    });
  }

  private static async performValidationCycle(): Promise<void> {
    this.runCount++;

    const startTime = Date.now();

    try {
      const result =
        await TransactionValidatorService.validatePendingTransactions();

      const elapsed = Date.now() - startTime;

      // Log summary
      if (result.checked > 0) {
        loggerService.logInfo(`Validation cycle ${this.runCount} complete`, {
          checked: result.checked,
          confirmed: result.confirmed,
          timedOut: result.timedOut,
          errors: result.errors.length,
          elapsedMs: elapsed,
        });

        // If many transactions timed out, log warning
        if (result.timedOut > result.confirmed && result.checked > 0) {
          const timeoutRate = (
            (result.timedOut / result.checked) *
            100
          ).toFixed(1);
          loggerService.logError(
            new Error(
              `High timeout rate in validation: ${timeoutRate}% (${result.timedOut}/${result.checked})`,
            ),
            { cycleNumber: this.runCount },
          );
        }

        // Log first error if any
        if (result.errors.length > 0) {
          loggerService.logError(
            new Error(
              `Validation errors (${result.errors.length} total): ${result.errors[0].error}`,
            ),
            { transactionId: result.errors[0].transactionId },
          );
        }
      }
    } catch (error) {
      const elapsed = Date.now() - startTime;
      loggerService.logError(
        new Error(
          `Validation cycle ${this.runCount} failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        ),
        { elapsedMs: elapsed },
      );
    }
  }

  static isActive(): boolean {
    return this.isRunning;
  }

  static getCycleCount(): number {
    return this.runCount;
  }
}

export const transactionValidationWorker =
  new TransactionValidationWorkerService();
