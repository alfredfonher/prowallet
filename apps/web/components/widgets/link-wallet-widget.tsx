"use client";

import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import Swal from "sweetalert2";
import { use_link_wallet } from "@/hooks/use-link-wallet";
import { authService } from "@/lib/auth-service";

interface LinkWalletWidgetProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

/**
 * Widget para vincular wallet Solana a la cuenta del usuario
 *
 * Flujo:
 * 1. Usuario hace clic en "Vincular Wallet"
 * 2. Se abre el selector de wallets
 * 3. Usuario selecciona su wallet
 * 4. Se solicita firma para vincular
 * 5. Wallet vinculado a la cuenta
 */
export const LinkWalletWidget: React.FC<LinkWalletWidgetProps> = ({
  onSuccess,
  onError,
}) => {
  const { publicKey, signMessage, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { link_wallet, is_loading, progress, reset } = use_link_wallet();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handle_link_wallet = async () => {
    if (!publicKey || !signMessage) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Por favor conecta tu wallet primero",
      });
      return;
    }

    try {
      const user = await link_wallet(
        publicKey.toString(),
        async (message: string) => {
          const encoded = new TextEncoder().encode(message);
          const signature = await signMessage(encoded);
          return Buffer.from(signature).toString("base64");
        },
      );

      if (user) {
        Swal.fire({
          icon: "success",
          title: "¡Éxito!",
          text: `Wallet vinculada: ${publicKey.toString().slice(0, 8)}...`,
        });

        // Recargar datos del usuario
        await authService.getMe();
        onSuccess?.();
        setIsModalOpen(false);
        reset();
      } else {
        const error_msg = progress.error || "Error desconocido";
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error_msg,
        });
        onError?.(error_msg);
      }
    } catch (error) {
      const error_msg =
        error instanceof Error ? error.message : "Error desconocido";
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error_msg,
      });
      onError?.(error_msg);
    }
  };

  const handle_open_wallet_selector = () => {
    if (!connected) {
      setVisible(true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Botón principal para abrir modal */}
      {!isModalOpen && (
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Vincular Wallet
        </button>
      )}

      {/* Modal con flujo de vinculación */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Vincular Wallet</h2>

            {/* Mostrar progreso */}
            {is_loading && (
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin h-5 w-5 text-blue-600" />
                  <span className="text-sm text-gray-700">
                    {progress.message}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${progress.progress_percent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Mostrar error */}
            {progress.stage === "error" && (
              <div className="p-3 bg-red-100 border border-red-400 rounded-lg">
                <p className="text-sm text-red-700">{progress.error}</p>
              </div>
            )}

            {/* Mostrar éxito */}
            {progress.stage === "complete" && (
              <div className="p-3 bg-green-100 border border-green-400 rounded-lg">
                <p className="text-sm text-green-700">{progress.message}</p>
              </div>
            )}

            {/* Pasos */}
            {!is_loading && progress.stage !== "complete" && (
              <div className="space-y-3">
                {/* Paso 1: Conectar wallet */}
                <div className="p-3 border border-gray-300 rounded-lg">
                  <p className="text-sm font-medium text-gray-700">
                    1. Conectar Wallet
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {connected ? (
                      <>✓ Conectado: {publicKey?.toString().slice(0, 8)}...</>
                    ) : (
                      "Aún no conectado"
                    )}
                  </p>
                  {!connected && (
                    <button
                      onClick={handle_open_wallet_selector}
                      className="mt-2 px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                    >
                      Seleccionar Wallet
                    </button>
                  )}
                </div>

                {/* Paso 2: Vincular */}
                <div className="p-3 border border-gray-300 rounded-lg">
                  <p className="text-sm font-medium text-gray-700">
                    2. Firmar Vinculación
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Se te pedirá firmar un mensaje con tu wallet
                  </p>
                  <button
                    onClick={handle_link_wallet}
                    disabled={!connected || is_loading}
                    className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Vincular Wallet
                  </button>
                </div>
              </div>
            )}

            {/* Botón cerrar modal */}
            <button
              onClick={() => {
                setIsModalOpen(false);
                reset();
              }}
              disabled={is_loading}
              className="w-full px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
