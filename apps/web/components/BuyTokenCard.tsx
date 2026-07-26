/**
 * BuyTokenCard - Componente simplificado para compra de tokens
 * Nota: Este componente es de demostración y no se está utilizando actualmente
 * Se mantiene para referencia futura de una UI de compra simple
 */

"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export default function BuyTokenCard() {
  const { isAuthenticated } = useAuth();
  const [tokenAmount, setTokenAmount] = useState<number>(1);
  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);

  const handleBuy = async () => {
    if (tokenAmount <= 0) {
      alert("Por favor ingresa una cantidad válida");
      return;
    }
    // TODO: Implement buy logic
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 border rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Comprar Tokens</h2>

      {/* Input de cantidad */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Cantidad de tokens
        </label>
        <input
          type="number"
          min="0.001"
          step="0.001"
          value={tokenAmount}
          onChange={(e) => setTokenAmount(parseFloat(e.target.value) || 0)}
          disabled={isLoading}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 rounded text-sm text-red-700">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {/* Botón de compra */}
      <button
        onClick={handleBuy}
        disabled={isLoading || !isAuthenticated}
        className={`w-full py-2 px-4 rounded-md font-medium text-white transition ${
          isLoading || !isAuthenticated
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {isLoading ? "⏳ Procesando..." : "💎 Comprar Tokens"}
      </button>

      {!isAuthenticated && (
        <p className="text-sm text-gray-500 mt-2 text-center">
          Por favor, conecta tu wallet para comprar tokens
        </p>
      )}
    </div>
  );
}
