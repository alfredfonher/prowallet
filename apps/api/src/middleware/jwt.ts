import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { loggerService } from "../services/logging";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

/**
 * Middleware para validar JWT token
 * Extrae el token del header Authorization: Bearer <token>
 * Si es válido, lo agrega a req.token y req.user
 */
export function validateJWT(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: "No se proporcionó token",
        code: 401,
      });
      return;
    }

    const token = authHeader.substring(7); // "Bearer ".length = 7

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      (req as any).token = token;
      (req as any).user = decoded;
      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        error: "Token inválido o expirado",
        code: 401,
      });
    }
  } catch (error) {
    loggerService.logError(error as Error, {
      context: "JWT Middleware",
    });

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      code: 500,
    });
  }
}

/**
 * Middleware opcional para JWT
 * No falla si no hay token, pero lo valida si existe
 */
export function validateJWTOptional(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);

      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        (req as any).token = token;
        (req as any).user = decoded;
      } catch (error) {
        // Token inválido pero no fallar - usuario anónimo
        loggerService.logInfo("Token inválido pero continuando como anónimo", {
          context: "JWT Optional Middleware",
        });
      }
    }

    next();
  } catch (error) {
    loggerService.logError(error as Error, {
      context: "JWT Optional Middleware",
    });
    next(); // Continuar igual
  }
}

/**
 * Middleware para validar que el usuario sea administrador
 * Requiere JWT válido y isAdmin=true
 */
export function validateAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const user = (req as any).user as any;
    if (!user || !user.isAdmin) {
      res.status(403).json({
        success: false,
        error: "Se requieren privilegios de administrador",
        code: 403,
      });
      return;
    }
    next();
  } catch (error) {
    loggerService.logError(error as Error, {
      context: "Admin Validation Middleware",
    });
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      code: 500,
    });
  }
}
