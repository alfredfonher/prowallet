/**
 * RPC Configuration with Rate Limiting & Caching
 * Solves 429 "Too Many Requests" errors
 */

export const RPC_CONFIG = {
  // Usar Helius (RPC dedicado) en lugar de RPC público
  // Si no tienes API key, usar fallback a public RPC
  MAINNET_RPCS: [
    process.env.HELIUS_API_KEY
      ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
      : null,
    process.env.TRITON_API_KEY
      ? `https://mainnet.triton-rpc.com/?api-key=${process.env.TRITON_API_KEY}`
      : null,
    process.env.SOLANA_RPC_URL,
    "https://api.mainnet-beta.solana.com",
  ].filter(Boolean) as string[],

  DEVNET_RPCS: [
    process.env.HELIUS_API_KEY
      ? `https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
      : null,
    "https://api.devnet.solana.com",
  ].filter(Boolean) as string[],

  // Rate limiting configuration
  RATE_LIMIT: {
    // Máximo de requests simultaneos por RPC
    MAX_CONCURRENT: 5,
    // Delay entre requests (ms)
    REQUEST_DELAY: 100,
    // Timeout para request (ms)
    TIMEOUT: 30000,
    // Reintentos en caso de 429
    RETRIES: 3,
    // Backoff exponencial (ms)
    BACKOFF_BASE: 1000,
  },

  // Caching configuration
  CACHE: {
    // getLatestBlockhash cache (ms)
    BLOCKHASH_CACHE_TTL: 4000,
    // Balance cache (ms)
    BALANCE_CACHE_TTL: 10000,
    // Account info cache (ms)
    ACCOUNT_CACHE_TTL: 30000,
    // Rent exemption cache (ms)
    RENT_CACHE_TTL: 3600000, // 1 hora
  },

  // Método para obtener RPC actual
  getRpcUrl: (): string => {
    const network = process.env.SOLANA_NETWORK || "devnet";
    const rpcs =
      network === "devnet" ? RPC_CONFIG.DEVNET_RPCS : RPC_CONFIG.MAINNET_RPCS;
    return rpcs[0]; // En producción, implementar rotation
  },
};

/**
 * Cache manager para evitar múltiples llamadas RPC
 */
export class RpcCache {
  private static cache = new Map<string, { value: any; timestamp: number }>();

  static set(key: string, value: any, ttlMs: number) {
    this.cache.set(key, {
      value,
      timestamp: Date.now() + ttlMs,
    });
  }

  static get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.timestamp) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  static clear() {
    this.cache.clear();
  }

  static has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    if (Date.now() > item.timestamp) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }
}

/**
 * RPC Throttler - controla rate limiting
 */
export class RpcThrottler {
  private static lastRequestTime = 0;
  private static pendingRequests = 0;

  static async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Esperar si hay demasiadas peticiones pendientes
    while (this.pendingRequests >= RPC_CONFIG.RATE_LIMIT.MAX_CONCURRENT) {
      await new Promise((resolve) =>
        setTimeout(resolve, RPC_CONFIG.RATE_LIMIT.REQUEST_DELAY),
      );
    }

    this.pendingRequests++;

    try {
      // Esperar mínimo delay entre requests
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < RPC_CONFIG.RATE_LIMIT.REQUEST_DELAY) {
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            RPC_CONFIG.RATE_LIMIT.REQUEST_DELAY - timeSinceLastRequest,
          ),
        );
      }

      this.lastRequestTime = Date.now();

      // Ejecutar con reintentos y backoff exponencial
      return await this.executeWithRetries(fn);
    } finally {
      this.pendingRequests--;
    }
  }

  private static async executeWithRetries<T>(
    fn: () => Promise<T>,
    attempt = 0,
  ): Promise<T> {
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `RPC timeout after ${RPC_CONFIG.RATE_LIMIT.TIMEOUT}ms`,
                ),
              ),
            RPC_CONFIG.RATE_LIMIT.TIMEOUT,
          ),
        ),
      ]);
    } catch (error: any) {
      // Si es error 429 (Too Many Requests), reintentar con backoff
      if (
        error?.message?.includes?.("429") ||
        error?.status === 429 ||
        attempt < RPC_CONFIG.RATE_LIMIT.RETRIES
      ) {
        const backoffTime =
          RPC_CONFIG.RATE_LIMIT.BACKOFF_BASE * Math.pow(2, attempt);
        console.warn(
          `RPC rate limit hit, retrying in ${backoffTime}ms (attempt ${
            attempt + 1
          }/${RPC_CONFIG.RATE_LIMIT.RETRIES})`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
        return this.executeWithRetries(fn, attempt + 1);
      }
      throw error;
    }
  }
}
