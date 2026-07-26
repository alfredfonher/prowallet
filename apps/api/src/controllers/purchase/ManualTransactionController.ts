import { Request, Response } from "express";
import { body, param } from "express-validator";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import { sendError as sendErrorUtil } from "../../utils/response.util";

import { loggerService } from "../../services/logging/logger.service";
import { transactionRepository, Transaction } from "../../models/types";

export class ManualTransactionController {
  // Confirmar transacción manualmente (sin signature de blockchain)
  async confirmManualTransaction(req: Request, res: Response): Promise<void> {
    const requestId =
      (req as any).requestId || loggerService.generateRequestId();

    try {
      const { transactionId } = req.params;
      const { action, reason } = req.body;

      // Buscar la transacción
      const transaction =
        await transactionRepository.findByTransactionId(transactionId);

      if (!transaction) {
        return this.sendError(
          res,
          "Transaction not found or not in pending status",
          404,
          requestId,
        );
      }

      // Verificar que no haya expirado (5 minutos)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (transaction.createdAt < fiveMinutesAgo) {
        // Marcar como expirada
        await transactionRepository.markAsFailed(
          transactionId,
          "Transaction expired",
        );

        return this.sendError(
          res,
          "Transaction has expired. Please initiate a new purchase.",
          410,
          requestId,
        );
      }

      // Actualizar estado a success
      const updated = await transactionRepository.update(
        { transactionId },
        {
          status: "success",
          completedAt: new Date(),
          signature: `manual-confirmation-${Date.now()}`,
          metadata: JSON.stringify({
            ...(typeof transaction.metadata === "object"
              ? transaction.metadata
              : typeof transaction.metadata === "string"
                ? JSON.parse(transaction.metadata)
                : {}),
            confirmationType: "manual",
            confirmationReason: reason || "Manual confirmation from frontend",
            confirmedBy: "system",
            confirmedAt: new Date().toISOString(),
          }),
        },
      );

      // Actualizar supply del token (mock para propósitos demo)
      this.updateTokenSupply(updated.tokenAmount);

      // Log de confirmación manual
      loggerService.logTokenPurchase({
        requestId,
        walletAddress: updated.walletAddress,
        amount: updated.tokenAmount,
        tokenPrice: updated.tokenPrice || 0,
        totalCost: updated.paymentAmount || 0,
        paymentMethod: updated.paymentToken as "SOL" | "USDC",
        status: "success",
        signature: updated.signature || "",
      });

      // Log de seguridad para confirmación manual
      loggerService.logSecurity({
        requestId,
        event: "manual_transaction_confirmation",
        severity: "medium",
        walletAddress: updated.walletAddress,
        details: `Transaction confirmed manually: ${reason || "No reason provided"}`,
        metadata: {
          transactionId,
          tokenAmount: updated.tokenAmount,
          paymentAmount: updated.paymentAmount,
        },
      });

      // Verificar si es la primera compra para logging
      const isFirst = await this.isFirstPurchase(updated.walletAddress);
      if (isFirst) {
        loggerService.logNewHolderEvent(
          updated.walletAddress,
          updated.tokenAmount,
        );
      }

      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            transactionId: updated.transactionId,
            walletAddress: updated.walletAddress,
            tokenAmount: updated.tokenAmount,
            totalCost: updated.paymentAmount,
            tokenPrice: updated.tokenPrice,
            status: "success",
            completedAt: updated.completedAt,
            signature: updated.signature,
            confirmationType: "manual",
            message:
              "Transaction confirmed successfully! Tokens have been credited to your wallet.",
          },
        }),
      );
    } catch (error) {
      loggerService.logError(error as Error, {
        requestId,
        endpoint: "/purchase/confirm-manual",
        params: req.params,
        body: req.body,
      });

      res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: {
            error:
              error instanceof Error
                ? error.message
                : "Manual confirmation failed",
          },
        }),
      );
    }
  }

  // Cancelar transacción
  async cancelTransaction(req: Request, res: Response): Promise<void> {
    const requestId =
      (req as any).requestId || loggerService.generateRequestId();

    try {
      const { transactionId } = req.params;
      const { action, reason } = req.body;

      // Buscar la transacción
      const transaction =
        await transactionRepository.findByTransactionId(transactionId);

      if (!transaction) {
        return this.sendError(
          res,
          "Transaction not found or not in pending status",
          404,
          requestId,
        );
      }

      // Actualizar estado a cancelled
      const updated = await transactionRepository.update(
        { transactionId },
        {
          status: "cancelled",
          completedAt: new Date(),
          error: reason || "Manual cancellation from frontend",
          metadata: JSON.stringify({
            ...(typeof transaction.metadata === "object"
              ? transaction.metadata
              : typeof transaction.metadata === "string"
                ? JSON.parse(transaction.metadata)
                : {}),
            cancellationType: "manual",
            cancellationReason: reason || "Manual cancellation from frontend",
            cancelledBy: "user",
            cancelledAt: new Date().toISOString(),
          }),
        },
      );

      // Log de cancelación
      loggerService.logTokenPurchase({
        requestId,
        walletAddress: updated.walletAddress,
        amount: updated.tokenAmount,
        tokenPrice: updated.tokenPrice || 0,
        totalCost: updated.paymentAmount || 0,
        paymentMethod: updated.paymentToken as "SOL" | "USDC",
        status: "failed",
        error: "Cancelled by user",
      });

      // Log de seguridad para cancelación
      loggerService.logSecurity({
        requestId,
        event: "admin_action",
        severity: "low",
        walletAddress: updated.walletAddress,
        details: `Transaction cancelled manually: ${reason || "No reason provided"}`,
        metadata: {
          transactionId,
          tokenAmount: updated.tokenAmount,
          paymentAmount: updated.paymentAmount,
        },
      });

      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            transactionId: updated.transactionId,
            walletAddress: updated.walletAddress,
            tokenAmount: updated.tokenAmount,
            totalCost: updated.paymentAmount,
            status: "cancelled",
            completedAt: updated.completedAt,
            reason: updated.error,
            message: "Transaction cancelled successfully.",
          },
        }),
      );
    } catch (error) {
      loggerService.logError(error as Error, {
        requestId,
        endpoint: "/purchase/cancel",
        params: req.params,
        body: req.body,
      });

      res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: {
            error:
              error instanceof Error
                ? error.message
                : "Transaction cancellation failed",
          },
        }),
      );
    }
  }

  // Métodos auxiliares
  private async updateTokenSupply(amount: number): Promise<void> {
    // En una implementación real, esto actualizaría el contrato
    // Por ahora solo loggeamos el cambio de supply
    loggerService.logInfo("Token supply updated", {
      amount,
      operation: "increment",
      source: "manual_confirmation",
    });
  }

  private async isFirstPurchase(walletAddress: string): Promise<boolean> {
    const purchaseCount = await transactionRepository.count({
      walletAddress,
      transactionType: "purchase",
      status: "success",
    });

    return purchaseCount === 1;
  }

  private sendError(
    res: Response,
    message: string,
    statusCode: number,
    requestId: string,
  ): void {
    try {
      sendErrorUtil(res, message, statusCode as any, {
        requestId,
      });
    } catch (e) {
      res.status(statusCode).json({
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
        requestId,
      });
    }
  }
}

// Validadores para los endpoints
export const manualTransactionValidators = {
  confirmManualTransaction: [
    param("transactionId").isUUID().withMessage("Invalid transaction ID"),
    body("action")
      .optional()
      .isIn(["confirm"])
      .withMessage('Action must be "confirm"'),
    body("reason").optional().isString().withMessage("Reason must be a string"),
  ],

  cancelTransaction: [
    param("transactionId").isUUID().withMessage("Invalid transaction ID"),
    body("action")
      .optional()
      .isIn(["cancel"])
      .withMessage('Action must be "cancel"'),
    body("reason").optional().isString().withMessage("Reason must be a string"),
  ],
};

export const manualTransactionController = new ManualTransactionController();
