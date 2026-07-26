import { useCallback, useState } from "react";
import { detect_wallet, disconnect_wallet } from "./wallet-detection.service";
import {
  execute_wallet_login_flow,
  WalletAuthError,
} from "./wallet-login.service";
import { AuthUser } from "./wallet-auth.schema";

export interface UseWalletLoginState {
  is_loading: boolean;
  error: string | null;
  user: AuthUser | null;
}

export interface UseWalletLoginResult {
  is_loading: boolean;
  error: string | null;
  user: AuthUser | null;
  connect_and_login: () => Promise<{ token: string; user: AuthUser }>;
  clear_error: () => void;
}

/**
 * Hook para autenticación con wallet
 *
 * Uso:
 * ```tsx
 * const { is_loading, error, user, connect_and_login } = useWalletLogin();
 *
 * const handle_connect = async () => {
 *     const { token, user } = await connect_and_login();
 *     // Guardar token y user en contexto
 * };
 * ```
 */
export const use_wallet_login = (): UseWalletLoginResult => {
  const [state, set_state] = useState<UseWalletLoginState>({
    is_loading: false,
    error: null,
    user: null,
  });

  // Realiza el login completo
  const connect_and_login = useCallback(async () => {
    set_state({ is_loading: true, error: null, user: null });

    try {
      // PASO 1: Detectar wallet
      console.log(`🔍 Detecting wallet...`);
      const wallet_detection = await detect_wallet();
      console.log(
        `✓ ${wallet_detection.name} detected: ${wallet_detection.public_key}`,
      );

      // PASO 2: Ejecutar flujo de login
      const login_result = await execute_wallet_login_flow(
        wallet_detection.provider,
        wallet_detection.public_key,
      );

      set_state({
        is_loading: false,
        error: null,
        user: login_result.user,
      });

      return login_result;
    } catch (error) {
      const error_message =
        error instanceof WalletAuthError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unknown error occurred";

      console.error(`❌ Wallet login failed:`, error);

      set_state({
        is_loading: false,
        error: error_message,
        user: null,
      });

      throw error;
    }
  }, []);

  const clear_error = useCallback(() => {
    set_state((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    is_loading: state.is_loading,
    error: state.error,
    user: state.user,
    connect_and_login,
    clear_error,
  };
};
