import { apiClient } from "./api-client";
import {
  challenge_response_schema,
  wallet_login_response_schema,
  AuthUser,
} from "./wallet-auth.schema";
import { sign_message, WalletProvider } from "./wallet-detection.service";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const SIGN_TIMEOUT_MS = 15000;

/**
 * Error clase para manejar errores de autenticación con wallet
 */
export class WalletAuthError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "WalletAuthError";
  }
}

/**
 * Solicita un challenge (mensaje para firmar) del servidor
 */
export const request_challenge_from_api = async (
  public_key: string,
): Promise<{ nonce?: string; message?: string; expires_at?: number }> => {
  try {
    const response = await apiClient.post<any>("/auth/request-challenge", {
      public_key,
    });

    // Validar respuesta con Zod
    const validated = challenge_response_schema.parse(response);
    return validated.data;
  } catch (error) {
    const error_message =
      error instanceof Error ? error.message : "Unknown error";
    throw new WalletAuthError(
      "CHALLENGE_REQUEST_FAILED",
      `Failed to request challenge: ${error_message}`,
    );
  }
};

/**
 * Completa el login enviando la firma al servidor
 */
export const complete_wallet_login_on_api = async (
  public_key: string,
  message: string,
  signature: string,
): Promise<{ token: string; user: AuthUser }> => {
  try {
    const response = await apiClient.post<any>("/auth/login-wallet", {
      public_key,
      message,
      signature,
    });

    // Validar respuesta con Zod
    const validated = wallet_login_response_schema.parse(response);
    return {
      token: validated.data.token,
      user: validated.data.user,
    };
  } catch (error) {
    const error_message =
      error instanceof Error ? error.message : "Unknown error";
    throw new WalletAuthError(
      "LOGIN_FAILED",
      `Wallet login failed: ${error_message}`,
    );
  }
};

/**
 * Ejecuta el flujo completo de autenticación con wallet:
 * 1. Request challenge
 * 2. Firmar mensaje
 * 3. Completar login
 *
 * Con retry logic para manejar fallos temporales
 */
export const execute_wallet_login_flow = async (
  provider: WalletProvider,
  public_key: string,
): Promise<{ token: string; user: AuthUser }> => {
  // PASO 1: Solicitar challenge
  console.log(`📝 Requesting challenge for wallet: ${public_key}`);

  let challenge;
  try {
    challenge = await request_challenge_from_api(public_key);
  } catch (error) {
    throw error; // Propagate error sin retry
  }

  // PASO 2: Firmar mensaje
  console.log(`✍️ Asking wallet to sign message...`);

  let signature: string;
  try {
    // Crear promise que timeout después de SIGN_TIMEOUT_MS
    const sign_promise = sign_message(provider, challenge.message);
    const timeout_promise = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new WalletAuthError(
              "SIGN_TIMEOUT",
              "User did not sign message within timeout",
            ),
          ),
        SIGN_TIMEOUT_MS,
      ),
    );

    signature = await Promise.race([sign_promise, timeout_promise]);
  } catch (error) {
    throw new WalletAuthError(
      "SIGN_FAILED",
      error instanceof Error ? error.message : "Failed to sign message",
    );
  }

  // PASO 3: Completar login con retry logic
  console.log(`📤 Sending signature to backend...`);

  let last_error: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await complete_wallet_login_on_api(
        public_key,
        challenge.message,
        signature,
      );
      console.log(`✅ Wallet login successful on attempt ${attempt}`);
      return result;
    } catch (error) {
      last_error = error instanceof Error ? error : new Error(String(error));

      if (attempt < MAX_RETRIES) {
        console.warn(
          `⚠️ Login attempt ${attempt}/${MAX_RETRIES} failed, retrying...`,
          (error as any)?.code,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY_MS * attempt),
        ); // Exponential backoff
      } else {
        console.error(
          `❌ Login failed after ${MAX_RETRIES} attempts`,
          last_error,
        );
      }
    }
  }

  throw last_error || new Error("Wallet login failed");
};
