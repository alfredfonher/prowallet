/**
 * Aggregated Price Service with fallback mechanism
 * Tries each provider in order until one succeeds
 */
import { PriceProvider } from "./providers/types";
import { CoinGeckoProvider } from "./providers/coingecko";
import { setJson, getJson } from "../redis.service";

export class PriceService {
  private providers: PriceProvider[];
  private cacheKeyPrefix = "prowallet:price";
  private cacheTtlMs = parseInt(
    process.env.PRICE_CACHE_TTL_MS || "43200000",
    10,
  ); // 12h default

  constructor() {
    // Solo CoinGecko - es confiable, rápido y tiene rate limit generoso
    this.providers = [new CoinGeckoProvider()];
  }

  /**
   * Get price for a symbol with automatic fallback
   * First tries Redis cache, then providers in order
   */
  async getPrice(symbol: string): Promise<number> {
    const cacheKey = `${this.cacheKeyPrefix}:${symbol.toUpperCase()}`;

    // 1. Try Redis cache first
    try {
      const cached = await getJson(cacheKey);
      if (cached && cached.price && cached.price > 0) {
        const ageMs = Date.now() - cached.timestamp;
        console.log(
          `💾 Price from Redis cache for ${symbol}: $${cached.price} (age: ${ageMs}ms)`,
        );
        return cached.price;
      }
    } catch (err) {
      console.warn(
        `⚠️ Redis cache read error for ${symbol}:`,
        err instanceof Error ? err.message : err,
      );
    }

    // 2. Try each provider in order
    for (const provider of this.providers) {
      try {
        console.log(
          `📡 Fetching ${symbol} price from ${provider.getName()}...`,
        );
        const price = await provider.getPrice(symbol);

        if (price && price > 0) {
          console.log(
            `✅ ${provider.getName()} returned $${price.toFixed(2)} for ${symbol}`,
          );

          // Write to Redis cache for future requests
          try {
            const payload = {
              symbol: symbol.toUpperCase(),
              price,
              timestamp: Date.now(),
              source: provider.getName(),
            };
            await setJson(cacheKey, payload, this.cacheTtlMs);
          } catch (cacheErr) {
            console.warn(
              `⚠️ Failed to cache price for ${symbol}:`,
              cacheErr instanceof Error ? cacheErr.message : cacheErr,
            );
          }

          return price;
        }
      } catch (err) {
        console.warn(
          `⚠️ ${provider.getName()} failed for ${symbol}: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        );
        // Continue to next provider
      }
    }

    // 3. If all providers fail, throw error
    throw new Error(
      `All price providers failed for ${symbol}. No fallback available.`,
    );
  }

  /**
   * Get price with metadata (provider name, timestamp, etc)
   */
  async getPriceWithMetadata(symbol: string): Promise<{
    price: number;
    symbol: string;
    source: string;
    timestamp: number;
    ageMs: number;
  }> {
    const cacheKey = `${this.cacheKeyPrefix}:${symbol.toUpperCase()}`;

    // Try cache first
    try {
      const cached = await getJson(cacheKey);
      if (cached && cached.price && cached.price > 0) {
        return {
          price: cached.price,
          symbol: symbol.toUpperCase(),
          source: cached.source || "redis-cache",
          timestamp: cached.timestamp,
          ageMs: Date.now() - cached.timestamp,
        };
      }
    } catch (err) {
      // Continue to fetch
    }

    // Fetch fresh price
    const price = await this.getPrice(symbol);

    return {
      price,
      symbol: symbol.toUpperCase(),
      source: "live-fetch",
      timestamp: Date.now(),
      ageMs: 0,
    };
  }

  /**
   * Force refresh price (bypass cache)
   */
  async forceRefresh(symbol: string): Promise<number> {
    console.log(`🔄 Force refreshing ${symbol} price...`);

    for (const provider of this.providers) {
      try {
        const price = await provider.getPrice(symbol);

        if (price && price > 0) {
          console.log(
            `✅ Force refresh: ${provider.getName()} returned $${price.toFixed(2)}`,
          );

          // Update Redis cache
          try {
            const cacheKey = `${this.cacheKeyPrefix}:${symbol.toUpperCase()}`;
            const payload = {
              symbol: symbol.toUpperCase(),
              price,
              timestamp: Date.now(),
              source: provider.getName(),
            };
            await setJson(cacheKey, payload, this.cacheTtlMs);
          } catch (cacheErr) {
            console.warn(
              `⚠️ Cache update failed during force refresh:`,
              cacheErr instanceof Error ? cacheErr.message : cacheErr,
            );
          }

          return price;
        }
      } catch (err) {
        console.warn(
          `⚠️ ${provider.getName()} failed during force refresh for ${symbol}`,
        );
      }
    }

    // If all providers failed, try returning last cached value as a graceful fallback
    try {
      const cacheKey = `${this.cacheKeyPrefix}:${symbol.toUpperCase()}`;
      const cached = await getJson(cacheKey);
      if (cached && cached.price && cached.price > 0) {
        console.warn(
          `⚠️ All providers failed for ${symbol}, returning cached price $${cached.price}`,
        );
        return cached.price;
      }
    } catch (cacheErr) {
      console.warn(
        `⚠️ Failed to read cached price during force refresh fallback for ${symbol}:`,
        cacheErr instanceof Error ? cacheErr.message : cacheErr,
      );
    }

    throw new Error(
      `Force refresh failed for ${symbol}: all providers down and no cached price available`,
    );
  }

  /**
   * Get list of active providers
   */
  getProviders(): string[] {
    return this.providers.map((p) => p.getName());
  }
}

// Export singleton instance
export const priceService = new PriceService();
