/**
 * Hook principal de compra refactorizado
 * Aplicando principios SOLID y separación de responsabilidades
 */

"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PurchaseState, PurchaseStep, PurchaseParams } from "./purchase/types";
import { useWalletValidation } from "./purchase/use-wallet-validation";
import { useTransactionHandler } from "./purchase/use-transaction-handler";
import { usePurchaseApi } from "./purchase/use-purchase-api";
import {
  createErrorHandler,
  createPurchaseLogger,
} from "./purchase/validators";
import { apiClient } from "@/lib/api-client";
import APP_CONFIG from "@/lib/config";

/**
 * Hook principal orquestador del flujo de compra
 * Principio: Single Responsibility (orquestación únicamente)
 */
export function usePurchase() {
  const { publicKey, connected } = useWallet();

  const [state, setPurchaseState] = useState<PurchaseState>({
    isLoading: false,
    error: null,
    success: false,
    transactionSignature: null,
    currentStep: PurchaseStep.IDLE,
  });

  // Hooks especializados (Dependency Inversion)
  const walletValidation = useWalletValidation(setPurchaseState);
  const transactionHandler = useTransactionHandler(setPurchaseState);
  const purchaseApi = usePurchaseApi(setPurchaseState);

  const logger = createPurchaseLogger(publicKey?.toString() || "unknown");
  const handleError = createErrorHandler(setPurchaseState);

  /**
   * Ejecuta el flujo completo de compra con early returns
   */
  const executePurchaseFlow = useCallback(
    async (params: PurchaseParams): Promise<boolean> => {
      try {
        logger.log("Iniciando flujo de compra", params);

        // 1. Validar wallet con early return
        if (!connected || !publicKey) {
          throw new Error("Por favor conecta tu wallet primero");
        }

        walletValidation.validateWalletConnection();
        walletValidation.validateWalletSigningCapability();

        // 2. Validar balance con early return
        await walletValidation.validateSolBalance(0.05);

        // 3. Iniciar transacción en API con early return
        const purchaseRequest = {
          tokenAmount: params.tokenAmount,
          paymentMethod: params.paymentMethod || "SOL",
          maxSlippage: params.maxSlippage || 5,
          walletAddress: publicKey.toString(),
        };

        const initiateResponse =
          await purchaseApi.initiatePurchase(purchaseRequest);
        if (!initiateResponse?.data) {
          return false;
        }

        const { transactionId, txBase64 } = initiateResponse.data;

        // 4. Firmar y enviar transacción con early return
        const signature =
          await transactionHandler.signAndSendTransaction(txBase64);
        if (!signature) {
          return false;
        }

        // 5. Confirmar en red con early return
        const confirmation =
          await transactionHandler.confirmTransaction(signature);
        if (!confirmation.confirmed) {
          throw new Error(confirmation.error || "Transacción no confirmada");
        }

        // 6. Settle en API con early return
        const settled = await purchaseApi.settlePurchase(
          transactionId,
          signature,
        );
        if (!settled) {
          return false;
        }

        logger.log("Flujo de compra completado exitosamente");
        return true;
      } catch (error) {
        handleError(error, PurchaseStep.FAILED);
        return false;
      }
    },
    [
      connected,
      publicKey,
      walletValidation,
      transactionHandler,
      purchaseApi,
      logger,
      handleError,
    ],
  );

  /**
   * Resetear estado a valores iniciales
   */
  const resetPurchaseState = useCallback((): void => {
    setPurchaseState({
      isLoading: false,
      error: null,
      success: false,
      transactionSignature: null,
      currentStep: PurchaseStep.IDLE,
    });
    logger.log("Estado de compra reseteado");
  }, [logger]);

  /**
   * Obtener descripción del paso actual
   */
  const getCurrentStepDescription = useCallback((): string => {
    const stepDescriptions = {
      [PurchaseStep.IDLE]: "Listo para comenzar",
      [PurchaseStep.VALIDATING_WALLET]: "Validando wallet...",
      [PurchaseStep.VALIDATING_BALANCE]: "Verificando balance SOL...",
      [PurchaseStep.INITIATING_TRANSACTION]: "Iniciando transacción...",
      [PurchaseStep.SIGNING_TRANSACTION]: "Firmando transacción...",
      [PurchaseStep.SENDING_TRANSACTION]: "Enviando a la red...",
      [PurchaseStep.CONFIRMING_TRANSACTION]: "Confirmando en blockchain...",
      [PurchaseStep.SETTLING_PURCHASE]: "Procesando compra...",
      [PurchaseStep.COMPLETED]: "¡Compra completada!",
      [PurchaseStep.FAILED]: "Error en el proceso",
    };

    return stepDescriptions[state.currentStep] || "Procesando...";
  }, [state.currentStep]);

  return {
    // Estado completo
    ...state,
    currentStepDescription: getCurrentStepDescription(),

    // Métodos principales
    executePurchase: executePurchaseFlow,
    resetState: resetPurchaseState,

    // Métodos individuales (para uso granular)
    validateWallet: walletValidation.validateWalletConnection,
    validateBalance: walletValidation.validateSolBalance,
    signAndSendTransaction: transactionHandler.signAndSendTransaction,
    confirmTransaction: transactionHandler.confirmTransaction,
    initiateTransaction: purchaseApi.initiatePurchase,
    settleTransaction: purchaseApi.settlePurchase,

    // Información de wallet
    isWalletReady: walletValidation.isWalletReady,
    walletAddress: walletValidation.walletAddress,
  };
}

/**
 * Hook para cotización de precios refactorizado
 */
export function usePriceQuote() {
  const [priceQuoteState, setPriceQuoteState] = useState({
    price: null as number | null,
    isLoading: false,
    error: null as string | null,
  });

  const logger = createPurchaseLogger("price-quote");

  const fetchTokenPrice = useCallback(
    async (tokenAmount: number): Promise<void> => {
      // Early return para validación
      if (tokenAmount <= 0) {
        setPriceQuoteState((prev) => ({ ...prev, price: null, error: null }));
        return;
      }

      try {
        setPriceQuoteState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));

        logger.log(`Obteniendo precio para ${tokenAmount} tokens`);

        const endpoint = `${APP_CONFIG.api.endpoints.priceQuote}?amount=${tokenAmount}`;
        const response = await apiClient.get(endpoint);

        if (!response.success) {
          throw new Error(response.error || "No se pudo obtener el precio");
        }

        const priceData = response.extra?.price ?? response.data?.price;
        setPriceQuoteState((prev) => ({
          ...prev,
          price: priceData || null,
          isLoading: false,
        }));

        logger.log(`Precio obtenido: $${priceData}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Error obteniendo precio";
        setPriceQuoteState((prev) => ({
          ...prev,
          error: errorMessage,
          price: null,
          isLoading: false,
        }));

        logger.error("Error obteniendo precio", error);
      }
    },
    [logger],
  );

  return {
    ...priceQuoteState,
    fetchPrice: fetchTokenPrice,
  };
}
