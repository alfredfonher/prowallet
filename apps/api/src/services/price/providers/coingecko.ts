/**
 * CoinGecko Provider - Free API, no authentication needed
 */
import axios from "axios";
import { PriceProvider } from "./types";

export class CoinGeckoProvider implements PriceProvider {
  private baseUrl = "https://api.coingecko.com/api/v3";
  private timeout = 5000; // 5 segundos - CoinGecko es rápido
  private maxRetries = 1; // Solo 1 reintento para ser más rápido

  async getPrice(symbol: string): Promise<number> {
    try {
      const id = this.mapSymbolToId(symbol);

      const url = `${this.baseUrl}/simple/price?ids=${id}&vs_currencies=usd`;

      // simple retry loop with delay
      let attempt = 0;
      let lastErr: any = null;
      while (attempt <= this.maxRetries) {
        try {
          const response = await axios.get(url, {
            timeout: this.timeout,
          });
          if (!response.data[id] || !response.data[id].usd) {
            throw new Error(`Invalid CoinGecko response for ${symbol}`);
          }
          const price = parseFloat(response.data[id].usd);
          if (!price || price <= 0) {
            throw new Error(`Invalid price value from CoinGecko: ${price}`);
          }
          return price;
        } catch (e) {
          lastErr = e;
          attempt++;
          if (attempt > this.maxRetries) break;
          // backoff corto: 200ms
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      throw lastErr;
    } catch (error) {
      throw new Error(
        `CoinGecko fetch failed for ${symbol}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  getName(): string {
    return "CoinGecko";
  }

  private mapSymbolToId(symbol: string): string {
    const mapping: { [key: string]: string } = {
      SOL: "solana",
      BTC: "bitcoin",
      ETH: "ethereum",
      GAPC: "gapcoin", // If available
    };
    return mapping[symbol.toUpperCase()] || symbol.toLowerCase();
  }
}
