import { Request, Response } from "express";
import { loggerService } from "../../services/logging/logger.service";
import {
  wallet_login_request_schema,
  wallet_login_response_schema,
} from "./wallet-auth.schema";
import { verify_wallet_signature } from "./wallet-signature.service";
import { validate_challenge } from "./wallet-signature.service";
import { get_or_create_user } from "./user-management.service";
import { create_jwt_token } from "./jwt.service";
import {
  InvalidSignatureError,
  ChallengeExpiredError,
  ValidationError,
  UserNotFoundError,
  AuthServerError,
  is_wallet_auth_error,
} from "./errors";

/**
 * Handler para POST /api/v1/auth/login-wallet
 * Verifica la firma del usuario y crea una sesión
 *
 * Flujo:
 * 1. Validar entrada (public_key, message, signature)
 * 2. Validar challenge (no expirado, válido)
 * 3. Verificar firma (Ed25519)
 * 4. Obtener o crear usuario
 * 5. Crear JWT token
 * 6. Retornar respuesta
 */
export const login_wallet_handler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const request_id =
    (req as any).requestId || loggerService.generateRequestId();

  try {
    // PASO 1: Validar entrada
    let input;
    try {
      input = wallet_login_request_schema.parse(req.body);
    } catch (error) {
      throw new ValidationError(
        error instanceof Error ? error.message : "Invalid request body",
      );
    }

    // PASO 2: Validar challenge
    let challenge_validation;
    try {
      challenge_validation = await validate_challenge({
        public_key: input.public_key,
        message: input.message,
      });
    } catch (error) {
      if (is_wallet_auth_error(error)) {
        throw error;
      }
      throw new ChallengeExpiredError("Failed to validate challenge");
    }

    if (!challenge_validation.is_valid) {
      throw new ChallengeExpiredError(
        challenge_validation.error || "Invalid or expired challenge",
      );
    }

    // PASO 3: Verificar firma
    let signature_verification;
    try {
      signature_verification = await verify_wallet_signature({
        public_key: input.public_key,
        message: input.message,
        signature: input.signature,
      });
    } catch (error) {
      if (is_wallet_auth_error(error)) {
        throw error;
      }
      throw new InvalidSignatureError("Failed to verify signature");
    }

    if (!signature_verification.is_valid) {
      throw new InvalidSignatureError(
        signature_verification.error || "Signature verification failed",
      );
    }

    // PASO 4: Obtener o crear usuario
    let user;
    try {
      user = await get_or_create_user({
        public_key: input.public_key,
      });
    } catch (error) {
      if (is_wallet_auth_error(error)) {
        throw error;
      }
      throw new UserNotFoundError("Failed to get or create user");
    }

    if (!user) {
      throw new UserNotFoundError("User not found or could not be created");
    }

    // PASO 5: Crear JWT token
    let token_result;
    try {
      token_result = create_jwt_token({
        user_id: user.id,
        email: user.email,
        public_key: input.public_key,
        is_admin: user.is_admin || false,
      });
    } catch (error) {
      throw new AuthServerError("Failed to create authentication token");
    }

    // PASO 6: Validar y retornar respuesta
    let response;
    try {
      response = wallet_login_response_schema.parse({
        token: token_result.token,
        expires_in: token_result.expires_in,
        user: {
          id: user.id,
          email: user.email,
          is_admin: user.is_admin || false,
          created_at: user.created_at,
        },
      });
    } catch (error) {
      throw new AuthServerError(
        error instanceof Error ? error.message : "Invalid response format",
      );
    }

    loggerService.logInfo("Usuario autenticado por wallet", {
      context: "login_wallet_handler",
      request_id,
      user_id: user.id,
      email: user.email,
      public_key: input.public_key.substring(0, 8) + "...",
    });

    res.status(200).json({
      success: true,
      data: response,
      request_id,
    });
  } catch (error) {
    loggerService.logError(error as Error, {
      context: "login_wallet_handler",
      request_id,
      error_type: is_wallet_auth_error(error) ? "WalletAuthError" : "Unknown",
    });

    let status_code = 500;
    let error_code = "INTERNAL_SERVER_ERROR";
    let error_message = "Failed to authenticate with wallet";

    if (error instanceof ValidationError) {
      status_code = 400;
      error_code = "VALIDATION_ERROR";
      error_message = error.message;
    } else if (error instanceof ChallengeExpiredError) {
      status_code = 401;
      error_code = "CHALLENGE_EXPIRED";
      error_message = error.message;
    } else if (error instanceof InvalidSignatureError) {
      status_code = 401;
      error_code = "INVALID_SIGNATURE";
      error_message = error.message;
    } else if (error instanceof UserNotFoundError) {
      status_code = 404;
      error_code = "USER_NOT_FOUND";
      error_message = error.message;
    } else if (is_wallet_auth_error(error)) {
      status_code = 400;
      error_code = error.name;
      error_message = error.message;
    }

    res.status(status_code).json({
      success: false,
      error: {
        code: error_code,
        message: error_message,
        details:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      },
      request_id,
    });
  }
};
