import { Request, Response, NextFunction } from "express";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import { loggerService } from "../services/logging/logger.service";

/**
 * Middleware para sanitizar respuestas API y prevenir XSS
 */

// Función para escapar caracteres HTML peligrosos
function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== "string") {
    return unsafe;
  }

  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\//g, "&#x2F;");
}

// Función para sanitizar objetos recursivamente
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    return escapeHtml(obj);
  }

  if (typeof obj === "number" || typeof obj === "boolean") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (typeof obj === "object") {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        // Sanitizar claves también para prevenir key injection
        const sanitizedKey = escapeHtml(key);
        sanitized[sanitizedKey] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

// Función para sanitizar respuestas de StatusFlow
function sanitizeStatusFlowResponse(data: any): any {
  if (!data) return data;

  // Si es una respuesta StatusFlow, sanitizar el campo extra
  if (data.code !== undefined && data.lang !== undefined) {
    return {
      ...data,
      extra: data.extra ? sanitizeObject(data.extra) : undefined,
    };
  }

  // Para otros tipos de respuestas, sanitizar completamente
  return sanitizeObject(data);
}

/**
 * Middleware principal de sanitización de respuestas
 */
export function sanitizeResponse(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Guardar el método original res.json
  const originalJson = res.json.bind(res);

  // Sobrescribir res.json para sanitizar la respuesta
  res.json = function (data: any): Response<any, Record<string, any>> {
    try {
      // Sanitizar los datos de respuesta
      const sanitizedData = sanitizeStatusFlowResponse(data);

      // Log para debugging (solo en desarrollo)
      if (process.env.NODE_ENV === "development") {
        loggerService.logInfo("Response sanitized", {
          requestId: (req as any).requestId,
          endpoint: req.path,
          method: req.method,
        });
      }

      // Llamar al método original con los datos sanitizados
      return originalJson(sanitizedData);
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "sanitizeResponse",
        requestId: (req as any).requestId,
        endpoint: req.path,
        method: req.method,
      });

      // En caso de error, devolver respuesta de error segura
      return originalJson(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: {
            error: "Internal server error",
            requestId: (req as any).requestId,
          },
        }),
      );
    }
  };

  next();
}

/**
 * Middleware para sanitizar específicamente errores
 */
export function sanitizeErrorResponse(
  error: Error,
  requestId: string,
  endpoint: string,
): any {
  return StatusFlow({
    code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
    lang: "es",
    extra: {
      error: escapeHtml(error.message),
      requestId: escapeHtml(requestId),
      endpoint: escapeHtml(endpoint),
    },
  });
}

/**
 * Función helper para sanitizar input de usuario (uso adicional)
 */
export function sanitizeInput(input: any): any {
  return sanitizeObject(input);
}

/**
 * Validación adicional para prevenir content type injection
 */
export function validateContentType(
  req: Request,
  res: Response,
  next: NextFunction,
): Response | void {
  const contentType = req.get("Content-Type");

  // Para endpoints que aceptan JSON
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    if (!contentType || !contentType.includes("application/json")) {
      res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Content-Type must be application/json",
          },
        }),
      );
      return;
    }
  }

  next();
}

/**
 * Middleware para remover headers peligrosos
 */
export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Headers de seguridad
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Content-Security-Policy", "default-src 'self'");

  next();
}
