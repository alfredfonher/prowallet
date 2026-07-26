/**
 * Vista pública de trading - para usuarios no autenticados
 * Muestra información del token sin requerir wallet conectada
 */

import type React from "react";
import { formatNumber } from "@/lib/token-store";

/**
 * Props para PublicTradeView
 */
export interface PublicTradeViewProps {
  token_symbol: string;
  token_price_usd: number | null;
  token_holders: number | object;
  token_total_supply: number | null;
}

/**
 * Vista pública del módulo de trading
 *
 * Muestra:
 * - Información pública del token (precio, holders, supply)
 * - Llamada a acción para conectar wallet
 * - Sin datos sensibles del usuario
 *
 * @param props - Props con información del token
 * @returns Componente React
 *
 * @example
 * <PublicTradeView
 *   token_symbol="GAPC"
 *   token_price_usd={0.01}
 *   token_holders={150}
 *   token_total_supply={1000000}
 * />
 */
export const PublicTradeView: React.FC<PublicTradeViewProps> = ({
  token_symbol,
  token_price_usd,
  token_holders,
  token_total_supply,
}) => {
  /**
   * Calcular número de holders (puede ser número o diccionario)
   */
  const get_holders_count = (): number => {
    if (typeof token_holders === "number") {
      return token_holders;
    }
    if (typeof token_holders === "object") {
      return Object.keys(token_holders).length;
    }
    return 0;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Información Pública del Token */}
      <div className="rounded-xl border border-blue-200/50 bg-blue-50/50 p-6">
        <h3 className="font-semibold text-blue-900">
          📊 Información Pública del Token
        </h3>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-blue-700/70">Token</p>
            <p className="font-semibold text-blue-900">{token_symbol}</p>
          </div>
          <div>
            <p className="text-blue-700/70">Precio</p>
            <p className="font-semibold text-blue-900">
              {token_price_usd ? `$${token_price_usd.toFixed(6)}` : "Variable"}
            </p>
          </div>
          <div>
            <p className="text-blue-700/70">Holders</p>
            <p className="font-semibold text-blue-900">{get_holders_count()}</p>
          </div>
          <div>
            <p className="text-blue-700/70">Supply</p>
            <p className="font-semibold text-blue-900">
              {token_total_supply ? formatNumber(token_total_supply) : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Llamada a Acción */}
      <div className="rounded-xl border border-amber-200/50 bg-amber-50/50 p-6">
        <h3 className="font-semibold text-amber-900">
          🔐 Conecta tu Wallet para Comprar o Vender
        </h3>
        <p className="mt-2 text-sm text-amber-800">
          Debes autenticarte con tu wallet de Solana para ver tu balance y
          realizar operaciones.
        </p>
        <p className="mt-2 text-xs text-amber-700">
          Tus datos sensibles (balance, historial) solo serán visibles después
          de autenticarte.
        </p>
      </div>
    </div>
  );
};

PublicTradeView.displayName = "PublicTradeView";
