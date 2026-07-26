/**
 * Middleware para deshabilitar temporalmente el rate limiting durante desarrollo
 * Permite hacer múltiples llamadas desde el mismo componente React
 */

import { Request, Response, NextFunction } from "express";

/**
 * Flag para controlar si el rate limiting está habilitado
 * Por defecto está deshabilitado en desarrollo
 */
let RATE_LIMITING_ENABLED = false;

/**
 * Función para habilitar el rate limiting si está habilitado
 */
export function enableRateLimiting(): void {
  RATE_LIMITING_ENABLED = true;
}

/**
 * Función para deshabilitar el rate limiting temporalmente
 */
export function disableRateLimiting(): void {
  RATE_LIMITING_ENABLED = false;
}

/**
 * Middleware wrapper que aplica rate limiting solo si está habilitado
 */
export function conditionalRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Si el rate limiting está deshabilitado, pasar al siguiente middleware
  if (!RATE_LIMITING_ENABLED) {
    next();
    return;
  }

  // Si está habilitado, aplicar rate limiting
  const { limitar_registro } = require("./rate-limiter");
  limitar_registro(req, res, next);
}
