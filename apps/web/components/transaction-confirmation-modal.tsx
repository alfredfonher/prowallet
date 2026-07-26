"use client";

import { useState, useEffect, useRef } from "react";
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/token-store";
import {
  PurchaseEvents,
  type PurchaseConfirmedDetail,
} from "@/lib/purchase-events";

interface TransactionConfirmationModalProps {
  isOpen: boolean;
  transactionType: "BUY" | "SELL" | "TRANSFER";
  tokenSymbol: string;
  tokenAmount: number;
  fiatAmount: number;
  fees: number;
  totalCost?: number; // Para BUY
  netReceived?: number; // Para SELL
  walletAddress: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function TransactionConfirmationModal({
  isOpen,
  transactionType,
  tokenSymbol,
  tokenAmount,
  fiatAmount,
  fees,
  totalCost,
  netReceived,
  walletAddress,
  onConfirm,
  onCancel,
}: TransactionConfirmationModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // ✅ NEW: Escuchar evento de confirmación exitosa
  useEffect(() => {
    if (!isOpen) return;

    console.log(
      "🎧 [TransactionConfirmationModal] Configurando listeners de eventos",
    );

    // Unsubscribir de cualquier listener anterior
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    // Suscribirse al evento de confirmación exitosa
    unsubscribeRef.current = PurchaseEvents.onConfirmed(
      (detail: PurchaseConfirmedDetail) => {
        console.log(
          "🎉 [TransactionConfirmationModal] PURCHASE_CONFIRMED RECIBIDO:",
          {
            transactionId: detail.transactionId,
            tokenAmount: detail.tokenAmount,
            mintSignature: detail.mintSignature
              ? detail.mintSignature.substring(0, 20) + "..."
              : undefined,
            timestamp: new Date(detail.timestamp).toISOString(),
          },
        );

        // Marcar modal como confirmado
        setConfirmed(true);

        // Cerrar después de mostrar el mensaje de éxito por 1.5 segundos
        timeoutRef.current = setTimeout(() => {
          console.log(
            "🔄 [TransactionConfirmationModal] Cerrando modal automáticamente...",
          );
          onCancel();
        }, 1500);
      },
    );

    console.log(
      "👂 [TransactionConfirmationModal] Listener PURCHASE_CONFIRMED registrado correctamente",
    );

    // ⏰ FALLBACK: Cerrar modal automáticamente después de 30 segundos si no se recibe evento
    // Esto previene modales pegados en caso de que el evento nunca llegue
    const fallbackTimeout = setTimeout(() => {
      console.log(
        "⏰ [TransactionConfirmationModal] Fallback timeout: cerrando modal después de 30s sin evento",
      );
      if (isOpen && !confirmed) {
        // Cerrar modal silenciosamente sin mostrar mensaje de error
        onCancel();
      }
    }, 30000);

    return () => {
      // Cleanup: Remover listener y timeout de fallback
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      clearTimeout(fallbackTimeout);
    };
  }, [isOpen, confirmed]); // Agregar confirmed para evitar re-registro cuando ya se confirmó

  const handleConfirm = async () => {
    try {
      setIsConfirming(true);
      setError(null);

      console.log("[TransactionConfirmationModal] Ejecutando onConfirm()...");

      // Ejecutar la función de confirmación del parent
      // (buyTokens en token-provider)
      // Esta función ahora emitirá el evento PURCHASE_CONFIRMED
      // cuando termine exitosamente
      await onConfirm();

      console.log(
        "✅ [TransactionConfirmationModal] onConfirm() completado, esperando evento...",
      );

      // Si llegamos aquí sin error, el evento se habrá emitido
      // y el listener arriba cerrará el modal automáticamente
    } catch (err) {
      // Si hay error, mostrar en el modal
      const errorMsg =
        err instanceof Error ? err.message : "Error confirming transaction";

      console.error(
        "[TransactionConfirmationModal] Error en onConfirm():",
        errorMsg,
      );

      setError(errorMsg);
      setIsConfirming(false);
    }
  };

  // Cleanup timeout al desmontar o cerrar modal
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  // Reset state cuando se cierra el modal
  useEffect(() => {
    if (!isOpen) {
      setConfirmed(false);
      setError(null);
      setIsConfirming(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  if (confirmed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="rounded-2xl bg-white p-8 shadow-2xl max-w-md w-full mx-4">
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              ✅{" "}
              {transactionType === "BUY"
                ? "Compra"
                : transactionType === "SELL"
                  ? "Venta"
                  : "Transferencia"}{" "}
              Confirmada
            </h3>
            <p className="text-center text-sm text-gray-600">
              Tu transacción está siendo procesada
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="rounded-2xl bg-white shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 border-b border-gray-200 bg-linear-to-r from-blue-50 to-purple-50 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900">
            🔐 Confirmar{" "}
            {transactionType === "BUY"
              ? "Compra"
              : transactionType === "SELL"
                ? "Venta"
                : "Transferencia"}
          </h2>
        </div>

        {/* Content */}
        <div className="space-y-6 p-6">
          {/* Transaction Details */}
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-700 font-medium mb-3">
                📊 Detalles de la Transacción
              </p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">
                    Cantidad de {tokenSymbol}
                  </span>
                  <span className="font-semibold text-gray-900">
                    {formatNumber(tokenAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Monto en USD</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(fiatAmount)}
                  </span>
                </div>
                <div className="h-px bg-blue-200" />
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">
                    Fees de Gas + Plataforma
                  </span>
                  <span className="font-semibold text-blue-600">
                    {formatCurrency(fees)} SOL
                  </span>
                </div>
                {totalCost !== undefined && (
                  <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                    <span className="text-gray-900 font-semibold">
                      Total a Pagar
                    </span>
                    <span className="text-lg font-bold text-blue-600">
                      {formatCurrency(totalCost)} SOL
                    </span>
                  </div>
                )}
                {netReceived !== undefined && (
                  <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                    <span className="text-gray-900 font-semibold">
                      Neto a Recibir
                    </span>
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(netReceived)} SOL
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Wallet Info */}
            <div className="rounded-lg bg-purple-50 p-4">
              <p className="text-sm text-purple-700 font-medium mb-2">
                🔒 Información de Wallet
              </p>
              <p className="text-xs text-gray-600 break-all font-mono bg-white p-2 rounded border border-purple-200">
                {walletAddress}
              </p>
            </div>

            {/* Security Notice */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  Verificación Segura
                </p>
                <p className="text-xs text-amber-800 mt-1">
                  Tu wallet será requerida para firmar esta transacción. Mantén
                  tu wallet segura en todo momento.
                </p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">Error</p>
                <p className="text-xs text-red-800 mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirming}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {isConfirming ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Confirmando...
              </>
            ) : (
              <>✓ Confirmar</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
