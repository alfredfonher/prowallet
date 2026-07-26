import * as jwt from "jsonwebtoken";
import { loggerService } from "../../services/logging/logger.service";
import { getRequiredEnvVar } from "../../utils/env";
import { JWTError } from "./errors";

export interface CreateTokenInput {
  user_id: number;
  email: string;
  public_key: string;
  is_admin: boolean;
}

export interface CreateTokenResult {
  token: string;
  expires_in: string;
}

export interface DecodedToken {
  user_id: number;
  email: string;
  public_key: string;
  is_admin: boolean;
  iat: number;
  exp?: number;
}

const JWT_SECRET = getRequiredEnvVar("JWT_SECRET");
const TOKEN_EXPIRY = "24h";

/**
 * Crea un JWT token para el usuario autenticado
 */
export const create_jwt_token = (
  input: CreateTokenInput,
): CreateTokenResult => {
  try {
    const token = jwt.sign(
      {
        user_id: input.user_id,
        username: input.email,
        public_key: input.public_key,
        is_admin: input.is_admin,
        iat: Math.floor(Date.now() / 1000),
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY },
    );

    return {
      token,
      expires_in: TOKEN_EXPIRY,
    };
  } catch (error) {
    loggerService.logError(error as Error, {
      context: "create_jwt_token",
      username: input.email,
    });
    throw new JWTError("Failed to create token");
  }
};

/**
 * Verifica y decodifica un JWT token
 */
export const verify_jwt_token = (token: string): DecodedToken => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new JWTError("Token has expired");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new JWTError("Invalid token");
    }
    throw new JWTError("Failed to verify token");
  }
};

/**
 * Decodifica un JWT token SIN verificar la firma
 * Útil para extraer información sin validación
 */
export const decode_jwt_token = (token: string): DecodedToken | null => {
  try {
    const decoded = jwt.decode(token) as DecodedToken | null;
    return decoded;
  } catch (error) {
    loggerService.logError(error as Error, {
      context: "decode_jwt_token",
    });
    return null;
  }
};

/**
 * Obtiene la fecha de expiración de un token
 */
export const get_token_expiry = (token: string): number | null => {
  const decoded = decode_jwt_token(token);
  return decoded?.exp ?? null;
};

/**
 * Comprueba si un token está expirado
 */
export const is_token_expired = (token: string): boolean => {
  const expiry = get_token_expiry(token);
  if (!expiry) return true;
  return Math.floor(Date.now() / 1000) >= expiry;
};
