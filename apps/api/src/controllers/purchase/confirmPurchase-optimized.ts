import { Response, Request } from "express";
import { v4 } from "uuid";
import { transactionRepository } from "../../models/types";
import { loggerService } from "../../services/logging/logger.service";
import { confirm_transaction_in_background } from "../../workers/confirm-transaction.worker";
import { sendSuccess, sendError } from "../../utils/response.util";

async function confirmPurchase_optimized(
  req: Request,
  res: Response,
): Promise<void> {
  const requestId = (req as any).requestId || v4();

  try {
    const { transactionId } = req.params;
    const { signature } = req.body;

    if (!transactionId || !signature) {
      sendError(res, "Missing transactionId or signature", 400);
      return;
    }

    const tx = await transactionRepository.findOne({ transactionId });
    if (!tx) {
      sendError(res, "Transaction not found", 404);
      return;
    }

    const updated = await transactionRepository.update(
      { transactionId, status: "pending" },
      { status: "confirming", signature },
    );

    if (!updated) {
      sendSuccess(res, {
        transactionId,
        status: "processing",
        message: "Transaction is already being confirmed",
      });
      return;
    }

    sendSuccess(res, {
      transactionId,
      status: "confirming",
      message: "Transaction confirmation in progress",
    });

    setImmediate(async () => {
      try {
        await confirm_transaction_in_background(
          transactionId,
          signature,
          tx.walletAddress,
          tx.tokenAmount,
          requestId,
        );
      } catch (error) {
        loggerService.logError(error as Error, {
          requestId,
          context: "confirmPurchase.background",
        });
      }
    });
  } catch (error) {
    loggerService.logError(error as Error, {
      requestId,
      context: "confirmPurchase",
    });
    sendError(
      res,
      error instanceof Error ? error.message : "Unknown error",
      500,
    );
  }
}

export { confirmPurchase_optimized };
