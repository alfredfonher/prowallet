import rateLimit from "express-rate-limit";

/**
 * Rate Limiting Middleware
 * Implementa límites de tasa para diferentes endpoints
 * Utiliza almacenamiento en memoria (store predeterminado de express-rate-limit)
 *
 * En desarrollo (NODE_ENV=development), el rate limiting está DESHABILITADO
 * para permitir testing sin restricciones.
 *
 * Para producción con múltiples instancias, usar RedisStore:
 * import RedisStore from "rate-limit-redis";
 * import redis from "redis";
 * const redisClient = redis.createClient();
 */

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

// Middleware que pasa sin hacer nada en desarrollo
const noOpMiddleware = (_req: any, _res: any, next: any) => next();

/**
 * Limitador para registro de usuarios (5 intentos por 2 horas)
 * Previene abuso de spam en registro
 * DESHABILITADO en desarrollo
 */
export const limitar_registro = IS_DEVELOPMENT
  ? noOpMiddleware
  : rateLimit({
      windowMs: 2 * 60 * 60 * 1000, // 2 horas
      max: 5, // máximo 5 registros por IP en 2 horas
      message: {
        success: false,
        error: "Demasiados intentos de registro. Por favor, intenta más tarde.",
      },
      standardHeaders: true, // Devuelve info de limite en headers `RateLimit-*`
      legacyHeaders: false, // Desactiva headers `X-RateLimit-*`
      keyGenerator: (req) => {
        // Usa la IP real incluso detrás de proxies
        return (
          (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
          req.socket.remoteAddress ||
          "unknown"
        );
      },
      skip: (req) => {
        // No aplicar rate limiting a requests de salud
        return req.path === "/health";
      },
    });

/**
 * Limitador para login (10 intentos por 15 minutos)
 * Previene ataques de fuerza bruta
 * DESHABILITADO en desarrollo
 */
export const limitar_login = IS_DEVELOPMENT
  ? noOpMiddleware
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 10, // máximo 10 intentos de login por IP en 15 minutos
      message: {
        success: false,
        error: "Demasiados intentos de login. Por favor, intenta más tarde.",
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        return (
          (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
          req.socket.remoteAddress ||
          "unknown"
        );
      },
    });

/**
 * Limitador para recuperación de contraseña (5 intentos por hora)
 * Previene abuso de spam en emails
 * DESHABILITADO en desarrollo
 */
export const limitar_recuperar_password = IS_DEVELOPMENT
  ? noOpMiddleware
  : rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hora
      max: 5, // máximo 5 intentos por IP en 1 hora
      message: {
        success: false,
        error:
          "Demasiados intentos de recuperación de contraseña. Por favor, intenta más tarde.",
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        return (
          (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
          req.socket.remoteAddress ||
          "unknown"
        );
      },
    });

/**
 * Limitador para verificación de email (10 intentos por hora)
 * Permite reintentos pero previene spam excesivo
 * DESHABILITADO en desarrollo
 */
export const limitar_verificar_email = IS_DEVELOPMENT
  ? noOpMiddleware
  : rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hora
      max: 10, // máximo 10 intentos en 1 hora
      message: {
        success: false,
        error:
          "Demasiados intentos de verificación. Por favor, intenta más tarde.",
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        return (
          (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
          req.socket.remoteAddress ||
          "unknown"
        );
      },
    });

/**
 * Limitador general para API (200 requests por minuto)
 * Aplica a todos los endpoints que no tienen limitador específico
 * DESHABILITADO en desarrollo
 */
export const limitar_api = IS_DEVELOPMENT
  ? noOpMiddleware
  : rateLimit({
      windowMs: 60 * 1000, // 1 minuto
      max: 200, // máximo 200 requests por IP en 1 minuto
      message: {
        success: false,
        error: "Demasiadas solicitudes. Por favor, intenta más tarde.",
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        return (
          (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
          req.socket.remoteAddress ||
          "unknown"
        );
      },
    });
