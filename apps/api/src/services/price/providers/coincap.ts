/**
 * CoinCap Provider - Free API, fast and reliable
 */
import axios from "axios";
import { PriceProvider } from "./types";

export class CoinCapProvider implements PriceProvider {
  private baseUrl = "https://api.coincap.io/v2";
  private timeout = 10000;
  private maxRetries = 2;

  async getPrice(symbol: string): Promise<number> {
    const id = this.mapSymbolToId(symbol);
    const url = `${this.baseUrl}/assets/${id}`;
    let attempt = 0;
    let lastErr: any = null;
    while (attempt <= this.maxRetries) {
      try {
        const response = await axios.get(url, {
          timeout: this.timeout,
        });
        if (!response.data.data || !response.data.data.priceUsd) {
          throw new Error(`Invalid CoinCap response for ${symbol}`);
        }
        const price = parseFloat(response.data.data.priceUsd);
        if (!price || price <= 0) {
          throw new Error(`Invalid price value from CoinCap: ${price}`);
        }
        return price;
      } catch (error) {
        lastErr = error;
        attempt++;
        if (attempt > this.maxRetries) break;
        const delay = 500 * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error(
      `CoinCap fetch failed for ${symbol}: ${lastErr instanceof Error ? lastErr.message : lastErr}`,
    );
  }

  getName(): string {
    return "CoinCap";
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
