"use client";

import { useState } from "react";
import { TokenAmountInput } from "@/components/purchase/TokenAmountInput";
import { parseTokenInput } from "@/lib/utils/token-input-formatter";

/**
 * Ejemplo de integración del TokenAmountInput en Buy View
 * Este es un componente de ejemplo para mostrar cómo usar el nuevo input
 */
export function BuyViewExample() {
  const [tokenAmount, setTokenAmount] = useState<string>("");
  const [numericValue, setNumericValue] = useState<number>(0);
  const [isValid, setIsValid] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Simulados para el ejemplo
  const solPrice = 245.5; // 1 SOL = $245.50
  const gapcPrice = 0.01; // 1 GAPC = $0.01
  const solBalance = 2.5; // Usuario tiene 2.5 SOL

  const maxAffordableTokens = Math.floor((solBalance * solPrice) / gapcPrice);

  const handleTokenAmountChange = (value: string) => {
    setTokenAmount(value);
    setError("");
  };

  const handleNumericValueChange = (value: number) => {
    setNumericValue(value);

    // Validar que no supere la cantidad disponible
    if (value > maxAffordableTokens) {
      setError(
        `Máximo disponible: ${maxAffordableTokens.toLocaleString("es-ES")} GAPC`,
      );
    }
  };

  const handleValidationChange = (valid: boolean) => {
    setIsValid(valid);
  };

  const handleBuy = () => {
    if (!isValid) {
      setError("Ingresa una cantidad válida");
      return;
    }

    if (numericValue > maxAffordableTokens) {
      setError("No tienes saldo suficiente");
      return;
    }

    // Aquí iría la lógica de compra
    console.log(`Comprando ${numericValue} GAPC`);
  };

  // Cálculos
  const totalCostUSD = numericValue * gapcPrice;
  const totalCostSOL = totalCostUSD / solPrice;

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Comprar GAPC</h2>

      {/* Input de cantidad */}
      <TokenAmountInput
        value={tokenAmount}
        onChange={handleTokenAmountChange}
        onValueChange={handleNumericValueChange}
        onValidationChange={handleValidationChange}
        label="Cantidad de GAPC"
        placeholder="0"
        error={error}
        helperText="Máximo 6 decimales"
        required={true}
      />

      {/* Resumen de la compra */}
      {isValid && !error && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-gray-900">Resumen</h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-700">
              <span>Cantidad:</span>
              <span className="font-medium">
                {numericValue.toLocaleString("es-ES")} GAPC
              </span>
            </div>

            <div className="flex justify-between text-gray-700">
              <span>Precio unitario:</span>
              <span className="font-medium">$0,01 USD</span>
            </div>

            <div className="flex justify-between text-gray-700">
              <span>Equivalente en SOL:</span>
              <span className="font-medium">{totalCostSOL.toFixed(6)} SOL</span>
            </div>

            <div className="border-t border-blue-200 pt-2 flex justify-between text-gray-900 font-bold">
              <span>Total:</span>
              <span>${totalCostUSD.toFixed(2)} USD</span>
            </div>

            {solBalance < totalCostSOL && (
              <div className="text-red-600 text-xs bg-red-50 p-2 rounded mt-2">
                ⚠️ Saldo insuficiente. Necesitas{" "}
                {(totalCostSOL - solBalance).toFixed(6)} SOL más
              </div>
            )}

            <div className="text-gray-600 text-xs">
              Saldo disponible: {solBalance.toFixed(4)} SOL
            </div>
          </div>
        </div>
      )}

      {/* Botón de compra */}
      <button
        onClick={handleBuy}
        disabled={!isValid || numericValue > maxAffordableTokens}
        className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
          isValid && numericValue <= maxAffordableTokens
            ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
      >
        {!isValid
          ? "Ingresa una cantidad"
          : numericValue > maxAffordableTokens
            ? "Saldo insuficiente"
            : "Comprar GAPC"}
      </button>

      {/* Info adicional */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-2">
        <p>✓ Separador de miles: punto (.)</p>
        <p>✓ Separador decimal: coma (,)</p>
        <p>✓ Máximo 6 decimales</p>
        <p>✓ Ingresa números de derecha a izquierda</p>
      </div>
    </div>
  );
}
