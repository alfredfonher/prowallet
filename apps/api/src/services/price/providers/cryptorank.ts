/**
 * CryptoRank Provider - Paid API, premium source
 * Falls back to default if API key not configured
 */
import axios from "axios";
import { PriceProvider } from "./types";

export class CryptoRankProvider implements PriceProvider {
  private baseUrl = "https://api.cryptorank.io/v2";
  private apiKey = (
    process.env.CRYPTORANK_API_KEY ||
    process.env.CRYPTO_RANK_API_KEY ||
    ""
  ).trim();
  private timeout = 10000;
  private maxRetries = 2;

  async getPrice(symbol: string): Promise<number> {
    // Skip if no API key configured
    if (!this.apiKey) {
      throw new Error("CryptoRank API key not configured (CRYPTORANK_API_KEY)");
    }

    try {
      const id = this.mapSymbolToId(symbol);

      const url = `${this.baseUrl}/currencies/${id}`;

      const headers = {
        "X-API-Key": this.apiKey,
        Accept: "application/json",
      };
      let attempt = 0;
      let lastErr: any = null;
      while (attempt <= this.maxRetries) {
        try {
          const response = await axios.get(url, {
            headers,
            timeout: this.timeout,
          });
          if (!response.data.data || !response.data.data.price) {
            throw new Error(`Invalid CryptoRank response for ${symbol}`);
          }
          const price = parseFloat(response.data.data.price);
          if (!price || price <= 0) {
            throw new Error(`Invalid price value from CryptoRank: ${price}`);
          }
          return price;
        } catch (e) {
          lastErr = e;
          attempt++;
          if (attempt > this.maxRetries) break;
          const delay = 500 * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
      throw lastErr;
    } catch (error) {
      throw new Error(
        `CryptoRank fetch failed for ${symbol}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  getName(): string {
    return "CryptoRank";
  }

  private mapSymbolToId(symbol: string): string {
    // CryptoRank uses numeric IDs; map common symbols to IDs
    const mapping: { [key: string]: string } = {
      SOL: "5663", // Solana
      BTC: "1", // Bitcoin
      ETH: "2", // Ethereum
    };
    return mapping[symbol.toUpperCase()] || symbol;
  }
}
