/**
 * Widget para mostrar el desglose de tarifas
 */

import type React from "react";

/**
 * Props para FeeBreakdownWidget
 */
export interface FeeBreakdownWidgetProps {
  gas_fee_sol: number;
  platform_fee_sol: number;
  total_fees_sol: number;
}

/**
 * Widget que muestra el desglose detallado de tarifas
 *
 * Muestra:
 * - Tarifa de gas
 * - Tarifa de plataforma
 * - Total de tarifas
 *
 * @param props - Props con detalles de tarifas
 * @returns Componente React
 *
 * @example
 * <FeeBreakdownWidget
 *   gas_fee_sol={0.000005}
 *   platform_fee_sol={0.000005}
 *   total_fees_sol={0.00001}
 * />
 */
export const FeeBreakdownWidget: React.FC<FeeBreakdownWidgetProps> = ({
  gas_fee_sol,
  platform_fee_sol,
  total_fees_sol,
}) => {
  return (
    <div className="rounded-lg border border-amber-200/50 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/5 p-3 space-y-1">
      <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
        📊 Desglose de tarifas:
      </p>
      <div className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5 ml-2">
        <p>
          • Tarifa de gas:{" "}
          <span className="font-mono">{gas_fee_sol.toFixed(9)} SOL</span>
        </p>
        <p>
          • Tarifa de plataforma:{" "}
          <span className="font-mono">{platform_fee_sol.toFixed(9)} SOL</span>
        </p>
        <p className="border-t border-amber-200/50 dark:border-amber-500/10 pt-1">
          Total:{" "}
          <span className="font-semibold font-mono">
            {total_fees_sol.toFixed(9)} SOL
          </span>
        </p>
      </div>
    </div>
  );
};

FeeBreakdownWidget.displayName = "FeeBreakdownWidget";
