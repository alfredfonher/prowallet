import { Request, Response } from "express";
import { create_wallet_challenge } from "./challenge.service";
import {
  request_challenge_schema,
  challenge_response_schema,
} from "./wallet-auth.schema";
import { loggerService } from "../../services/logging/logger.service";
import {
  ChallengeError,
  ValidationError,
  AuthServerError,
  is_wallet_auth_error,
} from "./errors";

/**
 * Handler para POST /api/v1/auth/request-challenge
 * Crea un challenge que el usuario debe firmar
 */
export const request_challenge_handler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const request_id =
    (req as any).requestId || loggerService.generateRequestId();

  try {
    // Validar entrada con Zod
    let input;
    try {
      input = request_challenge_schema.parse(req.body);
    } catch (error) {
      throw new ValidationError(
        error instanceof Error ? error.message : "Invalid request body",
      );
    }

    // Crear challenge
    let challenge;
    try {
      challenge = await create_wallet_challenge({
        public_key: input.public_key,
      });
    } catch (error) {
      if (is_wallet_auth_error(error)) {
        throw error;
      }
      throw new ChallengeError("Failed to create challenge");
    }

    // Validar respuesta
    let response;
    try {
      response = challenge_response_schema.parse(challenge);
    } catch (error) {
      throw new AuthServerError("Invalid challenge response format");
    }

    res.status(200).json({
      success: true,
      data: response,
      request_id,
    });
  } catch (error) {
    loggerService.logError(error as Error, {
      context: "request_challenge_handler",
      request_id,
      error_type: is_wallet_auth_error(error) ? "WalletAuthError" : "Unknown",
    });

    let status_code = 500;
    let error_code = "INTERNAL_SERVER_ERROR";
    let error_message = "Failed to create challenge";

    if (error instanceof ValidationError) {
      status_code = 400;
      error_code = "VALIDATION_ERROR";
      error_message = error.message;
    } else if (error instanceof ChallengeError) {
      status_code = 400;
      error_code = "CHALLENGE_ERROR";
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
