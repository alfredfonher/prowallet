/**
 * Hook para validación de wallet y balance
 * Principio de Single Responsibility
 */

import { useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  validateWalletConnection,
  validateWalletSigning,
  validateSolBalance,
  createErrorHandler,
  createPurchaseLogger,
} from "./validators";
import { PurchaseState, PurchaseStep } from "./types";

interface UseWalletValidationReturn {
  validateWalletConnection: () => void;
  validateWalletSigningCapability: () => void;
  validateSolBalance: (requiredSol?: number) => Promise<void>;
  isWalletReady: boolean;
  walletAddress: string | null;
}

export const useWalletValidation = (
  setState: (updater: (prev: PurchaseState) => PurchaseState) => void,
): UseWalletValidationReturn => {
  const { connection } = useConnection();
  const { publicKey, connected, signTransaction } = useWallet();

  const logger = createPurchaseLogger(publicKey?.toString() || "unknown");
  const handleError = createErrorHandler(setState);

  const validateWalletConnectionState = useCallback((): void => {
    try {
      validateWalletConnection(publicKey);
      logger.log("Wallet connection validated");
    } catch (error) {
      handleError(error, PurchaseStep.VALIDATING_WALLET);
      throw error;
    }
  }, [publicKey, logger, handleError]);

  const validateWalletSigningCapability = useCallback((): void => {
    try {
      validateWalletSigning(publicKey, signTransaction);
      logger.log("Wallet signing capability validated");
    } catch (error) {
      handleError(error, PurchaseStep.VALIDATING_WALLET);
      throw error;
    }
  }, [publicKey, signTransaction, logger, handleError]);

  const validateSolBalanceAmount = useCallback(
    async (requiredSol: number = 0.05): Promise<void> => {
      if (!publicKey) {
        throw new Error("Wallet no conectada");
      }

      try {
        await validateSolBalance(publicKey, connection, requiredSol);
        logger.log(`SOL balance validated, required: ${requiredSol}`);
      } catch (error) {
        handleError(error, PurchaseStep.VALIDATING_BALANCE);
        throw error;
      }
    },
    [publicKey, connection, logger, handleError],
  );

  return {
    validateWalletConnection: validateWalletConnectionState,
    validateWalletSigningCapability,
    validateSolBalance: validateSolBalanceAmount,
    isWalletReady: connected && !!publicKey,
    walletAddress: publicKey?.toString() || null,
  };
};
