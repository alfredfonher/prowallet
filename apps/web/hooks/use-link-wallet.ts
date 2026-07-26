import { useState, useCallback } from "react";
import { authService, AuthUser } from "@/lib/auth-service";

/**
 * Estado del proceso de vinculación de wallet
 */
export interface LinkWalletProgress {
  stage:
    | "idle"
    | "requesting-challenge"
    | "signing"
    | "submitting"
    | "complete"
    | "error";
  message: string;
  progress_percent: number;
  error?: string;
}

/**
 * Resultado del hook use_link_wallet
 */
export interface UseLinkWalletResult {
  is_loading: boolean;
  progress: LinkWalletProgress;
  link_wallet: (
    publicKey: string,
    signMessage: (msg: string) => Promise<string>,
  ) => Promise<AuthUser | null>;
  reset: () => void;
}

/**
 * Hook para vincular una wallet Solana a la cuenta del usuario
 * - Solicita challenge al servidor
 * - Obtiene firma del wallet
 * - Vincula la wallet a la cuenta
 */
export const use_link_wallet = (): UseLinkWalletResult => {
  const [is_loading, set_is_loading] = useState(false);
  const [progress, set_progress] = useState<LinkWalletProgress>({
    stage: "idle",
    message: "",
    progress_percent: 0,
  });

  const update_progress = useCallback(
    (
      stage: LinkWalletProgress["stage"],
      message: string,
      progress_percent: number,
      error?: string,
    ) => {
      set_progress({
        stage,
        message,
        progress_percent,
        error,
      });
    },
    [],
  );

  const reset = useCallback(() => {
    set_is_loading(false);
    update_progress("idle", "", 0);
  }, [update_progress]);

  const link_wallet = useCallback(
    async (
      publicKey: string,
      signMessage: (msg: string) => Promise<string>,
    ): Promise<AuthUser | null> => {
      set_is_loading(true);

      try {
        // Paso 1: Solicitar challenge
        update_progress("requesting-challenge", "Solicitando desafío...", 20);

        const challengeResponse = await authService.requestChallenge(publicKey);
        const { message } = challengeResponse;

        // Paso 2: Solicitar firma del wallet
        update_progress(
          "signing",
          "Por favor, firma el mensaje en tu wallet...",
          40,
        );

        const signature = await signMessage(message);

        if (!signature) {
          throw new Error("No se pudo obtener la firma del wallet");
        }

        // Paso 3: Vincular wallet al servidor
        update_progress("submitting", "Vinculando wallet a tu cuenta...", 70);

        const user = await authService.linkWallet(
          publicKey,
          message,
          signature,
        );

        update_progress("complete", "¡Wallet vinculada exitosamente!", 100);

        set_is_loading(false);
        return user;
      } catch (error) {
        const error_message =
          error instanceof Error ? error.message : "Error al vincular wallet";
        update_progress("error", "", 0, error_message);
        set_is_loading(false);
        console.error("Link wallet error:", error);
        return null;
      }
    },
    [update_progress],
  );

  return {
    is_loading,
    progress,
    link_wallet,
    reset,
  };
};
