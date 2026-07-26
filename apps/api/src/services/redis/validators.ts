/**
 * Utilidades de validación para Redis
 */

import { RedisValidationError, RedisTimeoutError } from "./types";

/**
 * Validaciones con early returns
 */
export const validateRedisKey = (key: unknown): string => {
  if (!key || typeof key !== "string") {
    throw new RedisValidationError(
      "Redis key es requerido y debe ser string",
      "key",
    );
  }

  if (key.trim().length === 0) {
    throw new RedisValidationError("Redis key no puede estar vacío", "key");
  }

  if (key.length > 512) {
    throw new RedisValidationError(
      "Redis key demasiado largo (máximo 512 caracteres)",
      "key",
    );
  }

  // Validar caracteres válidos para Redis
  if (!/^[\x00-\x7F]*$/.test(key)) {
    throw new RedisValidationError(
      "Redis key contiene caracteres no-ASCII",
      "key",
    );
  }

  return key.trim();
};

export const validateRedisValue = (value: unknown): any => {
  if (value === null || value === undefined) {
    throw new RedisValidationError(
      "Redis value no puede ser null o undefined",
      "value",
    );
  }

  // Intentar serializar para validar
  try {
    JSON.stringify(value);
    return value;
  } catch (error) {
    throw new RedisValidationError(
      "Redis value no es serializable a JSON",
      "value",
    );
  }
};

export const validateTtl = (ttlMs: unknown): number | null => {
  if (ttlMs === null || ttlMs === undefined) {
    return null;
  }

  const ttl = Number(ttlMs);

  if (isNaN(ttl)) {
    throw new RedisValidationError("TTL debe ser un número válido", "ttl");
  }

  if (ttl < 0) {
    throw new RedisValidationError("TTL no puede ser negativo", "ttl");
  }

  if (ttl > 365 * 24 * 60 * 60 * 1000) {
    // 1 año en ms
    throw new RedisValidationError(
      "TTL excede el máximo permitido (1 año)",
      "ttl",
    );
  }

  return ttl;
};

export const validateTimeout = (timeoutMs: unknown): number => {
  const timeout = Number(timeoutMs);

  if (isNaN(timeout) || timeout < 100) {
    throw new RedisValidationError(
      "Timeout debe ser al menos 100ms",
      "timeout",
    );
  }

  if (timeout > 300000) {
    // 5 minutos
    throw new RedisValidationError(
      "Timeout no puede exceder 5 minutos",
      "timeout",
    );
  }

  return timeout;
};

/**
 * Utilidades de formato
 */
export const formatRedisKey = (key: string): string => {
  return validateRedisKey(key);
};

export const formatRedisValue = (value: any): string => {
  validateRedisValue(value);
  return JSON.stringify(value);
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
    setTimeout(
      () => reject(new RedisTimeoutError("UNKNOWN", timeoutMs)),
      timeoutMs,
    );
  });

  return Promise.race([promise, timeoutPromise]);
};

/**
 * Logging estructurado
 */
export const createRedisLogger = (serviceName: string = "RedisService") => {
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
  logger: ReturnType<typeof createRedisLogger>,
) => {
  return (error: unknown, context?: string): Error => {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    const contextMessage = context
      ? `${context}: ${errorMessage}`
      : errorMessage;

    logger.error(contextMessage, error);

    if (error instanceof Error) {
      return error;
    }

    return new Error(contextMessage);
  };
};

/**
 * Utilidades de parseo
 */
export const parseJsonSafely = (data: string): any => {
  try {
    return JSON.parse(data);
  } catch (error) {
    throw new RedisValidationError(
      `JSON parse error: ${error instanceof Error ? error.message : "Unknown error"}`,
      "json",
    );
  }
};

/**
 * Utilidades de conexión
 */
export const createRetryDelay = (
  attempt: number,
  baseDelayMs: number = 1000,
): number => {
  // Exponential backoff con jitter
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
  return Math.min(exponentialDelay + jitter, 30000); // Máximo 30s
};

export const shouldRetry = (
  error: unknown,
  attempt: number,
  maxRetries: number,
): boolean => {
  if (attempt >= maxRetries) {
    return false;
  }

  // No reintentar errores de validación
  if (error instanceof RedisValidationError) {
    return false;
  }

  // Reintentar errores de conexión y timeout
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    return (
      errorMessage.includes("connection") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("network") ||
      errorMessage.includes("econnreset")
    );
  }

  return true;
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
 * Utilidades de configuración
 */
export const createDefaultRedisConfig = () => ({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || "3", 10),
  retryDelayMs: parseInt(process.env.REDIS_RETRY_DELAY_MS || "1000", 10),
  connectTimeoutMs: parseInt(
    process.env.REDIS_CONNECT_TIMEOUT_MS || "10000",
    10,
  ),
  commandTimeoutMs: parseInt(
    process.env.REDIS_COMMAND_TIMEOUT_MS || "5000",
    10,
  ),
  enableOfflineQueue: process.env.REDIS_ENABLE_OFFLINE_QUEUE !== "false",
  lazyConnect: process.env.REDIS_LAZY_CONNECT !== "false",
});
