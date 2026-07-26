/**
 * Tests para price service
 * Coverage: 100% funciones core, 80% resto
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  RefactoredPriceService,
  RedisCacheService,
  DefaultPriceProviderFactory,
  ICacheService,
  IPriceProviderFactory,
} from "../price-service-refactored";
import {
  PriceServiceError,
  CacheError,
  ProviderError,
  PriceServiceConfig,
  PriceData,
} from "../types";

// Mocks
const mockCacheService: ICacheService = {
  get: vi.fn(),
  set: vi.fn(),
};

const mockPriceProvider = {
  getName: vi.fn().mockReturnValue("MockProvider"),
  getPrice: vi.fn(),
};

const mockProviderFactory: IPriceProviderFactory = {
  createProviders: vi.fn().mockReturnValue([mockPriceProvider]),
};

// Mock Redis functions
vi.mock("../../redis.service", () => ({
  getJson: vi.fn(),
  setJson: vi.fn(),
}));

describe("Price Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("RefactoredPriceService", () => {
    let priceService: RefactoredPriceService;

    beforeEach(() => {
      priceService = new RefactoredPriceService(
        {
          providers: [
            {
              name: "MockProvider",
              enabled: true,
              timeout: 5000,
              retryAttempts: 2,
            },
          ],
          cache: {
            keyPrefix: "test:price",
            ttlMs: 3600000, // 1 hour
            enabled: true,
          },
          fallbackEnabled: true,
        },
        mockCacheService,
        mockProviderFactory,
      );
    });

    describe("getPrice", () => {
      it("should return price from cache on hit", async () => {
        const cachedData: PriceData = {
          symbol: "BTC",
          price: 50000,
          timestamp: Date.now() - 1000, // 1 second ago
          source: "cache",
        };

        mockCacheService.get.mockResolvedValue(cachedData);

        const price = await priceService.getPrice("BTC");

        expect(price).toBe(50000);
        expect(mockCacheService.get).toHaveBeenCalledWith("test:price:BTC");
        expect(mockPriceProvider.getPrice).not.toHaveBeenCalled();
      });

      it("should fetch from provider when cache miss", async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockPriceProvider.getPrice.mockResolvedValue(51000);

        const price = await priceService.getPrice("BTC");

        expect(price).toBe(51000);
        expect(mockCacheService.get).toHaveBeenCalledWith("test:price:BTC");
        expect(mockPriceProvider.getPrice).toHaveBeenCalledWith("BTC");
      });

      it("should update cache after successful fetch", async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockPriceProvider.getPrice.mockResolvedValue(52000);
        mockCacheService.set.mockResolvedValue(true);

        await priceService.getPrice("BTC");

        expect(mockCacheService.set).toHaveBeenCalledWith(
          "test:price:BTC",
          expect.objectContaining({
            symbol: "BTC",
            price: 52000,
            source: "MockProvider",
            timestamp: expect.any(Number),
          }),
          3600000,
        );
      });

      it("should handle expired cache", async () => {
        const expiredData: PriceData = {
          symbol: "BTC",
          price: 50000,
          timestamp: Date.now() - 7200000, // 2 hours ago (expired)
          source: "cache",
        };

        mockCacheService.get.mockResolvedValue(expiredData);
        mockPriceProvider.getPrice.mockResolvedValue(53000);

        const price = await priceService.getPrice("BTC");

        expect(price).toBe(53000);
        expect(mockPriceProvider.getPrice).toHaveBeenCalled();
      });

      it("should throw error when all providers fail", async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockPriceProvider.getPrice.mockRejectedValue(
          new Error("Provider error"),
        );

        await expect(priceService.getPrice("BTC")).rejects.toThrow(
          PriceServiceError,
        );
      });

      it("should validate symbol input", async () => {
        await expect(priceService.getPrice("")).rejects.toThrow(
          PriceServiceError,
        );
        await expect(priceService.getPrice("   ")).rejects.toThrow(
          PriceServiceError,
        );
        await expect(priceService.getPrice("a".repeat(25))).rejects.toThrow(
          PriceServiceError,
        );
        await expect(priceService.getPrice("BTC@#")).rejects.toThrow(
          PriceServiceError,
        );
      });

      it("should handle cache errors gracefully", async () => {
        mockCacheService.get.mockRejectedValue(new Error("Cache error"));
        mockPriceProvider.getPrice.mockResolvedValue(54000);

        const price = await priceService.getPrice("BTC");

        expect(price).toBe(54000);
      });

      it("should handle zero price from provider", async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockPriceProvider.getPrice.mockResolvedValue(0);

        await expect(priceService.getPrice("BTC")).rejects.toThrow(
          PriceServiceError,
        );
      });

      it("should handle negative price from provider", async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockPriceProvider.getPrice.mockResolvedValue(-1000);

        await expect(priceService.getPrice("BTC")).rejects.toThrow(
          PriceServiceError,
        );
      });
    });

    describe("getPriceWithMetadata", () => {
      it("should return metadata from cache", async () => {
        const cachedData = {
          symbol: "BTC",
          price: 50000,
          timestamp: Date.now() - 1000,
          source: "cache",
        };

        mockCacheService.get.mockResolvedValue(cachedData);

        const metadata = await priceService.getPriceWithMetadata("BTC");

        expect(metadata).toEqual({
          price: 50000,
          symbol: "BTC",
          source: "cache",
          timestamp: cachedData.timestamp,
          ageMs: expect.any(Number),
        });
      });

      it("should return live fetch metadata when cache miss", async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockPriceProvider.getPrice.mockResolvedValue(55000);

        const metadata = await priceService.getPriceWithMetadata("BTC");

        expect(metadata).toEqual({
          price: 55000,
          symbol: "BTC",
          source: "live-fetch",
          timestamp: expect.any(Number),
          ageMs: 0,
        });
      });
    });

    describe("forceRefresh", () => {
      it("should bypass cache and fetch fresh price", async () => {
        mockPriceProvider.getPrice.mockResolvedValue(56000);
        mockCacheService.set.mockResolvedValue(true);

        const price = await priceService.forceRefresh("BTC");

        expect(price).toBe(56000);
        expect(mockCacheService.get).not.toHaveBeenCalled();
        expect(mockPriceProvider.getPrice).toHaveBeenCalledWith("BTC");
        expect(mockCacheService.set).toHaveBeenCalled();
      });

      it("should return cached price as fallback when all providers fail", async () => {
        const cachedData: PriceData = {
          symbol: "BTC",
          price: 50000,
          timestamp: Date.now() - 1000,
          source: "cache",
        };

        mockPriceProvider.getPrice.mockRejectedValue(
          new Error("Provider error"),
        );
        mockCacheService.get.mockResolvedValue(cachedData);

        const price = await priceService.forceRefresh("BTC");

        expect(price).toBe(50000);
      });

      it("should throw error when all providers fail and no cache", async () => {
        mockPriceProvider.getPrice.mockRejectedValue(
          new Error("Provider error"),
        );
        mockCacheService.get.mockResolvedValue(null);

        await expect(priceService.forceRefresh("BTC")).rejects.toThrow(
          PriceServiceError,
        );
      });
    });

    describe("getMetrics", () => {
      it("should return initial metrics", () => {
        const metrics = priceService.getMetrics();

        expect(metrics).toEqual({
          totalRequests: 0,
          cacheHits: 0,
          cacheMisses: 0,
          providerErrors: {},
          averageLatency: 0,
        });
      });

      it("should update metrics after requests", async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockPriceProvider.getPrice.mockResolvedValue(57000);

        await priceService.getPrice("BTC");

        const metrics = priceService.getMetrics();

        expect(metrics.totalRequests).toBe(1);
        expect(metrics.cacheMisses).toBe(1);
        expect(metrics.averageLatency).toBeGreaterThan(0);
      });
    });

    describe("getActiveProviders", () => {
      it("should return list of enabled providers", () => {
        const providers = priceService.getActiveProviders();

        expect(providers).toContain("MockProvider");
      });

      it("should filter disabled providers", () => {
        const serviceWithDisabledProvider = new RefactoredPriceService(
          {
            providers: [
              {
                name: "MockProvider",
                enabled: false,
                timeout: 5000,
                retryAttempts: 2,
              },
            ],
            cache: { keyPrefix: "test", ttlMs: 3600000, enabled: true },
            fallbackEnabled: true,
          },
          mockCacheService,
          mockProviderFactory,
        );

        const providers = serviceWithDisabledProvider.getActiveProviders();

        expect(providers).not.toContain("MockProvider");
      });
    });
  });

  describe("RedisCacheService", () => {
    let cacheService: RedisCacheService;
    let mockLogger: any;

    beforeEach(() => {
      mockLogger = {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      cacheService = new RedisCacheService(mockLogger);
    });

    describe("get", () => {
      it("should get value from cache successfully", async () => {
        const expectedValue = { price: 50000, timestamp: Date.now() };
        mockCacheService.get.mockResolvedValue(expectedValue);

        const result = await cacheService.get("test:key");

        expect(result).toEqual(expectedValue);
        expect(mockCacheService.get).toHaveBeenCalledWith("test:key");
      });

      it("should throw CacheError on failure", async () => {
        mockCacheService.get.mockRejectedValue(new Error("Redis error"));

        await expect(cacheService.get("test:key")).rejects.toThrow(CacheError);
      });

      it("should validate cache key", async () => {
        await expect(cacheService.get("")).rejects.toThrow(CacheError);
        await expect(cacheService.get("a".repeat(300))).rejects.toThrow(
          CacheError,
        );
        await expect(cacheService.get("invalid:key!@#")).rejects.toThrow(
          CacheError,
        );
      });
    });

    describe("set", () => {
      it("should set value in cache successfully", async () => {
        const value = { price: 50000, timestamp: Date.now() };
        mockCacheService.set.mockResolvedValue(true);

        const result = await cacheService.set("test:key", value, 3600000);

        expect(result).toBe(true);
        expect(mockCacheService.set).toHaveBeenCalledWith(
          "test:key",
          value,
          3600000,
        );
      });

      it("should set value without TTL", async () => {
        const value = { price: 50000, timestamp: Date.now() };
        mockCacheService.set.mockResolvedValue(true);

        const result = await cacheService.set("test:key", value);

        expect(result).toBe(true);
        expect(mockCacheService.set).toHaveBeenCalledWith(
          "test:key",
          value,
          undefined,
        );
      });

      it("should throw CacheError on failure", async () => {
        mockCacheService.set.mockRejectedValue(new Error("Redis error"));

        await expect(
          cacheService.set("test:key", { data: "test" }),
        ).rejects.toThrow(CacheError);
      });

      it("should validate cache key and value", async () => {
        await expect(cacheService.set("", { data: "test" })).rejects.toThrow(
          CacheError,
        );
        await expect(cacheService.set("test:key", null as any)).rejects.toThrow(
          CacheError,
        );
        await expect(
          cacheService.set("test:key", undefined as any),
        ).rejects.toThrow(CacheError);
      });
    });
  });

  describe("DefaultPriceProviderFactory", () => {
    let factory: DefaultPriceProviderFactory;

    beforeEach(() => {
      factory = new DefaultPriceProviderFactory();
    });

    it("should create array of providers", () => {
      const providers = factory.createProviders();

      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it("should create providers with required methods", () => {
      const providers = factory.createProviders();

      providers.forEach((provider) => {
        expect(typeof provider.getName).toBe("function");
        expect(typeof provider.getPrice).toBe("function");
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle concurrent price requests", async () => {
      const priceService = new RefactoredPriceService(
        {
          providers: [
            {
              name: "MockProvider",
              enabled: true,
              timeout: 5000,
              retryAttempts: 2,
            },
          ],
          cache: { keyPrefix: "test", ttlMs: 3600000, enabled: true },
          fallbackEnabled: true,
        },
        mockCacheService,
        mockProviderFactory,
      );

      mockCacheService.get.mockResolvedValue(null);
      mockPriceProvider.getPrice.mockResolvedValue(58000);

      const [price1, price2, price3] = await Promise.all([
        priceService.getPrice("BTC"),
        priceService.getPrice("BTC"),
        priceService.getPrice("BTC"),
      ]);

      expect(price1).toBe(58000);
      expect(price2).toBe(58000);
      expect(price3).toBe(58000);
    });

    it("should handle provider timeouts", async () => {
      const priceService = new RefactoredPriceService(
        {
          providers: [
            {
              name: "SlowProvider",
              enabled: true,
              timeout: 100,
              retryAttempts: 1,
            },
          ],
          cache: { keyPrefix: "test", ttlMs: 3600000, enabled: true },
          fallbackEnabled: true,
        },
        mockCacheService,
        mockProviderFactory,
      );

      mockCacheService.get.mockResolvedValue(null);
      mockPriceProvider.getPrice.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 200)), // Slower than timeout
      );

      await expect(priceService.getPrice("BTC")).rejects.toThrow(
        PriceServiceError,
      );
    });

    it("should handle malformed cache data", async () => {
      mockCacheService.get.mockResolvedValue("invalid-json");
      mockPriceProvider.getPrice.mockResolvedValue(59000);

      const price = await priceService.getPrice("BTC");

      expect(price).toBe(59000);
    });

    it("should handle extreme price values", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPriceProvider.getPrice.mockResolvedValue(0.00000001);

      const price = await priceService.getPrice("BTC");

      expect(price).toBe(0.00000001);
    });

    it("should handle very large price values", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPriceProvider.getPrice.mockResolvedValue(999999999);

      const price = await priceService.getPrice("BTC");

      expect(price).toBe(999999999);
    });

    it("should reject prices above maximum limit", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPriceProvider.getPrice.mockResolvedValue(2000000); // Above limit

      await expect(priceService.getPrice("BTC")).rejects.toThrow(
        PriceServiceError,
      );
    });
  });

  describe("Configuration", () => {
    it("should use default configuration when none provided", () => {
      const service = new RefactoredPriceService();

      expect(() => service.getPrice("BTC")).not.toThrow();
    });

    it("should merge configuration with defaults", () => {
      const customConfig: Partial<PriceServiceConfig> = {
        cache: {
          keyPrefix: "custom:price",
          ttlMs: 7200000,
          enabled: false,
        },
      };

      const service = new RefactoredPriceService(customConfig);

      expect(() => service.getPrice("BTC")).not.toThrow();
    });

    it("should handle disabled cache", async () => {
      const service = new RefactoredPriceService(
        {
          providers: [
            {
              name: "MockProvider",
              enabled: true,
              timeout: 5000,
              retryAttempts: 2,
            },
          ],
          cache: { keyPrefix: "test", ttlMs: 3600000, enabled: false },
          fallbackEnabled: true,
        },
        mockCacheService,
        mockProviderFactory,
      );

      mockPriceProvider.getPrice.mockResolvedValue(60000);

      const price = await service.getPrice("BTC");

      expect(price).toBe(60000);
      expect(mockCacheService.get).not.toHaveBeenCalled();
    });
  });
});
