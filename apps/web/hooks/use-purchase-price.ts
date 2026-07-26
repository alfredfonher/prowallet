/**
 * Hook para cálculos dinámicos de precio
 * Maneja conversión USD ↔ SOL y validación de precios
 */

"use client";

import { useMemo } from "react";
import {
  calculate_purchase_price,
  calculate_sell_price,
  type PurchasePriceCalculation,
  type SellPriceCalculation,
} from "@/lib/purchase";

/**
 * Props para el hook use_purchase_price
 */
export interface UsePurchasePriceProps {
  token_amount: number;
  sol_price_usd: number | null;
  mode: "buy" | "sell";
}

/**
 * Resultado del hook use_purchase_price
 */
export interface UsePurchasePriceResult {
  purchase_calc: PurchasePriceCalculation | null;
  sell_calc: SellPriceCalculation | null;
  has_valid_prices: boolean;
  token_price_usd: number;
  token_price_sol: number;
}

/**
 * Hook para calcular precios de compra/venta
 *
 * Maneja:
 * - Conversión de USD a SOL según precio actual
 * - Desglose de fees y totales
 * - Validación de que los precios sean válidos
 *
 * @param props - Props con cantidad de tokens, precio de SOL, y modo
 * @returns Objeto con cálculos de precio
 *
 * @example
 * const { purchase_calc, has_valid_prices } = use_purchase_price({
 *   token_amount: 100,
 *   sol_price_usd: 145.5,
 *   mode: "buy"
 * });
 *
 * if (has_valid_prices) {
 *   console.log(purchase_calc?.total_to_pay_sol);
 * }
 */
export function use_purchase_price({
  token_amount,
  sol_price_usd,
  mode,
}: UsePurchasePriceProps): UsePurchasePriceResult {
  /**
   * Validar que los precios sean válidos
   */
  const has_valid_prices = useMemo(() => {
    return sol_price_usd !== null && sol_price_usd > 0;
  }, [sol_price_usd]);

  /**
   * Obtener precio del token en USD y SOL
   */
  const { token_price_usd, token_price_sol } = useMemo(() => {
    if (!has_valid_prices || !sol_price_usd) {
      return { token_price_usd: 0.01, token_price_sol: 0 };
    }

    const token_usd = 0.01; // Precio fijo
    const token_sol = token_usd / sol_price_usd;

    return { token_price_usd: token_usd, token_price_sol: token_sol };
  }, [has_valid_prices, sol_price_usd]);

  /**
   * Calcular precios según el modo
   */
  const purchase_calc = useMemo(() => {
    if (!has_valid_prices || !sol_price_usd) return null;
    return calculate_purchase_price(token_amount, sol_price_usd);
  }, [token_amount, sol_price_usd, has_valid_prices]);

  const sell_calc = useMemo(() => {
    if (!has_valid_prices || !sol_price_usd) return null;
    return calculate_sell_price(token_amount, sol_price_usd);
  }, [token_amount, sol_price_usd, has_valid_prices]);

  return {
    purchase_calc: mode === "buy" ? purchase_calc : null,
    sell_calc: mode === "sell" ? sell_calc : null,
    has_valid_prices,
    token_price_usd,
    token_price_sol,
  };
}
