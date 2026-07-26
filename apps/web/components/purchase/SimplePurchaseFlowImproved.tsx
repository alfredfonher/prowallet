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
import { TokenAmountInput } from "./TokenAmountInput";
import { parseTokenInput } from "@/lib/utils/token-input-formatter";

interface SimplePurchaseFlowImprovedProps {
  onSuccess?: (signature: string) => void;
  onError?: (error: string) => void;
}

/**
 * SimplePurchaseFlow Mejorado
 *
 * Features:
 * ✓ Nuevo TokenAmountInput con formato mejorado
 * ✓ Separador de miles (.)
 * ✓ Separador decimal (,)
 * ✓ Texto RTL
 * ✓ Sin spinner icon
 * ✓ Validación visual
 * ✓ Patrón: initiate → sign → send → settle
 */
export function SimplePurchaseFlowImproved({
  onSuccess,
  onError,
}: SimplePurchaseFlowImprovedProps) {
  const { connected, publicKey } = useWallet();
  const purchase = usePurchase();
  const priceQuote = usePriceQuote();

  // Estado del formulario
  const [tokenAmountDisplay, setTokenAmountDisplay] = useState<string>("");
  const [tokenAmountNumeric, setTokenAmountNumeric] = useState<number>(0);
  const [amountError, setAmountError] = useState<string>("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [isValidAmount, setIsValidAmount] = useState(false);

  // Manejador de cambio de cantidad
  const handleAmountChange = useCallback((displayValue: string) => {
    setTokenAmountDisplay(displayValue);
    setAmountError("");
  }, []);

  // Manejador de valor numérico
  const handleNumericValueChange = useCallback(
    (numericValue: number) => {
      setTokenAmountNumeric(numericValue);

      // Validaciones
      if (numericValue < APP_CONFIG.token.minPurchase) {
        setAmountError(
          `Mínimo: ${APP_CONFIG.token.minPurchase.toLocaleString("es-ES")} ${APP_CONFIG.token.symbol}`,
        );
        return;
      }

      if (numericValue > APP_CONFIG.token.maxPurchase) {
        setAmountError(
          `Máximo: ${APP_CONFIG.token.maxPurchase.toLocaleString("es-ES")} ${APP_CONFIG.token.symbol}`,
        );
        return;
      }

      setAmountError("");

      // Obtener precio para esta cantidad
      priceQuote.fetchPrice(numericValue);
    },
    [priceQuote],
  );

  // Manejador de validación
  const handleValidationChange = useCallback((isValid: boolean) => {
    setIsValidAmount(isValid);
  }, []);

  // Ejecutar compra
  const handleBuyClick = useCallback(async () => {
    if (!connected) {
      const msg = "Por favor conecta tu wallet";
      toast.error(msg);
      onError?.(msg);
      return;
    }

    if (!publicKey) {
      const msg = "No se pudo obtener la dirección de la wallet";
      toast.error(msg);
      onError?.(msg);
      return;
    }

    if (!isValidAmount) {
      const msg = "Ingresa una cantidad válida";
      toast.error(msg);
      setAmountError(msg);
      return;
    }

    setIsExecuting(true);
    purchase.resetState();

    try {
      const params: PurchaseParams = {
        tokenAmount: tokenAmountNumeric,
        paymentMethod: "SOL",
        maxSlippage: 5,
      };

      const success = await purchase.executePurchase(params);

      if (success && purchase.transactionSignature) {
        toast.success(
          `¡Compra exitosa! Firma: ${purchase.transactionSignature.slice(0, 16)}...`,
        );
        setTokenAmountDisplay("");
        setTokenAmountNumeric(0);
        onSuccess?.(purchase.transactionSignature);
      } else if (purchase.error) {
        toast.error(purchase.error);
        onError?.(purchase.error);
      }
    } finally {
      setIsExecuting(false);
    }
  }, [
    connected,
    publicKey,
    tokenAmountNumeric,
    isValidAmount,
    purchase,
    onSuccess,
    onError,
  ]);

  // Cálculos
  const totalCostUSD = tokenAmountNumeric * APP_CONFIG.token.price;
  const totalCostSOL = priceQuote.price || 0;
  const gasEstimate = APP_CONFIG.solana.gasEstimate || 0.00005;
  const totalWithGas = totalCostSOL + gasEstimate;

  const canBuy =
    connected &&
    isValidAmount &&
    tokenAmountNumeric > 0 &&
    !amountError &&
    !isExecuting;

  return (
    <div className="w-full max-w-md mx-auto rounded-lg border border-gray-200 bg-white p-6 shadow-md space-y-6">
      {/* Header */}
      <h2 className="text-2xl font-bold">Comprar {APP_CONFIG.token.symbol}</h2>

      {/* Network Info */}
      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-1">
        <p className="text-sm text-gray-700">
          <strong>Red:</strong> {APP_CONFIG.solana.network.toUpperCase()}
        </p>
        <p className="text-sm text-gray-700">
          <strong>Token Mint:</strong> {APP_CONFIG.solana.tokenMint.slice(0, 8)}
          ...
        </p>
      </div>

      {/* Wallet Status */}
      {connected ? (
        <div className="p-3 bg-green-50 rounded-lg border border-green-200 space-y-1">
          <p className="text-sm text-gray-700">
            <strong>Wallet:</strong> {publicKey?.toString().slice(0, 8)}...
          </p>
          <p className="text-sm text-green-600">✓ Conectada</p>
        </div>
      ) : (
        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-sm text-yellow-700">
            ⚠️ Por favor conecta tu wallet
          </p>
        </div>
      )}

      {/* Token Amount Input - MEJORADO */}
      <TokenAmountInput
        value={tokenAmountDisplay}
        onChange={handleAmountChange}
        onValueChange={handleNumericValueChange}
        onValidationChange={handleValidationChange}
        label={`Cantidad de ${APP_CONFIG.token.symbol}`}
        placeholder="0"
        error={amountError}
        helperText={`Mín: ${APP_CONFIG.token.minPurchase} | Máx: ${APP_CONFIG.token.maxPurchase}`}
        disabled={!connected || isExecuting}
        required
      />

      {/* Price Quote */}
      {isValidAmount && !amountError && priceQuote.price && (
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
          <h3 className="font-semibold text-gray-900">Resumen</h3>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-700">
              <span>Cantidad:</span>
              <span className="font-medium">
                {tokenAmountNumeric.toLocaleString("es-ES")}{" "}
                {APP_CONFIG.token.symbol}
              </span>
            </div>

            <div className="flex justify-between text-gray-700">
              <span>Precio unitario:</span>
              <span className="font-medium">
                ${APP_CONFIG.token.price.toFixed(4)} USD
              </span>
            </div>

            <div className="flex justify-between text-gray-700">
              <span>Costo en USD:</span>
              <span className="font-medium">${totalCostUSD.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-gray-700">
              <span>En SOL:</span>
              <span className="font-medium">{totalCostSOL.toFixed(6)} SOL</span>
            </div>

            <div className="flex justify-between text-gray-700 text-xs">
              <span>Gas estimado:</span>
              <span className="font-medium">{gasEstimate.toFixed(6)} SOL</span>
            </div>

            <div className="border-t border-blue-200 pt-2 flex justify-between text-gray-900 font-bold">
              <span>Total:</span>
              <span>{totalWithGas.toFixed(6)} SOL</span>
            </div>
          </div>
        </div>
      )}

      {/* Loading/Error State */}
      {purchase.isLoading && (
        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-sm text-yellow-700">⏳ Procesando tu compra...</p>
        </div>
      )}

      {purchase.error && (
        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm text-red-700">❌ Error: {purchase.error}</p>
        </div>
      )}

      {/* Buy Button */}
      <button
        onClick={handleBuyClick}
        disabled={!canBuy}
        className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
          canBuy
            ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
      >
        {isExecuting ? "Procesando..." : `Comprar ${APP_CONFIG.token.symbol}`}
      </button>

      {/* Info Text */}
      <div className="text-xs text-gray-600 space-y-1">
        <p>✓ Separador de miles: . (punto)</p>
        <p>✓ Separador decimales: , (coma)</p>
        <p>✓ Máximo 6 decimales</p>
        <p>✓ Texto de derecha a izquierda</p>
      </div>
    </div>
  );
}

export default SimplePurchaseFlowImproved;
