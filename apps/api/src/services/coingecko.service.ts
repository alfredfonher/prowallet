import axios from "axios";
import { setJson } from "./redis.service";

interface PriceCache {
  price: number;
  timestamp: number;
  updateCount: number;
}

export class CryptoRankService {
  // Usar CryptoRank v2 API
  private baseUrl = "https://api.cryptorank.io/v2";
  // Read API key from env to avoid embedding secrets in source code.
  // Support two common names for compatibility: CRYPTORANK_API_KEY or CRYPTO_RANK_API_KEY
  private apiKey: string = (
    process.env.CRYPTORANK_API_KEY ||
    process.env.CRYPTO_RANK_API_KEY ||
    ""
  ).trim();
  private readonly SOL_ID = "5663"; // ID de Solana en CryptoRank

  private priceCache: PriceCache = {
    price: 143.68, // Fallback default (precio actual aprox de SOL)
    timestamp: 0,
    updateCount: 0,
  };

  private updateInterval: NodeJS.Timeout | null = null;
  private isUpdating = false;
  // 12 hours (43200000 ms) - price remains stable for a full business day
  private readonly PRICE_UPDATE_INTERVAL_MS = parseInt(
    process.env.PRICE_UPDATE_MS || "43200000",
    10,
  ); // default 12 hours
  // 12 hours - Redis cache TTL matches update interval for stability
  private readonly PRICE_CACHE_TTL_MS = parseInt(
    process.env.PRICE_CACHE_TTL_MS || "43200000",
    10,
  ); // default 12 hours

  /**
   * Initialize the service and start periodic price updates
   */
  start(): void {
    console.log("🚀 CryptoRank v2 Service starting...");
    console.log(`📍 Using Solana ID: ${this.SOL_ID}`);
    if (!this.apiKey) {
      console.warn(
        "⚠️ CryptoRank API key not set. Set CRYPTORANK_API_KEY environment variable to enable live price fetches. Falling back to embedded/default cached price.",
      );
    }

    // Initial fetch (no esperar - solo iniciar en background)
    this.updateSolPrice().catch((err) => {
      console.error("❌ Initial CryptoRank fetch failed:", err.message);
    });

    // Schedule periodic updates every 12 hours
    this.updateInterval = setInterval(() => {
      this.updateSolPrice().catch((err) => {
        console.warn("⚠️ Periodic CryptoRank update failed:", err.message);
      });
    }, this.PRICE_UPDATE_INTERVAL_MS);

    console.log(
      `✅ CryptoRank v2 Service initialized (update interval: ${(this.PRICE_UPDATE_INTERVAL_MS / 1000 / 3600).toFixed(1)}h, cache TTL: ${(this.PRICE_CACHE_TTL_MS / 1000 / 3600).toFixed(1)}h)`,
    );
  }

  /**
   * Stop the service
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      console.log("🛑 CoinGecko Service stopped");
    }
  }

  /**
   * Fetch latest SOL/USD price from CryptoRank v2
   */
  private async updateSolPrice(): Promise<void> {
    if (this.isUpdating) {
      console.log("⏳ Price update already in progress, skipping...");
      return;
    }

    this.isUpdating = true;

    try {
      console.log(
        `📡 Fetching SOL price from CryptoRank v2 (ID: ${this.SOL_ID})...`,
      );
      const res = await axios.get(`${this.baseUrl}/currencies/${this.SOL_ID}`, {
        headers: {
          "X-API-Key": this.apiKey,
          Accept: "application/json",
        },
        timeout: 3000, // Reducido a 3 segundos (era 10s)
      });

      console.log(
        "📊 CryptoRank Response Keys:",
        Object.keys(res.data?.data || {}),
      );

      // CryptoRank v2 retorna estructura: { data: { price, symbol, name, ... } }
      const priceRaw = res.data?.data?.price;
      const solPrice =
        typeof priceRaw === "string" ? parseFloat(priceRaw) : priceRaw;

      if (!solPrice || typeof solPrice !== "number" || solPrice <= 0) {
        console.error("❌ Invalid price data:", {
          received: priceRaw,
          parsed: solPrice,
          data: res.data?.data,
        });
        throw new Error(`Invalid price received: ${solPrice}`);
      }

      const oldPrice = this.priceCache.price;
      this.priceCache.price = solPrice;
      this.priceCache.timestamp = Date.now();
      this.priceCache.updateCount++;

      // Write to Redis cache with 12h TTL for stability
      try {
        const payload = {
          solPriceUsd: this.priceCache.price,
          source: "cryptorank",
          timestamp: this.priceCache.timestamp,
          expiresAt: Date.now() + this.PRICE_CACHE_TTL_MS,
        };
        const ok = await setJson(
          "prowallet:solPrice",
          payload,
          this.PRICE_CACHE_TTL_MS,
        );
        if (ok) {
          console.log(
            `💾 Cached SOL price in Redis for ${(this.PRICE_CACHE_TTL_MS / 1000 / 3600).toFixed(1)}h: $${this.priceCache.price.toFixed(2)}`,
          );
        } else {
          console.warn("⚠️ Failed to write SOL price to Redis");
        }
      } catch (err) {
        console.warn(
          "⚠️ Error writing price to Redis:",
          err instanceof Error ? err.message : err,
        );
      }
      console.log(
        `✅ SOL/USD updated: $${oldPrice.toFixed(2)} → $${this.priceCache.price.toFixed(2)} (update #${this.priceCache.updateCount})`,
      );

      // Log cálculo de GAPC para debugging
      // GAPC siempre cuesta $0.01 USD, solo se convierte a SOL al momento del pago
      const gapcPriceInSol = 0.01 / this.priceCache.price;
      console.log(
        `💎 GAPC price: $0.01 USD = ${gapcPriceInSol.toFixed(9)} SOL (at SOL price $${this.priceCache.price.toFixed(2)})`,
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.warn(
        `⚠️ Failed to fetch SOL price (using cached $${this.priceCache.price.toFixed(2)}): ${errorMsg}`,
      );
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Get current SOL/USD price (cached)
   */
  getSolPriceUsd(): number {
    const price = this.priceCache.price;
    console.log(`💰 getSolPriceUsd() returning: $${price.toFixed(2)}`);
    return price;
  }

  /**
   * Get price with metadata
   */
  getPriceWithMetadata(): {
    price: number;
    timestamp: number;
    ageMs: number;
    updateCount: number;
  } {
    const ageMs = Date.now() - this.priceCache.timestamp;
    const result = {
      price: this.priceCache.price,
      timestamp: this.priceCache.timestamp,
      ageMs,
      updateCount: this.priceCache.updateCount,
    };
    console.log(`📊 getPriceWithMetadata():`, result);
    return result;
  }

  /**
   * Force immediate price update (for testing)
   */
  async forceUpdate(): Promise<number> {
    console.log("🔄 Force price update requested");
    await this.updateSolPrice();
    return this.priceCache.price;
  }

  async getTopCoins(limit: number = 10) {
    const res = await axios.get(`${this.baseUrl}/currencies`, {
      headers: {
        "X-API-Key": this.apiKey,
      },
      params: {
        limit: limit,
      },
      timeout: 10000,
    });
    return res.data;
  }

  async getCoinHistory(coinId: string, days: string = "30") {
    // CryptoRank v2 puede no tener histórico en este endpoint
    // Retornar datos básicos disponibles
    const res = await axios.get(`${this.baseUrl}/currencies/${coinId}`, {
      headers: {
        "X-API-Key": this.apiKey,
      },
      timeout: 10000,
    });
    return res.data;
  }
}

export const cryptorankService = new CryptoRankService();
// Backward compatibility
export const coingeckoService = cryptorankService;
