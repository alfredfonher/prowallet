/**
 * Utilidades reutilizables para validación y manejo de errores
 */

import { PublicKey } from "@solana/web3.js";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { WalletError, BalanceError, TransactionError } from "./types";
import { PurchaseStep } from "./types";

/**
 * Validaciones de wallet con early returns
 */
export const validateWalletConnection = (publicKey: PublicKey | null): void => {
  if (!publicKey) {
    throw new WalletError(
      "Por favor conecta tu wallet primero",
      "WALLET_NOT_CONNECTED",
    );
  }
};

export const validateWalletSigning = (
  publicKey: PublicKey | null,
  signTransaction: unknown,
): void => {
  validateWalletConnection(publicKey);

  if (!signTransaction) {
    throw new WalletError(
      "Wallet no configurada para firmar transacciones",
      "WALLET_CANNOT_SIGN",
    );
  }
};

/**
 * Validaciones de balance con fallback inteligente (API primero, luego RPC)
 */
export const validateSolBalance = async (
  publicKey: PublicKey,
  connection: any,
  requiredSol: number = 0.05,
): Promise<void> => {
  let currentSol = 0;

  try {
    // Importar dinámicamente para evitar circular deps
    const { getBalanceWithFallback } = await import("./balance-utils");

    currentSol = await getBalanceWithFallback(publicKey, connection, "both");

    if (currentSol < requiredSol) {
      throw new BalanceError(
        `Fondos insuficientes. Necesitas ${requiredSol} SOL, tienes ${currentSol.toFixed(4)} SOL`,
        "INSUFFICIENT_BALANCE",
      );
    }
  } catch (error) {
    if (error instanceof BalanceError) {
      throw error;
    }

    throw new BalanceError(
      `No se pudo verificar balance: ${error instanceof Error ? error.message : "Error desconocido"}`,
      "BALANCE_VERIFICATION_FAILED",
    );
  }
};

/**
 * Validaciones de transacciones con early returns
 */
export const validateTransactionBase64 = (txBase64: string): void => {
  if (!txBase64 || typeof txBase64 !== "string") {
    throw new TransactionError(
      "Transacción inválida: formato base64 requerido",
      "INVALID_TRANSACTION_FORMAT",
      PurchaseStep.SIGNING_TRANSACTION,
    );
  }

  try {
    const buffer = Buffer.from(txBase64, "base64");
    if (buffer.length === 0) {
      throw new Error("Buffer vacío");
    }
  } catch (error) {
    throw new TransactionError(
      "Transacción inválida: base64 malformado",
      "MALFORMED_BASE64",
      PurchaseStep.SIGNING_TRANSACTION,
    );
  }
};

export const validatePurchaseParams = (params: {
  tokenAmount: number;
  paymentMethod?: string;
  maxSlippage?: number;
}): void => {
  const { tokenAmount, paymentMethod, maxSlippage } = params;

  if (!tokenAmount || tokenAmount <= 0) {
    throw new TransactionError(
      "El monto del token debe ser mayor a 0",
      "INVALID_TOKEN_AMOUNT",
      PurchaseStep.INITIATING_TRANSACTION,
    );
  }

  if (tokenAmount > 1000000) {
    throw new TransactionError(
      "El monto del token excede el límite máximo",
      "TOKEN_AMOUNT_TOO_HIGH",
      PurchaseStep.INITIATING_TRANSACTION,
    );
  }

  if (maxSlippage !== undefined && (maxSlippage < 0 || maxSlippage > 50)) {
    throw new TransactionError(
      "El slippage máximo debe estar entre 0% y 50%",
      "INVALID_SLIPPAGE",
      PurchaseStep.INITIATING_TRANSACTION,
    );
  }

  if (paymentMethod && typeof paymentMethod !== "string") {
    throw new TransactionError(
      "Método de pago inválido",
      "INVALID_PAYMENT_METHOD",
      PurchaseStep.INITIATING_TRANSACTION,
    );
  }
};

/**
 * Manejo robusto de errores
 */
export const createErrorHandler = (
  setState: (updater: (prev: any) => any) => void,
  defaultStep: PurchaseStep = PurchaseStep.FAILED,
) => {
  return (error: unknown, step?: PurchaseStep): void => {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    const errorStep = step || defaultStep;

    console.error(`Error en ${errorStep}:`, error);

    setState((prev: any) => ({
      ...prev,
      error: errorMessage,
      isLoading: false,
      currentStep: errorStep,
    }));
  };
};

/**
 * Utilidades de formato
 */
export const formatSolAmount = (lamports: number): string => {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
};

export const formatTransactionSignature = (signature: string): string => {
  if (!signature || typeof signature !== "string") {
    return "N/A";
  }

  return `${signature.slice(0, 4)}...${signature.slice(-4)}`;
};

/**
 * Utilidades de tiempo
 */
export const createDelay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = "Operación timeout",
): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
};

/**
 * Logging estructurado
 */
export const createPurchaseLogger = (walletAddress: string) => {
  return {
    log: (message: string, data?: any) => {
      console.log(
        `[PURCHASE] ${walletAddress?.slice(0, 8)}... | ${message}`,
        data || "",
      );
    },
    warn: (message: string, data?: any) => {
      console.warn(
        `[PURCHASE] ${walletAddress?.slice(0, 8)}... | ${message}`,
        data || "",
      );
    },
    error: (message: string, error?: any) => {
      console.error(
        `[PURCHASE] ${walletAddress?.slice(0, 8)}... | ${message}`,
        error || "",
      );
    },
  };
};
