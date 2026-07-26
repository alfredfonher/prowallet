/**
 * Validador para transacciones
 * Asegura que los datos cumplen con los estándares mínimos de integridad
 */

import { loggerService } from "../logging/logger.service";
import { Transaction } from "../../models/types";

/**
 * Valida que una transacción tenga todos los campos requeridos
 * Retorna true si es válida, false si tiene problemas críticos
 */
export function is_valid_transaction(
  transaction: Transaction,
  requestId: string,
): boolean {
  // Validación crítica: tokenAmount NUNCA debe ser null para transacciones completadas
  if (transaction.status === "completed" && transaction.tokenAmount === null) {
    loggerService.logError(
      new Error("Invalid transaction: completed with null tokenAmount"),
      {
        requestId,
        context: "is_valid_transaction",
        transactionId: transaction.transactionId,
        status: transaction.status,
        tokenAmount: transaction.tokenAmount,
      },
    );
    return false;
  }

  // Validación: transactionId requerido
  if (!transaction.transactionId) {
    loggerService.logError(
      new Error("Invalid transaction: missing transactionId"),
      {
        requestId,
        context: "is_valid_transaction",
      },
    );
    return false;
  }

  // Validación: walletAddress requerido
  if (!transaction.walletAddress) {
    loggerService.logError(
      new Error("Invalid transaction: missing walletAddress"),
      {
        requestId,
        context: "is_valid_transaction",
        transactionId: transaction.transactionId,
      },
    );
    return false;
  }

  return true;
}

/**
 * Filtra transacciones inválidas de un array
 * Log de advertencia para cada transacción descartada
 */
export function filter_valid_transactions(
  transactions: Transaction[],
  requestId: string,
): Transaction[] {
  const valid = transactions.filter((tx) => {
    const is_valid = is_valid_transaction(tx, requestId);
    if (!is_valid) {
      loggerService.logError(new Error("Filtered out invalid transaction"), {
        requestId,
        context: "filter_valid_transactions",
        transactionId: tx.transactionId,
      });
    }
    return is_valid;
  });

  if (valid.length < transactions.length) {
    loggerService.logInfo(
      "ℹ️ Some transactions were filtered due to invalid data",
      {
        requestId,
        context: "filter_valid_transactions",
        totalInput: transactions.length,
        validOutput: valid.length,
        filtered: transactions.length - valid.length,
      },
    );
  }

  return valid;
}

/**
 * Asegura que tokenAmount tiene un valor válido (nunca null)
 * Si es null, retorna 0 con un log de advertencia
 */
export function ensure_token_amount(
  tokenAmount: number | null,
  transactionId: string,
  requestId: string,
): number {
  if (tokenAmount === null) {
    loggerService.logError(new Error("Null tokenAmount converted to 0"), {
      requestId,
      context: "ensure_token_amount",
      transactionId,
      originalValue: null,
      convertedValue: 0,
    });
    return 0;
  }

  return tokenAmount;
}

/**
 * Asegura que paymentAmount tiene un valor válido (nunca null)
 * Si es null, retorna 0 con un log de advertencia
 */
export function ensure_payment_amount(
  paymentAmount: number | null,
  transactionId: string,
  requestId: string,
): number {
  if (paymentAmount === null) {
    loggerService.logError(new Error("Null paymentAmount converted to 0"), {
      requestId,
      context: "ensure_payment_amount",
      transactionId,
      originalValue: null,
      convertedValue: 0,
    });
    return 0;
  }

  return paymentAmount;
}

/**
 * Normaliza una transacción para asegurar que todos los campos están presentes
 * y tienen tipos correctos. Valida tanto tokenAmount como paymentAmount.
 */
export function normalize_transaction(
  tx: Transaction,
  requestId: string,
): Transaction {
  return {
    ...tx,
    tokenAmount: ensure_token_amount(
      tx.tokenAmount,
      tx.transactionId,
      requestId,
    ),
    paymentAmount: ensure_payment_amount(
      tx.paymentAmount,
      tx.transactionId,
      requestId,
    ),
  };
}
