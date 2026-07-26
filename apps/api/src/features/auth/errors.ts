/**
 * Custom error classes para autenticación con wallet
 * Siguiendo regla: "Prefer custom error classes"
 */

/**
 * Error base para todos los errores de autenticación con wallet
 */
export class WalletAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "WalletAuthError";
    Object.setPrototypeOf(this, WalletAuthError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
    };
  }
}

/**
 * Error cuando la firma de la wallet es inválida
 */
export class InvalidSignatureError extends WalletAuthError {
  constructor(reason?: string) {
    super(
      reason || "Invalid wallet signature. Please sign the message again.",
      "INVALID_SIGNATURE",
      401,
    );
    this.name = "InvalidSignatureError";
    Object.setPrototypeOf(this, InvalidSignatureError.prototype);
  }
}

/**
 * Error cuando el challenge ha expirado
 */
export class ChallengeExpiredError extends WalletAuthError {
  constructor(message?: string) {
    super(
      message || "Challenge expired. Please request a new one to continue.",
      "CHALLENGE_EXPIRED",
      401,
    );
    this.name = "ChallengeExpiredError";
    Object.setPrototypeOf(this, ChallengeExpiredError.prototype);
  }
}

/**
 * Error cuando el usuario no existe
 */
export class UserNotFoundError extends WalletAuthError {
  constructor(publicKey: string) {
    super(
      `No user found for wallet ${publicKey}. Create an account first.`,
      "USER_NOT_FOUND",
      404,
    );
    this.name = "UserNotFoundError";
    Object.setPrototypeOf(this, UserNotFoundError.prototype);
  }
}

/**
 * Error cuando la validación falla
 */
export class ValidationError extends WalletAuthError {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error cuando hay un problema con JWT
 */
export class JWTError extends WalletAuthError {
  constructor(message: string) {
    super(message, "JWT_ERROR", 401);
    this.name = "JWTError";
    Object.setPrototypeOf(this, JWTError.prototype);
  }
}

/**
 * Error cuando hay un problema con el challenge
 */
export class ChallengeError extends WalletAuthError {
  constructor(message: string, code: string = "CHALLENGE_ERROR") {
    super(message, code, 400);
    this.name = "ChallengeError";
    Object.setPrototypeOf(this, ChallengeError.prototype);
  }
}

/**
 * Error cuando hay un problema de servidor
 */
export class AuthServerError extends WalletAuthError {
  constructor(message: string = "Internal server error during authentication") {
    super(message, "AUTH_SERVER_ERROR", 500);
    this.name = "AuthServerError";
    Object.setPrototypeOf(this, AuthServerError.prototype);
  }
}

/**
 * Tipo para todos los errores de autenticación
 */
export type AuthErrorType =
  | WalletAuthError
  | InvalidSignatureError
  | ChallengeExpiredError
  | UserNotFoundError
  | ValidationError
  | JWTError
  | ChallengeError
  | AuthServerError;

/**
 * Type guard para verificar si es un WalletAuthError
 */
export function is_wallet_auth_error(error: unknown): error is WalletAuthError {
  return error instanceof WalletAuthError;
}

/**
 * Convertir error genérico a WalletAuthError
 */
export function to_wallet_auth_error(error: unknown): WalletAuthError {
  if (is_wallet_auth_error(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AuthServerError(error.message);
  }

  return new AuthServerError("Unknown error during authentication");
}
