/**
 * Widget para input de cantidad de tokens a comprar/vender
 */

import type React from "react";

/**
 * Props para PurchaseInputWidget
 */
export interface PurchaseInputWidgetProps {
  value: string;
  on_change: (value: string) => void;
  placeholder?: string;
  token_symbol: string;
  mode: "buy" | "sell";
  token_price_sol: number;
}

/**
 * Widget para input de cantidad de tokens
 *
 * Características:
 * - Solo permite números y decimales
 * - Muestra precio en SOL en tiempo real
 * - Selector de símbolo de token
 *
 * @param props - Props del widget
 * @returns Componente React
 *
 * @example
 * <PurchaseInputWidget
 *   value="100"
 *   on_change={(val) => set_prowallet_amount(val)}
 *   token_symbol="GAPC"
 *   mode="buy"
 *   token_price_sol={0.00006}
 * />
 */
export const PurchaseInputWidget: React.FC<PurchaseInputWidgetProps> = ({
  value,
  on_change,
  placeholder = "0",
  token_symbol,
  token_price_sol,
}) => {
  /**
   * Maneja cambios en el input validando formato
   */
  const handle_input_change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const new_value = e.target.value;

    // Validar: solo números y punto decimal, máximo 9 decimales
    if (new_value === "" || /^\d*\.?\d{0,9}$/.test(new_value)) {
      on_change(new_value);
    }
  };

  /**
   * Calcula el precio en SOL del valor actual
   */
  const price_in_sol = (() => {
    const amount = Number.parseFloat(value) || 0;
    return amount * token_price_sol;
  })();

  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">
          GAPC a comprar/vender
        </span>
        <span className="text-xs text-muted-foreground">
          {price_in_sol > 0 ? `${price_in_sol.toFixed(9)} SOL` : "—"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          pattern="[0-9]*\.?[0-9]{0,9}"
          value={value}
          onChange={handle_input_change}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-2xl font-semibold text-foreground placeholder:text-muted-foreground/50 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <div className="flex items-center gap-1 rounded-lg bg-background px-3 py-2 border border-border whitespace-nowrap">
          <div className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold text-white bg-primary">
            G
          </div>
          <span className="text-sm font-medium text-foreground">
            {token_symbol}
          </span>
        </div>
      </div>
    </div>
  );
};

PurchaseInputWidget.displayName = "PurchaseInputWidget";
