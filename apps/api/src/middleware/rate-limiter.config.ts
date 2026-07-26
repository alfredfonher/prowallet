/**
 * Configuración de Rate Limiting
 * Puede deshabilitar temporalmente con RATE_LIMIT_ENABLED=false para desarrollo
 */

export const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== "false";

/**
 * Obtiene si el rate limiting está habilitado
 */
export const isRateLimitEnabled = (): boolean => {
  return RATE_LIMIT_ENABLED === true;
};

/**
 * Skip rate limiting si está deshabilitado
 */
export const shouldSkipRateLimit = (req: Request): boolean => {
  // Si rate limiting está deshabilitado, devolver true para skip
  return !isRateLimitEnabled();
};
