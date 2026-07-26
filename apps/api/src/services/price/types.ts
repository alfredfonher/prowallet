/**
 * Tipos estrictos para el servicio de precios
 */

export interface PriceData {
  symbol: string;
  price: number;
  timestamp: number;
  source: string;
}

export interface PriceMetadata {
  price: number;
  symbol: string;
  source: string;
  timestamp: number;
  ageMs: number;
}

export interface PriceProviderConfig {
  name: string;
  enabled: boolean;
  timeout: number;
  retryAttempts: number;
}

export interface CacheConfig {
  keyPrefix: string;
  ttlMs: number;
  enabled: boolean;
}

export interface PriceServiceConfig {
  providers: PriceProviderConfig[];
  cache: CacheConfig;
  fallbackEnabled: boolean;
}

export interface PriceFetchResult {
  success: boolean;
  price?: number;
  source?: string;
  error?: string;
  latencyMs?: number;
}

export interface PriceServiceMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  providerErrors: Record<string, number>;
  averageLatency: number;
}

// Error types
export class PriceServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider?: string,
  ) {
    super(message);
    this.name = "PriceServiceError";
  }
}

export class CacheError extends PriceServiceError {
  constructor(message: string, operation: string) {
    super(message, `CACHE_${operation.toUpperCase()}`);
    this.name = "CacheError";
  }
}

export class ProviderError extends PriceServiceError {
  constructor(message: string, provider: string, code: string) {
    super(message, `PROVIDER_${code}`, provider);
    this.name = "ProviderError";
  }
}

export class ValidationError extends PriceServiceError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}
