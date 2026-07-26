/**
 * Hook para comunicación con API de compras
 * Principio de Single Responsibility
 */

import { useCallback } from "react";
import {
  validatePurchaseParams,
  createErrorHandler,
  createPurchaseLogger,
  withTimeout,
} from "./validators";
import {
  PurchaseState,
  PurchaseStep,
  PurchaseInitiateResponse,
  PurchaseSettleResponse,
  PurchaseRequest,
} from "./types";
import { apiClient } from "@/lib/api-client";
import APP_CONFIG from "@/lib/config";

interface UsePurchaseApiReturn {
  initiatePurchase: (
    params: PurchaseRequest,
  ) => Promise<PurchaseInitiateResponse | null>;
  settlePurchase: (
    transactionId: string,
    signature: string,
  ) => Promise<PurchaseSettleResponse | null>;
}

const API_TIMEOUT_MS = 30000; // 30 segundos

export const usePurchaseApi = (
  setState: (updater: (prev: PurchaseState) => PurchaseState) => void,
): UsePurchaseApiReturn => {
  const logger = createPurchaseLogger("api-client");
  const handleError = createErrorHandler(setState);

  const initiatePurchase = useCallback(
    async (
      params: PurchaseRequest,
    ): Promise<PurchaseInitiateResponse | null> => {
      try {
        // Validar parámetros con early return
        validatePurchaseParams(params);

        logger.log("Iniciando compra en API", params);

        setState((prev) => ({
          ...prev,
          isLoading: true,
          currentStep: PurchaseStep.INITIATING_TRANSACTION,
          error: null,
        }));

        // Llamar API con timeout
        const response = await withTimeout(
          apiClient.post<PurchaseInitiateResponse>(
            APP_CONFIG.api.endpoints.purchaseInitiate,
            params,
          ),
          API_TIMEOUT_MS,
          "Timeout iniciando compra",
        );

        if (!response.success) {
          throw new Error(response.error || "No se pudo iniciar la compra");
        }

        logger.log("Compra iniciada exitosamente", {
          transactionId: response.data?.transactionId,
          estimatedFee: response.data?.estimatedFee,
        });

        return response;
      } catch (error) {
        handleError(error, PurchaseStep.INITIATING_TRANSACTION);
        return null;
      } finally {
        setState((prev) => ({
          ...prev,
          isLoading: false,
        }));
      }
    },
    [logger, handleError],
  );

  const settlePurchase = useCallback(
    async (
      transactionId: string,
      signature: string,
    ): Promise<PurchaseSettleResponse | null> => {
      try {
        // Validaciones con early returns
        if (!transactionId || typeof transactionId !== "string") {
          throw new Error("ID de transacción inválido");
        }

        if (!signature || typeof signature !== "string") {
          throw new Error("Firma de transacción inválida");
        }

        logger.log("Confirmando compra en API", { transactionId, signature });

        setState((prev) => ({
          ...prev,
          isLoading: true,
          currentStep: PurchaseStep.SETTLING_PURCHASE,
          error: null,
        }));

        // Llamar API con timeout
        const response = await withTimeout(
          apiClient.post<PurchaseSettleResponse>(
            APP_CONFIG.api.endpoints.purchaseSettle,
            {
              transactionId,
              signature,
            },
          ),
          API_TIMEOUT_MS,
          "Timeout confirmando compra",
        );

        if (!response.success) {
          throw new Error(response.error || "No se pudo confirmar la compra");
        }

        logger.log("Compra confirmada exitosamente", {
          confirmed: response.data?.confirmed,
          blockSlot: response.data?.blockSlot,
        });

        // Actualizar estado final
        setState((prev) => ({
          ...prev,
          success: true,
          currentStep: PurchaseStep.COMPLETED,
          isLoading: false,
        }));

        return response;
      } catch (error) {
        handleError(error, PurchaseStep.SETTLING_PURCHASE);
        return null;
      }
    },
    [logger, handleError],
  );

  return {
    initiatePurchase,
    settlePurchase,
  };
};
