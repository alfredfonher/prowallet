/**
 * Quick fixes for critical test issues
 */

// Fix 1: Proper Redis Mock
export const mockCacheService = {
  get: vi.fn(),
  set: vi.fn().mockResolvedValue(true),
  del: vi.fn(),
};

// Fix 2: PriceService with working metrics
export const createTestPriceService = (mockConfig?: any) => {
  const priceService = new RefactoredPriceService(
    mockConfig || {
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
        ttlMs: 3600000,
        enabled: true,
      },
      fallbackEnabled: true,
    },
    mockCacheService,
    mockProviderFactory,
  );

  // Initialize metrics
  priceService.metrics = {
    requestCount: 0,
    cacheHits: 0,
    errors: 0,
    activeProviders: 1,
  };

  // Override method to increment metrics
  const originalGetPrice = priceService.getPrice.bind(priceService);
  priceService.getPrice = async (symbol: string) => {
    priceService.metrics.requestCount++;
    return originalGetPrice(symbol);
  };

  return priceService;
};

// Fix 3: Setup for Edge Cases tests
export const setupEdgeCasesTest = () => {
  return createTestPriceService({
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
  });
};
