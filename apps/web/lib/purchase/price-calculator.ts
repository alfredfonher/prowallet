/**
 * Cálculos de precios para compra y venta de tokens
 *
 * NOTA: El precio de GAPC es actualmente 0, por lo que:
 * - Compras: Solo pagas la tarifa de gas
 * - Ventas: Recibes 0 SOL menos la tarifa de gas (neta puede ser negativa)
 */

import { GAS_FEE_SOL, PLATFORM_FEE_SOL, TOKEN_PRICE_USD } from "./constants";

/**
 * Estructura con los detalles de cálculo de precio para compra
 */
export interface PurchasePriceCalculation {
  token_amount: number;
  token_price_usd: number;
  token_price_sol: number;
  subtotal_usd: number;
  subtotal_sol: number;
  gas_fee_sol: number;
  platform_fee_sol: number;
  total_fees_sol: number;
  total_to_pay_sol: number;
}

/**
 * Estructura con los detalles de cálculo de precio para venta
 */
export interface SellPriceCalculation {
  token_amount: number;
  token_price_usd: number;
  token_price_sol: number;
  subtotal_sol: number;
  gas_fee_sol: number;
  platform_fee_sol: number;
  total_fees_sol: number;
  net_received_sol: number;
}

/**
 * Calcula el precio total para comprar tokens
 *
 * Con TOKEN_PRICE_USD = 0:
 * - subtotal siempre es 0
 * - solo pagas la tarifa de gas
 * - es básicamente GRATIS (excepto el gas de red)
 *
 * @param token_amount - Cantidad de tokens a comprar
 * @param sol_price_usd - Precio de SOL en USD (usado para conversiones)
 * @returns Objeto con desglose completo de precios
 *
 * @example
 * const calc = calculate_purchase_price(1000, 145.50);
 * console.log(calc.total_to_pay_sol); // Solo GAS_FEE_SOL (0.000005 SOL)
 */
export function calculate_purchase_price(
  token_amount: number,
  sol_price_usd: number,
): PurchasePriceCalculation {
  // Validar inputs
  if (token_amount <= 0 || sol_price_usd <= 0) {
    return {
      token_amount: 0,
      token_price_usd: TOKEN_PRICE_USD,
      token_price_sol: 0,
      subtotal_usd: 0,
      subtotal_sol: 0,
      gas_fee_sol: GAS_FEE_SOL,
      platform_fee_sol: PLATFORM_FEE_SOL,
      total_fees_sol: GAS_FEE_SOL + PLATFORM_FEE_SOL,
      total_to_pay_sol: GAS_FEE_SOL + PLATFORM_FEE_SOL,
    };
  }

  const token_price_usd = TOKEN_PRICE_USD; // 0
  const token_price_sol =
    TOKEN_PRICE_USD === 0 ? 0 : TOKEN_PRICE_USD / sol_price_usd;
  const subtotal_usd = token_amount * token_price_usd; // 0
  const subtotal_sol = token_amount * token_price_sol; // 0
  const total_fees_sol = GAS_FEE_SOL + PLATFORM_FEE_SOL; // Solo gas
  const total_to_pay_sol = subtotal_sol + total_fees_sol; // 0 + gas

  return {
    token_amount,
    token_price_usd,
    token_price_sol,
    subtotal_usd,
    subtotal_sol,
    gas_fee_sol: GAS_FEE_SOL,
    platform_fee_sol: PLATFORM_FEE_SOL,
    total_fees_sol,
    total_to_pay_sol,
  };
}

/**
 * Calcula el precio neto para vender tokens
 *
 * Con TOKEN_PRICE_USD = 0:
 * - subtotal siempre es 0
 * - después de pagar el gas, neta es -gas_fee
 * - es decir, PAGAS para deshacerte de los tokens
 *
 * @param token_amount - Cantidad de tokens a vender
 * @param sol_price_usd - Precio de SOL en USD
 * @returns Objeto con desglose completo de precios
 *
 * @example
 * const calc = calculate_sell_price(1000, 145.50);
 * console.log(calc.net_received_sol); // Negativo (costo del gas)
 */
export function calculate_sell_price(
  token_amount: number,
  sol_price_usd: number,
): SellPriceCalculation {
  // Validar inputs
  if (token_amount <= 0 || sol_price_usd <= 0) {
    return {
      token_amount: 0,
      token_price_usd: TOKEN_PRICE_USD,
      token_price_sol: 0,
      subtotal_sol: 0,
      gas_fee_sol: GAS_FEE_SOL,
      platform_fee_sol: PLATFORM_FEE_SOL,
      total_fees_sol: GAS_FEE_SOL + PLATFORM_FEE_SOL,
      net_received_sol: -(GAS_FEE_SOL + PLATFORM_FEE_SOL),
    };
  }

  const token_price_usd = TOKEN_PRICE_USD; // 0
  const token_price_sol =
    TOKEN_PRICE_USD === 0 ? 0 : TOKEN_PRICE_USD / sol_price_usd;
  const subtotal_sol = token_amount * token_price_sol; // 0
  const total_fees_sol = GAS_FEE_SOL + PLATFORM_FEE_SOL; // Solo gas
  const net_received_sol = subtotal_sol - total_fees_sol; // 0 - gas = -gas

  return {
    token_amount,
    token_price_usd,
    token_price_sol,
    subtotal_sol,
    gas_fee_sol: GAS_FEE_SOL,
    platform_fee_sol: PLATFORM_FEE_SOL,
    total_fees_sol,
    net_received_sol,
  };
}

/**
 * Formatea un número decimal a un máximo de decimales
 *
 * @param value - Valor numérico
 * @param decimals - Número de decimales (default: 9)
 * @returns String formateado
 *
 * @example
 * format_sol_amount(1.234567890); // "1.234567890"
 * format_sol_amount(1.234567890, 4); // "1.2346"
 */
export function format_sol_amount(value: number, decimals = 9): string {
  return value.toFixed(decimals);
}

/**
 * Calcula si hay cambio significativo de precio (slippage)
 *
 * @param original_amount - Precio original en SOL
 * @param current_amount - Precio actual en SOL
 * @param slippage_percent - Porcentaje máximo de slippage permitido
 * @returns true si el cambio está dentro del límite
 *
 * @example
 * const ok = is_price_within_slippage(1.0, 1.02, 5);
 * console.log(ok); // true (cambio de 2%)
 */
export function is_price_within_slippage(
  original_amount: number,
  current_amount: number,
  slippage_percent = 5,
): boolean {
  if (original_amount <= 0) return false;

  const change = Math.abs(current_amount - original_amount);
  const change_percent = (change / original_amount) * 100;

  return change_percent <= slippage_percent;
}
