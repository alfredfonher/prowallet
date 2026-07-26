import { PublicKey } from "@solana/web3.js";
import * as bs58 from "bs58";
import * as nacl from "tweetnacl";
import { authChallengeService } from "../../services/auth-challenge.service";
import { loggerService } from "../../services/logging/logger.service";

export interface VerifySignatureInput {
  public_key: string;
  message: string;
  signature: string;
}

export interface VerifySignatureResult {
  is_valid: boolean;
  error?: string;
}

/**
 * Verifica la firma de un mensaje usando la clave pública del usuario
 * Implementa: Ed25519 signature verification (estándar de Solana)
 */
export const verify_wallet_signature = async (
  input: VerifySignatureInput,
): Promise<VerifySignatureResult> => {
  try {
    // Decodificar firma y clave pública desde base58
    const sig_bytes = bs58.decode(input.signature);
    const pub_bytes = bs58.decode(input.public_key);

    // Convertir mensaje a bytes (UTF-8)
    const msg_bytes = new TextEncoder().encode(input.message);

    // Verificar firma usando tweetnacl (Ed25519)
    const is_valid = nacl.sign.detached.verify(msg_bytes, sig_bytes, pub_bytes);

    if (!is_valid) {
      return {
        is_valid: false,
        error: "Signature verification failed",
      };
    }

    return { is_valid: true };
  } catch (error) {
    const error_message =
      error instanceof Error ? error.message : "Unknown error";

    loggerService.logError(error as Error, {
      context: "verify_wallet_signature",
      public_key: input.public_key.substring(0, 8) + "...",
    });

    return {
      is_valid: false,
      error: `Signature verification error: ${error_message}`,
    };
  }
};

export interface ValidateChallengeInput {
  public_key: string;
  message: string;
}

export interface ValidateChallengeResult {
  is_valid: boolean;
  error?: string;
}

/**
 * Valida que el challenge (challenge message) sea válido y no haya expirado
 * El challenge se verificó en el paso anterior (verifyAndConsume)
 */
export const validate_challenge = async (
  input: ValidateChallengeInput,
): Promise<ValidateChallengeResult> => {
  try {
    const { public_key, message } = input;

    // Verificar y consumir el challenge
    const challenge_check = await authChallengeService.verifyAndConsume(
      public_key,
      { message },
    );

    if (!challenge_check.ok) {
      return {
        is_valid: false,
        error: `Challenge validation failed: ${challenge_check.reason}`,
      };
    }

    return { is_valid: true };
  } catch (error) {
    const error_message =
      error instanceof Error ? error.message : "Unknown error";

    loggerService.logError(error as Error, {
      context: "validate_challenge",
      public_key: input.public_key.substring(0, 8) + "...",
    });

    return {
      is_valid: false,
      error: `Challenge validation error: ${error_message}`,
    };
  }
};
