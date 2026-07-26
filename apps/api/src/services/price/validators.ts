/**
 * Utilidades de validación para el servicio de precios
 */

import { ValidationError, PriceServiceError } from "./types";

/**
 * Validaciones con early returns
 */
export const validateSymbol = (symbol: string): void => {
  if (!symbol || typeof symbol !== "string") {
    throw new ValidationError("Symbol es requerido y debe ser string");
  }

  if (symbol.trim().length === 0) {
    throw new ValidationError("Symbol no puede estar vacío");
  }

  if (symbol.length > 20) {
    throw new ValidationError("Symbol demasiado largo (máximo 20 caracteres)");
  }

  if (!/^[A-Z0-9.-]+$/.test(symbol.toUpperCase())) {
    throw new ValidationError("Symbol contiene caracteres inválidos");
  }
};

export const validatePrice = (price: unknown): number => {
  if (price === null || price === undefined) {
    throw new ValidationError("Price es requerido");
  }

  const numericPrice =
    typeof price === "string" ? parseFloat(price) : Number(price);

  if (isNaN(numericPrice)) {
    throw new ValidationError("Price debe ser un número válido");
  }

  if (numericPrice <= 0) {
    throw new ValidationError("Price debe ser mayor a 0");
  }

  if (numericPrice > 1000000) {
    throw new ValidationError("Price excede el límite máximo");
  }

  return numericPrice;
};

export const validateCacheKey = (key: string): void => {
  if (!key || typeof key !== "string") {
    throw new ValidationError("Cache key es requerido");
  }

  if (key.length > 255) {
    throw new ValidationError("Cache key demasiado largo");
  }

  if (!/^[a-zA-Z0-9:_-]+$/.test(key)) {
    throw new ValidationError("Cache key contiene caracteres inválidos");
  }
};

export const validateTimeout = (timeoutMs: unknown): number => {
  const timeout = Number(timeoutMs);

  if (isNaN(timeout) || timeout < 100) {
    throw new ValidationError("Timeout debe ser al menos 100ms");
  }

  if (timeout > 300000) {
    // 5 minutos
    throw new ValidationError("Timeout no puede exceder 5 minutos");
  }

  return timeout;
};

/**
 * Utilidades de formato
 */
export const formatSymbol = (symbol: string): string => {
  return symbol.trim().toUpperCase();
};

export const formatPrice = (price: number, decimals: number = 2): string => {
  return price.toFixed(decimals);
};

export const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toISOString();
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
export const createPriceLogger = (serviceName: string = "PriceService") => {
  return {
    log: (message: string, data?: any) => {
      console.log(`[${serviceName}] ${message}`, data || "");
    },
    warn: (message: string, data?: any) => {
      console.warn(`[${serviceName}] ${message}`, data || "");
    },
    error: (message: string, error?: any) => {
      console.error(`[${serviceName}] ${message}`, error || "");
    },
    debug: (message: string, data?: any) => {
      if (process.env.NODE_ENV === "development") {
        console.debug(`[${serviceName}] ${message}`, data || "");
      }
    },
  };
};

/**
 * Manejo de errores
 */
export const createErrorHandler = (
  logger: ReturnType<typeof createPriceLogger>,
) => {
  return (error: unknown, context?: string): PriceServiceError => {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    const contextMessage = context
      ? `${context}: ${errorMessage}`
      : errorMessage;

    logger.error(contextMessage, error);

    if (error instanceof PriceServiceError) {
      return error;
    }

    return new PriceServiceError(contextMessage, "UNKNOWN_ERROR");
  };
};

/**
 * Utilidades de métricas
 */
export const calculateLatency = (startTime: number): number => {
  return Date.now() - startTime;
};

export const calculateAverage = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

/**
 * Utilidades de cache
 */
export const buildCacheKey = (prefix: string, symbol: string): string => {
  return `${prefix}:${formatSymbol(symbol)}`;
};

export const isCacheExpired = (timestamp: number, ttlMs: number): boolean => {
  return Date.now() - timestamp > ttlMs;
};

export const parseCacheData = (data: unknown): any => {
  if (!data || typeof data !== "string") {
    throw new ValidationError("Cache data inválido");
  }

  try {
    return JSON.parse(data);
  } catch (error) {
    throw new ValidationError("Cache data no es JSON válido");
  }
};
