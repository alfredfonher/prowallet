/**
 * Módulo de utilidades para operaciones de compra/venta
 */

export {
  GAS_FEE_SOL,
  PLATFORM_FEE_SOL,
  TOTAL_FEES_SOL,
  BALANCE_BUFFER_SOL,
  TOKEN_PRICE_USD,
  SOLANA_RPC_ENDPOINT,
  MIN_TRANSACTION_CONFIRMS,
} from "./constants";

export { fetch_sol_balance } from "./balance";

export {
  calculate_purchase_price,
  calculate_sell_price,
  format_sol_amount,
  is_price_within_slippage,
  type PurchasePriceCalculation,
  type SellPriceCalculation,
} from "./price-calculator";

export {
  validate_token_amount,
  validate_sol_balance,
  validate_token_balance,
  is_token_input_format_valid,
  validate_wallet_connected,
  type ValidationResult,
} from "./validator";
