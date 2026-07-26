/**
 * Interface for price providers
 * Each provider implements this contract to fetch prices from different APIs
 */
export interface PriceProvider {
  /**
   * Get price for a cryptocurrency symbol
   * @param symbol - Symbol (e.g., "SOL", "BTC", "ETH")
   * @returns Price in USD
   * @throws Error if fetch fails or invalid response
   */
  getPrice(symbol: string): Promise<number>;

  /**
   * Name of provider (for logging/debugging)
   */
  getName(): string;
}
