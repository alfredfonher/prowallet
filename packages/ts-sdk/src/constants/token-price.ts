/**
 * Token Pricing Constants
 *
 * The ProWallet token has a fixed price of 0.01 USD.
 * This constant is used across the entire system for consistency.
 */

export const PROWALLET_PRICE_CONFIG = {
  /**
   * Fixed price of ProWallet token in USD
   */
  PRICE_USD: 0.01,

  /**
   * Currency code
   */
  CURRENCY: "USD",
} as const;

/**
 * Get the fixed token price in USD
 * @returns The token price (0.01 USD)
 */
export const get_token_price_usd = (): number => {
  return PROWALLET_PRICE_CONFIG.PRICE_USD;
};

/**
 * Validate if a price value is valid (must be positive and finite)
 * @param price The price value to validate
 * @returns true if valid, false otherwise
 */
export const is_valid_price = (price: unknown): price is number => {
  if (typeof price !== "number") return false;
  return isFinite(price) && price > 0;
};

/**
 * Ensure a price is valid, fallback to token price
 * @param price The price to validate
 * @returns The price if valid, otherwise the token price
 */
export const ensure_valid_price = (price: unknown): number => {
  return is_valid_price(price) ? price : PROWALLET_PRICE_CONFIG.PRICE_USD;
};
