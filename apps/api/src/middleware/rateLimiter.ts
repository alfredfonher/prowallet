/**
 * Rate Limiting Middleware
 * Controla las peticiones por endpoint y previene 429 errors
 */

import { Request, Response, NextFunction } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// Tipos para configuración
interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

// Presets de rate limiting
export const RATE_LIMITS = {
  STRICT: {
    windowMs: 60 * 1000, // 1 minuto
    max: 5, // 5 requests
  },
  MODERATE: {
    windowMs: 60 * 1000, // 1 minuto
    max: 30, // 30 requests
  },
  PERMISSIVE: {
    windowMs: 60 * 1000, // 1 minuto
    max: 100, // 100 requests
  },
  PURCHASE: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 50, // 50 compras máximo
  },
  PRICE_CHECK: {
    windowMs: 60 * 1000, // 1 minuto
    max: 30, // 30 checks máximo
  },
  HEALTH_CHECK: {
    windowMs: 60 * 1000, // 1 minuto
    max: 100, // health checks liberados
  },
  TRANSFER: {
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 100, // 100 transferencias máximo por hora
  },
  TRANSFER_INITIATE: {
    windowMs: 60 * 1000, // 1 minuto
    max: 10, // 10 initiations per minute
  },
  TRANSFER_CONFIRM: {
    windowMs: 60 * 1000, // 1 minuto
    max: 20, // 20 confirmations per minute
  },
} as const;

/**
 * Factory para crear limitadores de rate
 */
const createRateLimiter = (config: RateLimitConfig) =>
  rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: config.message || "Too many requests, please try again later",
    // Use the express-rate-limit ipv6-aware helper by default to avoid
    // IPv6 clients bypassing limits. Allow custom keyGenerator via config.
    keyGenerator: config.keyGenerator
      ? config.keyGenerator
      : (req: Request) => {
          try {
            // ipKeyGenerator returns a string key safe for IPv4/IPv6
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            return ipKeyGenerator(req) || req.ip || "unknown";
          } catch (err) {
            return req.ip || "unknown";
          }
        },
    // Skip health checks
    skip: (req: Request) => req.path === "/api/v1/health",
    // Custom handler
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: "Too many requests",
        retryAfter: (req as any).rateLimit?.resetTime
          ? Math.ceil(((req as any).rateLimit.resetTime - Date.now()) / 1000)
          : 60,
      });
    },
  });

// Exportar limitadores pre-configurados
export const PURCHASE_RATE_LIMITER = createRateLimiter({
  ...RATE_LIMITS.PURCHASE,
  message: "Too many purchase attempts, please wait",
});

export const PRICE_RATE_LIMITER = createRateLimiter({
  ...RATE_LIMITS.PRICE_CHECK,
  message: "Too many price checks, please wait",
});

export const HEALTH_RATE_LIMITER = createRateLimiter({
  ...RATE_LIMITS.HEALTH_CHECK,
});

export const STRICT_RATE_LIMITER = createRateLimiter({
  ...RATE_LIMITS.STRICT,
  message: "Rate limit exceeded",
});

export const MODERATE_RATE_LIMITER = createRateLimiter({
  ...RATE_LIMITS.MODERATE,
  message: "Too many requests",
});

export const TRANSFER_RATE_LIMITER = createRateLimiter({
  ...RATE_LIMITS.TRANSFER,
  message: "Too many transfers, please wait before trying again",
});

export const TRANSFER_INITIATE_RATE_LIMITER = createRateLimiter({
  ...RATE_LIMITS.TRANSFER_INITIATE,
  message: "Too many transfer initiations, please slow down",
});

export const TRANSFER_CONFIRM_RATE_LIMITER = createRateLimiter({
  ...RATE_LIMITS.TRANSFER_CONFIRM,
  message: "Too many transfer confirmations, please slow down",
});

/**
 * Middleware para rate limiting global
 */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // 1000 requests por IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => req.path === "/api/v1/health",
});

/**
 * Rate limiter por usuario (requiere API key)
 */
export const createUserRateLimiter = (apiKeyMap: Map<string, string>) =>
  rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 10000, // 10000 requests por API key por hora
    keyGenerator: (req: Request) => {
      const apiKey = req.headers["x-api-key"] as string;
      return apiKey || req.ip || "unknown";
    },
    skip: (req: Request) => {
      const apiKey = req.headers["x-api-key"] as string;
      // Si no tiene API key, usa IP limiter
      if (!apiKey) return false;
      // Si tiene API key válida, skip el rate limit
      return apiKeyMap.has(apiKey);
    },
  });
