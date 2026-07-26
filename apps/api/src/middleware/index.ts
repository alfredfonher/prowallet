import rateLimit from "express-rate-limit";
import helmet from "helmet";
import compression from "compression";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { body, param, query, validationResult } from "express-validator";
import { solanaService } from "../services/solana.service";
import { StatusFlow, StatusFlowCodes } from "status-flow";

// Security middleware
export const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
});

// Compression middleware
export const compressionMiddleware: RequestHandler = compression();

// Rate limiting middleware - aumentado para evitar bloqueos innecesarios
// Los endpoints específicos (compra, etc.) tienen sus propios limitadores más estrictos
export const rateLimitMiddleware = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT || "500"), // limit each IP to 500 requests per minute (was 100)
  message: {
    error: "Too many requests",
    message: "Rate limit exceeded. Please try again later.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip endpoints that have their own rate limiters to prevent double-limiting
  skip: (req: Request) => {
    const path = req.path;
    // Purchase and price endpoints have their own limiters
    return path.includes("/purchase") || path.includes("/price");
  },
});

// Strict rate limiting for write operations
export const strictRateLimitMiddleware = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 write requests per minute
  message: {
    error: "Too many write operations",
    message: "Write operations rate limit exceeded. Please try again later.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation error handler
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(
      StatusFlow({
        code: StatusFlowCodes.BAD_REQUEST,
        lang: "es",
        extra: {
          details: errors.array().map((error) => ({
            field: error.type === "field" ? error.path : "unknown",
            message: error.msg,
            value: error.type === "field" ? error.value : undefined,
          })),
        },
      }),
    );
  }
  next();
};

// Solana address validation
export const validateSolanaAddress = (field: string) => {
  return body(field).custom((value) => {
    if (!solanaService.isValidAddress(value)) {
      throw new Error(`${field} must be a valid Solana address`);
    }
    return true;
  });
};

export const validateSolanaAddressParam = (field: string) => {
  return param(field).custom((value) => {
    if (!solanaService.isValidAddress(value)) {
      throw new Error(`${field} must be a valid Solana address`);
    }
    return true;
  });
};

// Common validations
export const validateWhitelistAdd = [
  validateSolanaAddress("wallet"),
  validateSolanaAddress("authority"),
  handleValidationErrors,
];

export const validateWhitelistRemove = [
  validateSolanaAddress("wallet"),
  validateSolanaAddress("authority"),
  handleValidationErrors,
];

export const validateTransfer = [
  validateSolanaAddress("fromWallet"),
  validateSolanaAddress("toWallet"),
  validateSolanaAddress("tokenMint"),
  body("amount")
    .isFloat({ min: 0.000001 })
    .withMessage("Amount must be a positive number greater than 0.000001"),
  handleValidationErrors,
];

export const validateWalletParam = [
  validateSolanaAddressParam("wallet"),
  handleValidationErrors,
];

export const validateSignatureParam = [
  param("signature")
    .isLength({ min: 64, max: 128 })
    .withMessage("Signature must be a valid transaction signature"),
  handleValidationErrors,
];

export const validateAddressParam = [
  validateSolanaAddressParam("address"),
  handleValidationErrors,
];

// Request logging middleware
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `${new Date().toISOString()} - ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`,
    );
  });

  next();
};

// Error handling middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error("API Error:", {
    message: error.message,
    stack: error.stack,
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });

  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === "development";

  res.status(500).json({
    success: false,
    error: "Internal Server Error",
    message: isDevelopment ? error.message : "Something went wrong",
    timestamp: new Date().toISOString(),
  });
};
