"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  usePurchase,
  usePriceQuote,
  type PurchaseParams,
} from "@/hooks/use-purchase";
import APP_CONFIG from "@/lib/config";
import toast from "react-hot-toast";

interface SimplePurchaseFlowProps {
  onSuccess?: (signature: string) => void;
  onError?: (error: string) => void;
}

/**
 * SimplePurchaseFlow - Flujo simplificado de compra
 * Usa el hook usePurchase que implementa el patrón correcto
 * Patrón: initiate → sign → send → settle
 */
export function SimplePurchaseFlow({
  onSuccess,
  onError,
}: SimplePurchaseFlowProps) {
  const { connected, publicKey } = useWallet();
  const purchase = usePurchase();
  const priceQuote = usePriceQuote();

  const [tokenAmount, setTokenAmount] = useState<number>(100);
  const [isExecuting, setIsExecuting] = useState(false);

  // Obtener precio cuando cambia la cantidad
  const handleAmountChange = useCallback(
    (amount: number) => {
      setTokenAmount(amount);
      priceQuote.fetchPrice(amount);
    },
    [priceQuote],
  );

  // Ejecutar compra
  const handleBuyClick = useCallback(async () => {
    if (!publicKey) {
      const msg = "Por favor conecta tu wallet";
      toast.error(msg);
      onError?.(msg);
      return;
    }

    setIsExecuting(true);
    purchase.resetState();

    try {
      const params: PurchaseParams = {
        tokenAmount,
        paymentMethod: "SOL",
        maxSlippage: 5,
      };

      const success = await purchase.executePurchase(params);

      if (success && purchase.transactionSignature) {
        toast.success(
          `¡Compra exitosa! Firma: ${purchase.transactionSignature.slice(0, 16)}...`,
        );
        onSuccess?.(purchase.transactionSignature);
      } else if (purchase.error) {
        toast.error(purchase.error);
        onError?.(purchase.error);
      }
    } finally {
      setIsExecuting(false);
    }
  }, [publicKey, tokenAmount, purchase, onSuccess, onError]);

  return (
    <div className="w-full max-w-md mx-auto rounded-lg border border-gray-200 bg-white p-6 shadow-md">
      <h2 className="text-2xl font-bold mb-6">
        Comprar {APP_CONFIG.token.symbol}
      </h2>

      {/* Información de red */}
      <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-gray-700">
          <strong>Red:</strong> {APP_CONFIG.solana.network.toUpperCase()}
        </p>
        <p className="text-sm text-gray-700">
          <strong>Token Mint:</strong> {APP_CONFIG.solana.tokenMint.slice(0, 8)}
          ...
        </p>
      </div>

      {/* Información de wallet */}
      {connected ? (
        <div className="mb-6 p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm text-gray-700">
            <strong>Wallet:</strong> {publicKey?.toString().slice(0, 8)}...
          </p>
          <p className="text-sm text-green-600">✓ Conectada</p>
        </div>
      ) : (
        <div className="mb-6 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-sm text-yellow-700">
            ⚠️ Por favor conecta tu wallet
          </p>
        </div>
      )}

      {/* Cantidad de tokens */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Cantidad de Tokens {APP_CONFIG.token.symbol}
        </label>
        <input
          type="number"
          min={APP_CONFIG.token.minPurchase}
          max={APP_CONFIG.token.maxPurchase}
          value={tokenAmount}
          onChange={(e) => handleAmountChange(Number(e.target.value))}
          disabled={purchase.isLoading || isExecuting}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-gray-500">
          Mín: {APP_CONFIG.token.minPurchase} | Máx:{" "}
          {APP_CONFIG.token.maxPurchase}
        </p>
      </div>

      {/* Precio estimado */}
      {priceQuote.price && (
        <div className="mb-6 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-700 mb-2">
            <strong>Precio por token:</strong> $0.01 USD
          </p>
          <p className="text-sm text-gray-700">
            <strong>Total a pagar en SOL:</strong> {priceQuote.price.toFixed(6)}{" "}
            SOL
          </p>
        </div>
      )}

      {/* Mensaje de error */}
      {(purchase.error || priceQuote.error) && (
        <div className="mb-6 p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm text-red-700">
            ❌ {purchase.error || priceQuote.error}
          </p>
        </div>
      )}

      {/* Mensaje de éxito */}
      {purchase.success && (
        <div className="mb-6 p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm text-green-700">
            ✅ ¡Compra completada! Firma:{" "}
            {purchase.transactionSignature?.slice(0, 16)}...
          </p>
        </div>
      )}

      {/* Botón de compra */}
      <button
        onClick={handleBuyClick}
        disabled={
          !connected ||
          purchase.isLoading ||
          isExecuting ||
          priceQuote.isLoading
        }
        className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
          connected && !purchase.isLoading && !isExecuting
            ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
            : "bg-gray-400 cursor-not-allowed"
        }`}
      >
        {!connected
          ? "Conectar Wallet"
          : purchase.isLoading || isExecuting
            ? "Procesando..."
            : `Comprar ${tokenAmount} ${APP_CONFIG.token.symbol}`}
      </button>

      {/* Debug info en desarrollo */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-6 p-3 bg-gray-100 rounded-lg text-xs text-gray-600 max-h-40 overflow-auto">
          <p>
            <strong>Estado:</strong>{" "}
            {JSON.stringify(
              {
                isLoading: purchase.isLoading,
                success: purchase.success,
              },
              null,
              2,
            )}
          </p>
        </div>
      )}
    </div>
  );
}
