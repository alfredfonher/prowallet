import { Router, Request, Response } from "express";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import { paymentService } from "../../services/payments/payment.service";
import { loggerService } from "../../services/logging/logger.service";
import { transactionRepository } from "../../models/types";
import { PaymentStatus } from "../../services/payments/payment.interface";
import { autoSettleWithRetry } from "../../services/solana/auto-settle-retry.service";

const router: Router = Router();

// Middleware para webhooks (sin validaciones estrictas)
router.use((req: any, res, next) => {
  // Permitir raw body para verificar signatures de webhook
  req["rawBody"] = "";
  req.on("data", (chunk: any) => {
    req["rawBody"] += chunk;
  });
  next();
});

/**
 * @swagger
 * /api/v1/payments/webhook/stripe:
 *   post:
 *     summary: Webhook de Stripe
 *     description: Endpoint para recibir notificaciones de estado de pago desde Stripe
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Payload del webhook de Stripe
 *     responses:
 *       200:
 *         description: Webhook procesado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 received:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Webhook inválido
 *       500:
 *         description: Error procesando webhook
 */
router.post("/stripe", async (req: any, res: Response) => {
  const requestId = loggerService.generateRequestId();

  try {
    const signature = req.get("stripe-signature");
    const payload = req["rawBody"];

    loggerService.logInfo("Stripe webhook received", {
      requestId,
      hasSignature: !!signature,
      payloadLength: payload.length,
    });

    const webhookResult = await paymentService.handleWebhook(
      "stripe",
      payload,
      signature,
    );

    if (webhookResult.processed) {
      // Actualizar estado de transacción en base de datos
      if (webhookResult.paymentId && webhookResult.status) {
        await updateTransactionFromWebhook(
          "stripe",
          webhookResult.paymentId,
          webhookResult.status,
          requestId,
        );
      }

      loggerService.logInfo("Stripe webhook processed successfully", {
        requestId,
        paymentId: webhookResult.paymentId,
        status: webhookResult.status,
      });
    } else {
      loggerService.logInfo("Warning: Stripe webhook not processed", {
        requestId,
        error: webhookResult.error,
      });
    }

    res.json(
      StatusFlow({
        code: StatusFlowCodes.OK,
        lang: "es",
        extra: { received: true },
      }),
    );
  } catch (error) {
    loggerService.logError(error as Error, {
      requestId,
      context: "stripe_webhook",
      endpoint: "/webhook/stripe",
    });

    res.status(400).json(
      StatusFlow({
        code: StatusFlowCodes.BAD_REQUEST,
        lang: "es",
        extra: { error: "Invalid webhook" },
      }),
    );
  }
});

/**
 * @swagger
 * /api/v1/payments/webhook/coingate:
 *   post:
 *     summary: Webhook de CoinGate
 *     description: Endpoint para recibir notificaciones de estado de pago desde CoinGate
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Payload del webhook de CoinGate
 *     responses:
 *       200:
 *         description: Webhook procesado exitosamente
 *       400:
 *         description: Webhook inválido
 *       500:
 *         description: Error procesando webhook
 */
router.post("/coingate", async (req: Request, res: Response) => {
  const requestId = loggerService.generateRequestId();

  try {
    const payload = req.body;

    loggerService.logInfo("CoinGate webhook received", {
      requestId,
      orderId: payload.id,
      status: payload.status,
    });

    const webhookResult = await paymentService.handleWebhook(
      "coingate",
      payload,
    );

    if (webhookResult.processed) {
      // Actualizar estado de transacción en base de datos
      if (webhookResult.paymentId && webhookResult.status) {
        await updateTransactionFromWebhook(
          "coingate",
          webhookResult.paymentId,
          webhookResult.status,
          requestId,
        );
      }

      loggerService.logInfo("CoinGate webhook processed successfully", {
        requestId,
        paymentId: webhookResult.paymentId,
        status: webhookResult.status,
      });
    } else {
      loggerService.logInfo("Warning: CoinGate webhook not processed", {
        requestId,
        error: webhookResult.error,
      });
    }

    res.json(
      StatusFlow({
        code: StatusFlowCodes.OK,
        lang: "es",
        extra: { received: true },
      }),
    );
  } catch (error) {
    loggerService.logError(error as Error, {
      requestId,
      context: "coingate_webhook",
      endpoint: "/webhook/coingate",
    });

    res.status(400).json(
      StatusFlow({
        code: StatusFlowCodes.BAD_REQUEST,
        lang: "es",
        extra: { error: "Invalid webhook" },
      }),
    );
  }
});

/**
 * @swagger
 * /api/v1/payments/webhook/nowpayments:
 *   post:
 *     summary: Webhook de NOWPayments
 *     description: Endpoint para recibir notificaciones de estado de pago desde NOWPayments
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Payload del webhook de NOWPayments
 *     responses:
 *       200:
 *         description: Webhook procesado exitosamente
 *       400:
 *         description: Webhook inválido
 *       500:
 *         description: Error procesando webhook
 */
router.post("/nowpayments", async (req: Request, res: Response) => {
  const requestId = loggerService.generateRequestId();

  try {
    const payload = req.body;

    loggerService.logInfo("NOWPayments webhook received", {
      requestId,
      paymentId: payload.payment_id,
      status: payload.payment_status,
    });

    const webhookResult = await paymentService.handleWebhook(
      "nowpayments",
      payload,
    );

    if (webhookResult.processed) {
      // Actualizar estado de transacción en base de datos
      if (webhookResult.paymentId && webhookResult.status) {
        await updateTransactionFromWebhook(
          "nowpayments",
          webhookResult.paymentId,
          webhookResult.status,
          requestId,
        );
      }

      loggerService.logInfo("NOWPayments webhook processed successfully", {
        requestId,
        paymentId: webhookResult.paymentId,
        status: webhookResult.status,
      });
    } else {
      loggerService.logInfo("Warning: NOWPayments webhook not processed", {
        requestId,
        error: webhookResult.error,
      });
    }

    res.json(
      StatusFlow({
        code: StatusFlowCodes.OK,
        lang: "es",
        extra: { received: true },
      }),
    );
  } catch (error) {
    loggerService.logError(error as Error, {
      requestId,
      context: "nowpayments_webhook",
      endpoint: "/webhook/nowpayments",
    });

    res.status(400).json(
      StatusFlow({
        code: StatusFlowCodes.BAD_REQUEST,
        lang: "es",
        extra: { error: "Invalid webhook" },
      }),
    );
  }
});

// Función auxiliar para actualizar transacciones desde webhooks
async function updateTransactionFromWebhook(
  processor: string,
  processorPaymentId: string,
  paymentStatus: PaymentStatus,
  requestId: string,
) {
  try {
    // Buscar la transacción usando Prisma
    const transaction = await transactionRepository.findOne({
      metadata: {
        path: ["processor"],
        equals: processor,
      },
    } as any);

    if (!transaction) {
      loggerService.logInfo("Warning: Transaction not found for webhook", {
        requestId,
        processor,
        processorPaymentId,
        paymentStatus,
      });
      return;
    }

    // Actualizar estado según el resultado del webhook
    if (paymentStatus === PaymentStatus.CONFIRMED) {
      await transactionRepository.update(
        { transactionId: transaction.transactionId },
        {
          status: "success",
          signature: processorPaymentId, // Usar el ID del procesador como signature
          completedAt: new Date(),
        },
      );

      // Log de compra exitosa
      loggerService.logTokenPurchase({
        requestId,
        walletAddress: transaction.walletAddress,
        amount: transaction.tokenAmount,
        tokenPrice: transaction.tokenPrice || 0,
        totalCost: transaction.paymentAmount || 0,
        paymentMethod: transaction.paymentToken as "SOL" | "USDC",
        status: "success",
        signature: processorPaymentId,
      });

      loggerService.logInfo("Transaction updated from webhook", {
        requestId,
        transactionId: transaction.transactionId,
        processor,
        processorPaymentId,
        newStatus: "success",
      });

      // Trigger auto-settle asynchronously so tokens are minted/transferred
      try {
        setImmediate(() => {
          autoSettleWithRetry(
            transaction.transactionId,
            transaction.walletAddress,
            transaction.tokenAmount,
            processorPaymentId,
          ).catch((err) =>
            loggerService.logError(err as Error, {
              requestId,
              context: "auto-settle-from-webhook",
            }),
          );
        });
      } catch (e) {
        loggerService.logError(e as Error, {
          requestId,
          context: "auto-settle-schedule",
        });
      }
    } else if (
      paymentStatus === PaymentStatus.FAILED ||
      paymentStatus === PaymentStatus.EXPIRED
    ) {
      await transactionRepository.markAsFailed(
        transaction.transactionId,
        `Payment ${paymentStatus.toLowerCase()} (webhook)`,
      );

      loggerService.logInfo("Transaction marked as failed from webhook", {
        requestId,
        transactionId: transaction.transactionId,
        processor,
        processorPaymentId,
        reason: paymentStatus,
      });
    }
  } catch (error) {
    loggerService.logError(error as Error, {
      requestId,
      context: "updateTransactionFromWebhook",
      processor,
      processorPaymentId,
      paymentStatus,
    });
  }
}

export default router;
