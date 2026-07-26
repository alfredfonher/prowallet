import { useState, useCallback } from "react";

export interface UseWalletLoginOptions {
  max_retries?: number;
  timeout_ms?: number;
  retry_delay_ms?: number;
}

export interface WalletLoginProgress {
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

export interface UseWalletLoginResult {
  is_loading: boolean;
  progress: WalletLoginProgress;
  login_with_wallet: (wallet_name?: string) => Promise<string | null>;
  cancel: () => void;
}

/**
 * Hook mejorado para login con wallet
 * - Manejo de reintentos automáticos
 * - Control de timeouts
 * - Progreso del login
 * - Mejor manejo de errores
 */
export const use_wallet_login = (
  options: UseWalletLoginOptions = {},
): UseWalletLoginResult => {
  const max_retries = options.max_retries ?? 3;
  const timeout_ms = options.timeout_ms ?? 45000;
  const retry_delay_ms = options.retry_delay_ms ?? 1000;

  const [is_loading, set_is_loading] = useState(false);
  const [progress, set_progress] = useState<WalletLoginProgress>({
    stage: "idle",
    message: "",
    progress_percent: 0,
  });

  let abort_signal: AbortSignal | null = null;

  const update_progress = useCallback(
    (
      stage: WalletLoginProgress["stage"],
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

  const cancel = useCallback(() => {
    set_is_loading(false);
    update_progress("idle", "", 0);
  }, [update_progress]);

  const login_with_wallet = useCallback(
    async (wallet_name?: string): Promise<string | null> => {
      set_is_loading(true);
      let attempt = 0;

      while (attempt < max_retries) {
        try {
          abort_signal = new AbortController().signal;

          // Paso 1: Solicitar challenge
          update_progress(
            "requesting-challenge",
            "Solicitando challenge...",
            10,
          );

          const challenge_response = await fetch_with_timeout(
            "/api/v1/auth/request-challenge",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                public_key: wallet_name, // Obtener del wallet conectado
              }),
              signal: abort_signal,
            },
            timeout_ms,
          );

          if (!challenge_response.ok) {
            throw new Error(
              `Challenge request failed: ${challenge_response.status}`,
            );
          }

          const challenge_data = await challenge_response.json();
          update_progress(
            "signing",
            "Por favor, firma el mensaje en tu wallet...",
            30,
          );

          // Paso 2: Obtener firma del wallet (esto variaría según el wallet)
          const signature = await get_wallet_signature(
            challenge_data.data.message,
          );

          update_progress("submitting", "Verificando firma...", 60);

          // Paso 3: Enviar firma al servidor
          const login_response = await fetch_with_timeout(
            "/api/v1/auth/login-wallet",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                public_key: wallet_name,
                message: challenge_data.data.message,
                signature: signature,
              }),
              signal: abort_signal,
            },
            timeout_ms,
          );

          if (!login_response.ok) {
            const error_data = await login_response.json();
            throw new Error(
              error_data.error?.message ||
                `Login failed: ${login_response.status}`,
            );
          }

          const login_data = await login_response.json();
          update_progress("complete", "Login exitoso!", 100);

          set_is_loading(false);
          return login_data.data.token;
        } catch (error) {
          attempt++;

          if (attempt >= max_retries) {
            const error_message =
              error instanceof Error ? error.message : "Login failed";
            update_progress("error", "", 0, error_message);
            set_is_loading(false);
            console.error("Wallet login error:", {
              context: "use_wallet_login",
              attempt,
              max_retries,
              error: error instanceof Error ? error.message : String(error),
            });
            return null;
          }

          // Reintentar después del delay
          await sleep(retry_delay_ms);
        }
      }

      return null;
    },
    [max_retries, timeout_ms, retry_delay_ms, update_progress],
  );

  return {
    is_loading,
    progress,
    login_with_wallet,
    cancel,
  };
};

/**
 * Fetch con timeout
 */
async function fetch_with_timeout(
  url: string,
  options: RequestInit,
  timeout: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout_id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout_id);
    return response;
  } catch (error) {
    clearTimeout(timeout_id);
    throw error;
  }
}

/**
 * Obtener firma del wallet
 * Esto dependerá del wallet que estés usando
 */
async function get_wallet_signature(message: string): Promise<string> {
  // Implementar según el wallet que uses
  // Por ejemplo, con Phantom:
  // const provider = window.solana;
  // const signature = await provider.signMessage(message);
  throw new Error("get_wallet_signature not implemented");
}

/**
 * Helper para esperar
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
