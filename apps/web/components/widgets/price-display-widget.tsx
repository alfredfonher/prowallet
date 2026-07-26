/**
 * Widget para mostrar desglose de precios de compra/venta
 */

import type React from "react";

/**
 * Props para PriceDisplayWidget
 */
export interface PriceDisplayWidgetProps {
  token_amount: number;
  token_price_usd: number;
  token_price_sol: number;
  subtotal_usd: number;
  subtotal_sol: number;
  total_to_pay_or_receive_sol: number;
  mode: "buy" | "sell";
}

/**
 * Widget que muestra el desglose completo de precios
 *
 * Muestra:
 * - Precio por token (USD)
 * - Subtotal (USD)
 * - Total a pagar/recibir (SOL)
 *
 * @param props - Props con detalles de precio
 * @returns Componente React
 *
 * @example
 * <PriceDisplayWidget
 *   token_amount={100}
 *   token_price_usd={0.01}
 *   token_price_sol={0.00006}
 *   subtotal_usd={1.00}
 *   subtotal_sol={0.006}
 *   total_to_pay_or_receive_sol={0.006010}
 *   mode="buy"
 *   token_symbol="GAPC"
 * />
 */
export const PriceDisplayWidget: React.FC<PriceDisplayWidgetProps> = ({
  token_amount,
  token_price_usd,
  subtotal_usd,
  total_to_pay_or_receive_sol,
  mode,
}) => {
  // Solo mostrar si hay cantidad
  if (token_amount <= 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Precio por token</span>
        <span className="text-sm font-semibold text-foreground">
          ${token_price_usd.toFixed(4)} USD
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Subtotal en USD ({token_amount} tokens)
        </span>
        <span className="text-lg font-semibold text-amber-600">
          ${subtotal_usd.toFixed(2)} USD
        </span>
      </div>
      <div className="border-t border-border pt-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {mode === "buy"
            ? "Costo en SOL (a pagar)"
            : "Monto en SOL (a recibir)"}
        </span>
        <span
          className={`text-lg font-semibold ${mode === "buy" ? "text-emerald-600" : "text-rose-600"}`}
        >
          {total_to_pay_or_receive_sol.toFixed(9)} SOL
        </span>
      </div>
    </div>
  );
};

PriceDisplayWidget.displayName = "PriceDisplayWidget";
