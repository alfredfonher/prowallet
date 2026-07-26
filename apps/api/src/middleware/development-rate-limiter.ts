import { Request, Response } from "express";

/**
 * Middleware de Rate Limiting para desarrollo
 * DESHABILITADO por defecto para permitir testing sin límites
 */
export const disabledForDevelopment = async (
  req: Request,
  res: Response,
  next: any,
): Promise<void> => {
  // Añadir headers CORS para evitar problemas de bloqueos
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );

  next();
};

/**
 * Middleware para aplicar el rate limitador solo si está habilitado
 * Si RATE_LIMIT_ENABLED=false, simplemente pasa al siguiente middleware
 */
export const conditionalRateLimit = (rateLimiter: any): any => {
  // Si rate limiting está deshabilitado, simplemente pasa
  if (
    !process.env.RATE_LIMIT_ENABLED ||
    process.env.RATE_LIMIT_ENABLED === "false"
  ) {
    return (req: any, res: any, next: any) => next();
  }

  // Aplicar el rate limiter
  return rateLimiter;
};

export default disabledForDevelopment;
