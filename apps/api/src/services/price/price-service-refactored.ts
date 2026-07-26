/**
 * Servicio de precios refactorizado
 * Aplicando principios SOLID, early returns y manejo robusto de errores
 */

import { PriceProvider } from "./providers/types";
import { CryptoRankProvider } from "./providers/cryptorank";
import { CoinGeckoProvider } from "./providers/coingecko";
import { CoinCapProvider } from "./providers/coincap";
import { setJson, getJson } from "../redis.service";
import {
  PriceData,
  PriceMetadata,
  PriceServiceConfig,
  PriceFetchResult,
  PriceServiceMetrics,
  PriceServiceError,
  CacheError,
  ProviderError,
  ValidationError,
} from "./types";
import {
  validateSymbol,
  validatePrice,
  validateCacheKey,
  formatSymbol,
  buildCacheKey,
  isCacheExpired,
  parseCacheData,
  createPriceLogger,
  createErrorHandler,
  calculateLatency,
  withTimeout,
} from "./validators";

/**
 * Interfaz para inyección de dependencias (Dependency Inversion)
 */
export interface ICacheService {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttlMs?: number): Promise<boolean>;
}

export interface IPriceProviderFactory {
  createProviders(): PriceProvider[];
}

/**
 * Implementación por defecto de cache service
 */
export class RedisCacheService implements ICacheService {
  constructor(private logger: ReturnType<typeof createPriceLogger>) {}

  async get(key: string): Promise<any> {
    try {
      validateCacheKey(key);
      const data = await getJson(key);
      return data;
    } catch (error) {
      throw new CacheError(
        `Error getting cache key ${key}: ${error instanceof Error ? error.message : "Unknown error"}`,
        "GET",
      );
    }
  }

  async set(key: string, value: any, ttlMs?: number): Promise<boolean> {
    try {
      validateCacheKey(key);
      const result = await setJson(key, value, ttlMs || null);
      return result;
    } catch (error) {
      throw new CacheError(
        `Error setting cache key ${key}: ${error instanceof Error ? error.message : "Unknown error"}`,
        "SET",
      );
    }
  }
}

/**
 * Factory por defecto de providers
 */
export class DefaultPriceProviderFactory implements IPriceProviderFactory {
  createProviders(): PriceProvider[] {
    return [
      new CryptoRankProvider(),
      new CoinGeckoProvider(),
      new CoinCapProvider(),
    ];
  }
}

/**
 * Servicio de precios refactorizado
 * Principio: Single Responsibility
 */
export class RefactoredPriceService {
  private readonly config: PriceServiceConfig;
  private readonly cacheService: ICacheService;
  private readonly providerFactory: IPriceProviderFactory;
  private readonly logger: ReturnType<typeof createPriceLogger>;
  private readonly handleError: ReturnType<typeof createErrorHandler>;
  private readonly metrics: PriceServiceMetrics;

  constructor(
    config?: Partial<PriceServiceConfig>,
    cacheService?: ICacheService,
    providerFactory?: IPriceProviderFactory,
  ) {
    this.config = this.createDefaultConfig(config);
    this.cacheService =
      cacheService || new RedisCacheService(createPriceLogger());
    this.providerFactory = providerFactory || new DefaultPriceProviderFactory();
    this.logger = createPriceLogger();
    this.handleError = createErrorHandler(this.logger);
    this.metrics = this.initializeMetrics();
  }

  /**
   * Obtener precio con early returns y validación robusta
   */
  async getPrice(symbol: string): Promise<number> {
    const startTime = Date.now();

    try {
      // Early return para validación
      validateSymbol(symbol);
      const formattedSymbol = formatSymbol(symbol);

      this.logger.log(`Getting price for ${formattedSymbol}`);

      // 1. Intentar cache con early return
      const cachedPrice = await this.getCachedPrice(formattedSymbol);
      if (cachedPrice !== null) {
        this.metrics.cacheHits++;
        this.logger.log(`Price from cache: $${cachedPrice}`);
        return cachedPrice;
      }

      this.metrics.cacheMisses++;

      // 2. Obtener de providers con fallback
      const freshPrice = await this.fetchFromProviders(formattedSymbol);

      // 3. Actualizar cache (no bloquear el retorno)
      this.updateCacheInBackground(formattedSymbol, freshPrice);

      this.metrics.totalRequests++;
      this.metrics.averageLatency = calculateLatency(startTime);

      return freshPrice;
    } catch (error) {
      this.metrics.totalRequests++;
      throw this.handleError(error, `getPrice(${symbol})`);
    }
  }

  /**
   * Obtener precio con metadata
   */
  async getPriceWithMetadata(symbol: string): Promise<PriceMetadata> {
    const startTime = Date.now();

    try {
      validateSymbol(symbol);
      const formattedSymbol = formatSymbol(symbol);

      // Intentar cache primero
      const cached = await this.getCachedPriceWithMetadata(formattedSymbol);
      if (cached) {
        return cached;
      }

      // Obtener precio fresco
      const price = await this.getPrice(formattedSymbol);

      return {
        price,
        symbol: formattedSymbol,
        source: "live-fetch",
        timestamp: Date.now(),
        ageMs: 0,
      };
    } catch (error) {
      throw this.handleError(error, `getPriceWithMetadata(${symbol})`);
    }
  }

  /**
   * Forzar refresh con early returns
   */
  async forceRefresh(symbol: string): Promise<number> {
    const startTime = Date.now();

    try {
      validateSymbol(symbol);
      const formattedSymbol = formatSymbol(symbol);

      this.logger.log(`Force refreshing ${formattedSymbol}`);

      const freshPrice = await this.fetchFromProviders(formattedSymbol);

      // Actualizar cache inmediatamente
      await this.updateCache(formattedSymbol, freshPrice);

      this.metrics.totalRequests++;
      this.metrics.averageLatency = calculateLatency(startTime);

      return freshPrice;
    } catch (error) {
      // Intentar fallback a cache con early return
      const cachedPrice = await this.getCachedPriceAsFallback(symbol);
      if (cachedPrice !== null) {
        this.logger.warn(
          `All providers failed, returning cached price for ${symbol}`,
        );
        return cachedPrice;
      }

      throw this.handleError(error, `forceRefresh(${symbol})`);
    }
  }

  /**
   * Obtener métricas del servicio
   */
  getMetrics(): PriceServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Obtener lista de providers activos
   */
  getActiveProviders(): string[] {
    return this.providerFactory
      .createProviders()
      .filter(
        (provider) =>
          this.config.providers.find((p) => p.name === provider.getName())
            ?.enabled,
      )
      .map((provider) => provider.getName());
  }

  // Métodos privados con early returns

  private createDefaultConfig(
    override?: Partial<PriceServiceConfig>,
  ): PriceServiceConfig {
    return {
      providers: [
        { name: "cryptorank", enabled: true, timeout: 5000, retryAttempts: 2 },
        { name: "coingecko", enabled: true, timeout: 5000, retryAttempts: 2 },
        { name: "coincap", enabled: true, timeout: 5000, retryAttempts: 2 },
      ],
      cache: {
        keyPrefix: "prowallet:price",
        ttlMs: parseInt(process.env.PRICE_CACHE_TTL_MS || "43200000", 10), // 12h
        enabled: true,
      },
      fallbackEnabled: true,
      ...override,
    };
  }

  private initializeMetrics(): PriceServiceMetrics {
    return {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      providerErrors: {},
      averageLatency: 0,
    };
  }

  private async getCachedPrice(symbol: string): Promise<number | null> {
    if (!this.config.cache.enabled) {
      return null;
    }

    try {
      const cacheKey = buildCacheKey(this.config.cache.keyPrefix, symbol);
      const cached = await this.cacheService.get(cacheKey);

      if (!cached || !cached.price || cached.price <= 0) {
        return null;
      }

      if (isCacheExpired(cached.timestamp, this.config.cache.ttlMs)) {
        return null;
      }

      return validatePrice(cached.price);
    } catch (error) {
      this.logger.warn("Cache read error", error);
      return null;
    }
  }

  private async getCachedPriceWithMetadata(
    symbol: string,
  ): Promise<PriceMetadata | null> {
    if (!this.config.cache.enabled) {
      return null;
    }

    try {
      const cacheKey = buildCacheKey(this.config.cache.keyPrefix, symbol);
      const cached = await this.cacheService.get(cacheKey);

      if (!cached || !cached.price || cached.price <= 0) {
        return null;
      }

      return {
        price: validatePrice(cached.price),
        symbol: cached.symbol || symbol,
        source: cached.source || "redis-cache",
        timestamp: cached.timestamp || Date.now(),
        ageMs: Date.now() - (cached.timestamp || Date.now()),
      };
    } catch (error) {
      this.logger.warn("Cache metadata read error", error);
      return null;
    }
  }

  private async fetchFromProviders(symbol: string): Promise<number> {
    const providers = this.providerFactory.createProviders();
    const enabledProviders = providers.filter(
      (provider) =>
        this.config.providers.find((p) => p.name === provider.getName())
          ?.enabled,
    );

    for (const provider of enabledProviders) {
      try {
        const result = await this.fetchFromProvider(provider, symbol);

        if (result.success && result.price) {
          this.logger.log(`Price from ${provider.getName()}: $${result.price}`);
          return result.price;
        }
      } catch (error) {
        this.logger.warn(`Provider ${provider.getName()} failed`, error);
        this.metrics.providerErrors[provider.getName()] =
          (this.metrics.providerErrors[provider.getName()] || 0) + 1;
      }
    }

    throw new PriceServiceError(
      `All providers failed for ${symbol}`,
      "ALL_PROVIDERS_FAILED",
    );
  }

  private async fetchFromProvider(
    provider: PriceProvider,
    symbol: string,
  ): Promise<PriceFetchResult> {
    const providerConfig = this.config.providers.find(
      (p) => p.name === provider.getName(),
    );

    if (!providerConfig || !providerConfig.enabled) {
      throw new ProviderError(
        `Provider ${provider.getName()} not enabled`,
        provider.getName(),
        "DISABLED",
      );
    }

    const startTime = Date.now();

    try {
      const price = await withTimeout(
        provider.getPrice(symbol),
        providerConfig.timeout,
        `Provider ${provider.getName()} timeout`,
      );

      const validatedPrice = validatePrice(price);

      return {
        success: true,
        price: validatedPrice,
        source: provider.getName(),
        latencyMs: calculateLatency(startTime),
      };
    } catch (error) {
      throw new ProviderError(
        `Provider ${provider.getName()} failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        provider.getName(),
        "FETCH_FAILED",
      );
    }
  }

  private async updateCache(symbol: string, price: number): Promise<void> {
    if (!this.config.cache.enabled) {
      return;
    }

    try {
      const cacheKey = buildCacheKey(this.config.cache.keyPrefix, symbol);
      const payload: PriceData = {
        symbol,
        price,
        timestamp: Date.now(),
        source: "price-service",
      };

      await this.cacheService.set(cacheKey, payload, this.config.cache.ttlMs);
    } catch (error) {
      this.logger.warn("Cache update error", error);
    }
  }

  private async updateCacheInBackground(
    symbol: string,
    price: number,
  ): Promise<void> {
    // Ejecutar en background sin bloquear
    this.updateCache(symbol, price).catch((error) => {
      this.logger.warn("Background cache update failed", error);
    });
  }

  private async getCachedPriceAsFallback(
    symbol: string,
  ): Promise<number | null> {
    try {
      return await this.getCachedPrice(symbol);
    } catch (error) {
      this.logger.warn("Fallback cache read failed", error);
      return null;
    }
  }
}

// Export singleton instance para compatibilidad
export const refactoredPriceService = new RefactoredPriceService();
