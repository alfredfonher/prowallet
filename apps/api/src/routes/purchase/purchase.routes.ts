import { Router, Request, Response } from "express";
import { validationResult, param } from "express-validator";
import {
  purchaseController,
  purchaseValidators,
} from "../../controllers/purchase/PurchaseController";
import { confirmPurchase_optimized } from "../../controllers/purchase/confirmPurchase-optimized";
import { requestLoggerMiddleware } from "../../services/logging/logger.service";
import {
  PURCHASE_RATE_LIMITER,
  PRICE_RATE_LIMITER,
} from "../../middleware/rateLimiter";
import { sendError } from "../../utils/response.util";

const router: Router = Router();

// Validation error handler
const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const details = errors.array().map((error: any) => ({
    field: error.path || error.param || "unknown",
    message: error.msg || "Validation error",
    ...(error.value !== undefined && { value: error.value }),
  }));

  // 🔍 DIAGNOSTICS: Log validation errors
  console.error("[handleValidationErrors] Validation failed for", {
    url: req.url,
    method: req.method,
    params: req.params,
    body: req.body,
    errors: details,
  });

  sendError(res, "Validation failed", 400, {
    details,
    requestId: (req as any).requestId,
  });
};

// Apply request logger
router.use(requestLoggerMiddleware);

// GET /purchase/price
router.get(
  "/price",
  PRICE_RATE_LIMITER,
  purchaseValidators.getCurrentPrice,
  handleValidationErrors,
  purchaseController.getCurrentPrice.bind(purchaseController),
);

// POST /purchase/initiate
router.post(
  "/initiate",
  PURCHASE_RATE_LIMITER,
  purchaseValidators.initiatePurchase,
  handleValidationErrors,
  purchaseController.initiatePurchase.bind(purchaseController),
);

// POST /purchase/confirm/:transactionId
router.post(
  "/confirm/:transactionId",
  purchaseValidators.confirmPurchase,
  handleValidationErrors,
  confirmPurchase_optimized,
);

// ✅ TICKET #4: POST /purchase/settle/:transactionId (retry/settlement)
router.post(
  "/settle/:transactionId",
  purchaseValidators.settlePurchase,
  handleValidationErrors,
  purchaseController.settlePurchase.bind(purchaseController),
);

// GET /purchase/history/:walletAddress
router.get(
  "/history/:walletAddress",
  purchaseValidators.getPurchaseHistory,
  handleValidationErrors,
  purchaseController.getPurchaseHistory.bind(purchaseController),
);

// GET /purchase/payment-methods
router.get(
  "/payment-methods",
  purchaseValidators.getPaymentMethods,
  handleValidationErrors,
  purchaseController.getPaymentMethods.bind(purchaseController),
);

// GET /purchase/status/:transactionId
router.get(
  "/status/:transactionId",
  purchaseValidators.getPurchaseStatus,
  handleValidationErrors,
  purchaseController.checkPaymentStatus.bind(purchaseController),
);

export default router;
