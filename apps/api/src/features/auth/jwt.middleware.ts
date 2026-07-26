import { Request, Response, NextFunction } from "express";
import { verify_jwt_token, decode_jwt_token } from "./jwt.service";
import { AuthServerError, JWTError } from "./errors";

export interface AuthRequest extends Request {
  user?: {
    user_id: number;
    email: string;
    public_key: string;
    is_admin: boolean;
  };
}

/**
 * Middleware para verificar JWT token en Authorization header
 */
export const verify_auth_middleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const auth_header = req.headers.authorization;

    if (!auth_header || !auth_header.startsWith("Bearer ")) {
      res.status(401).json({
        error: "Missing or invalid authorization header",
        code: "MISSING_AUTH_HEADER",
      });
      return;
    }

    const token = auth_header.substring(7);

    try {
      const decoded = verify_jwt_token(token);
      req.user = {
        user_id: decoded.user_id,
        email: decoded.email,
        public_key: decoded.public_key,
        is_admin: decoded.is_admin,
      };
      next();
    } catch (error) {
      if (error instanceof JWTError) {
        res.status(401).json({
          error: error.message,
          code: "INVALID_TOKEN",
        });
      } else {
        res.status(401).json({
          error: "Token verification failed",
          code: "TOKEN_VERIFICATION_FAILED",
        });
      }
    }
  } catch (error) {
    res.status(500).json({
      error: "Authentication middleware error",
      code: "AUTH_MIDDLEWARE_ERROR",
    });
  }
};

/**
 * Middleware para verificar que el usuario sea admin
 */
export const verify_admin_middleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    res.status(401).json({
      error: "User not authenticated",
      code: "NOT_AUTHENTICATED",
    });
    return;
  }

  if (!req.user.is_admin) {
    res.status(403).json({
      error: "Insufficient permissions",
      code: "FORBIDDEN",
    });
    return;
  }

  next();
};

/**
 * Extrae el token del Authorization header sin verificar
 */
export const extract_token_from_header = (req: Request): string | null => {
  const auth_header = req.headers.authorization;

  if (!auth_header || !auth_header.startsWith("Bearer ")) {
    return null;
  }

  return auth_header.substring(7);
};

/**
 * Obtiene el usuario del token sin verificar
 */
export const get_user_from_token = (token: string) => {
  const decoded = decode_jwt_token(token);

  if (!decoded) {
    return null;
  }

  return {
    user_id: decoded.user_id,
    email: decoded.email,
    public_key: decoded.public_key,
    is_admin: decoded.is_admin,
  };
};
