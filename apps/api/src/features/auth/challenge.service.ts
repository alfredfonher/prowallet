import { authChallengeService } from "../../services/auth-challenge.service";
import { loggerService } from "../../services/logging/logger.service";

export interface CreateChallengeInput {
  public_key: string;
}

export interface CreateChallengeResult {
  nonce: string;
  message: string;
  expires_at: number;
}

/**
 * Crea un challenge para que el usuario lo firme
 * El challenge es un mensaje temporal con un nonce único
 */
export const create_wallet_challenge = async (
  input: CreateChallengeInput,
): Promise<CreateChallengeResult> => {
  try {
    const challenge = await authChallengeService.createChallenge(
      input.public_key,
    );

    loggerService.logInfo("Challenge creado para wallet", {
      context: "create_wallet_challenge",
      public_key: input.public_key.substring(0, 8) + "...",
      nonce: challenge.nonce.substring(0, 8) + "...",
    });

    return {
      nonce: challenge.nonce,
      message: challenge.message,
      expires_at: challenge.expiresAt,
    };
  } catch (error) {
    loggerService.logError(error as Error, {
      context: "create_wallet_challenge",
      public_key: input.public_key.substring(0, 8) + "...",
    });
    throw error;
  }
};
