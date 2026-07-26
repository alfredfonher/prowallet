/**
 * Mocks para dependencias externas
 * Solana, Redis, API clients, etc.
 */

import { vi } from "vitest";

// Mock para @solana/web3.js
export const mockSolanaWeb3 = {
  PublicKey: vi.fn().mockImplementation((key: string) => ({
    toString: () => key,
    toBase58: () => key,
    toBuffer: () => Buffer.from(key, "utf8"),
  })),
  Transaction: vi.fn().mockImplementation(() => ({
    serialize: vi.fn().mockReturnValue(Buffer.from("mock-transaction")),
    add: vi.fn(),
    sign: vi.fn(),
    verifySignatures: vi.fn().mockReturnValue(true),
  })),
  SystemProgram: {
    transfer: vi.fn(),
    createAccount: vi.fn(),
    assign: vi.fn(),
  },
  LAMPORTS_PER_SOL: 1000000000,
  Connection: vi.fn().mockImplementation(() => ({
    getBalance: vi.fn().mockResolvedValue(100000000),
    getAccountInfo: vi.fn().mockResolvedValue(null),
    getTransaction: vi.fn().mockResolvedValue(null),
    sendRawTransaction: vi.fn().mockResolvedValue("mock-signature"),
    confirmTransaction: vi.fn().mockResolvedValue({ value: { err: null } }),
    requestAirdrop: vi.fn().mockResolvedValue("mock-signature"),
  })),
  Keypair: {
    generate: vi.fn().mockReturnValue({
      publicKey: { toString: () => "mock-public-key" },
      secretKey: Buffer.from("mock-secret-key"),
    }),
    fromSecretKey: vi.fn(),
  },
  sendAndConfirmTransaction: vi.fn().mockResolvedValue(["mock-signature"]),
};

// Mock para @solana/wallet-adapter-react
export const mockWalletAdapter = {
  useConnection: vi.fn().mockReturnValue({
    connection: mockSolanaWeb3.Connection(),
  }),
  useWallet: vi.fn().mockReturnValue({
    publicKey: mockSolanaWeb3.PublicKey("mock-public-key"),
    connected: true,
    connecting: false,
    disconnecting: false,
    wallet: {
      adapter: {
        name: "MockWallet",
        publicKey: mockSolanaWeb3.PublicKey("mock-public-key"),
        connected: true,
        connect: vi.fn(),
        disconnect: vi.fn(),
        signTransaction: vi
          .fn()
          .mockResolvedValue(mockSolanaWeb3.Transaction()),
        signAllTransactions: vi
          .fn()
          .mockResolvedValue([mockSolanaWeb3.Transaction()]),
      },
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    select: vi.fn(),
    sendTransaction: vi.fn().mockResolvedValue("mock-signature"),
    signTransaction: vi.fn().mockResolvedValue(mockSolanaWeb3.Transaction()),
  }),
  WalletProvider: ({ children }: { children: React.ReactNode }) => children,
  ConnectionProvider: ({ children }: { children: React.ReactNode }) => children,
};

// Mock para Redis
export const mockRedis = {
  createClient: vi.fn().mockReturnValue({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    isOpen: false,
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(-1),
    flushAll: vi.fn().mockResolvedValue("OK"),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
  }),
};

// Mock para API client
export const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  patch: vi.fn(),
};

// Mock para fetch global
export const mockFetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(""),
    headers: new Headers(),
    url: "https://mock-url.com",
  } as Response),
);

// Mock para WebSocket
export const mockWebSocket = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}));

// Mock para localStorage
export const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

// Mock para sessionStorage
export const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

// Mock para price providers
export const mockPriceProviders = {
  CryptoRankProvider: vi.fn().mockImplementation(() => ({
    getName: () => "CryptoRank",
    getPrice: vi.fn().mockResolvedValue(50000),
  })),
  CoinGeckoProvider: vi.fn().mockImplementation(() => ({
    getName: () => "CoinGecko",
    getPrice: vi.fn().mockResolvedValue(51000),
  })),
  CoinCapProvider: vi.fn().mockImplementation(() => ({
    getName: () => "CoinCap",
    getPrice: vi.fn().mockResolvedValue(52000),
  })),
};

// Mock para payment processors
export const mockPaymentProcessors = {
  StripeProcessor: vi.fn().mockImplementation(() => ({
    getName: () => "Stripe",
    createPayment: vi.fn().mockResolvedValue({
      success: true,
      paymentId: "stripe-payment-id",
      clientSecret: "stripe-client-secret",
    }),
    verifyPayment: vi.fn().mockResolvedValue({
      success: true,
      status: "completed",
    }),
    handleWebhook: vi.fn().mockResolvedValue({
      success: true,
      processed: true,
    }),
  })),
  SolanaProcessor: vi.fn().mockImplementation(() => ({
    getName: () => "Solana",
    createPayment: vi.fn().mockResolvedValue({
      success: true,
      transactionId: "solana-tx-id",
      signature: "solana-signature",
    }),
    verifyPayment: vi.fn().mockResolvedValue({
      success: true,
      confirmed: true,
    }),
    handleWebhook: vi.fn().mockResolvedValue({
      success: true,
      processed: true,
    }),
  })),
};

// Mock para logger
export const mockLogger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(),
};

// Set child to return itself to avoid circular reference
mockLogger.child.mockReturnValue(mockLogger);

// Mock para config
export const mockConfig = {
  api: {
    baseUrl: "https://api.mock.com",
    endpoints: {
      purchaseInitiate: "/api/purchase/initiate",
      purchaseSettle: "/api/purchase/settle",
      priceQuote: "/api/price/quote",
      paymentMethods: "/api/payment-methods",
      transactionHistory: "/api/transactions",
    },
    timeout: 30000,
    retries: 3,
  },
  solana: {
    network: "mainnet-beta",
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  },
  redis: {
    url: "redis://localhost:6379",
    keyPrefix: "prowallet",
    ttl: 3600000,
  },
  logging: {
    level: "info",
    format: "json",
  },
};

// Mock para environment variables
export const mockEnv = {
  NODE_ENV: "test",
  REDIS_URL: "redis://localhost:6379",
  SOLANA_NETWORK: "testnet",
  SOLANA_RPC_URL: "https://api.testnet.solana.com",
  PRICE_CACHE_TTL_MS: "3600000",
  API_TIMEOUT_MS: "30000",
  LOG_LEVEL: "debug",
};

// Mock para timers
export const mockTimers = {
  setTimeout: vi.fn(),
  clearTimeout: vi.fn(),
  setInterval: vi.fn(),
  clearInterval: vi.fn(),
  setImmediate: vi.fn(),
  clearImmediate: vi.fn(),
};

// Mock para crypto
export const mockCrypto = {
  randomBytes: vi.fn().mockReturnValue(Buffer.from("mock-random-bytes")),
  createHash: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue(Buffer.from("mock-hash")),
  }),
  createHmac: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue(Buffer.from("mock-hmac")),
  }),
  pbkdf2Sync: vi.fn().mockReturnValue(Buffer.from("mock-derived-key")),
  scryptSync: vi.fn().mockReturnValue(Buffer.from("mock-scrypt-key")),
};

// Mock para file system
export const mockFs = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  existsSync: vi.fn().mockReturnValue(false),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn().mockReturnValue([]),
  statSync: vi.fn().mockReturnValue({
    isFile: () => true,
    isDirectory: () => false,
    size: 1024,
    mtime: new Date(),
  }),
  unlinkSync: vi.fn(),
  rmdirSync: vi.fn(),
};

// Mock para process
export const mockProcess = {
  env: mockEnv,
  nextTick: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  removeAllListeners: vi.fn(),
};

// Helper function to setup all mocks
export const setupMocks = () => {
  // Setup global mocks
  global.fetch = mockFetch;
  global.WebSocket = mockWebSocket;
  global.localStorage = mockLocalStorage;
  global.sessionStorage = mockSessionStorage;
  global.setTimeout = mockTimers.setTimeout;
  global.clearTimeout = mockTimers.clearTimeout;
  global.setInterval = mockTimers.setInterval;
  global.clearInterval = mockTimers.clearInterval;
  global.crypto = mockCrypto;
  global.process = mockProcess;

  // Setup module mocks
  vi.mock("@solana/web3.js", () => mockSolanaWeb3);
  vi.mock("@solana/wallet-adapter-react", () => mockWalletAdapter);
  vi.mock("redis", () => mockRedis);
  vi.mock("@/lib/api-client", () => mockApiClient);
  vi.mock("@/lib/config", () => ({ default: mockConfig }));
};

// Helper function to reset all mocks
export const resetMocks = () => {
  vi.clearAllMocks();
  mockLocalStorage.clear();
  mockSessionStorage.clear();
  mockTimers.setTimeout.mockClear();
  mockTimers.clearTimeout.mockClear();
  mockTimers.setInterval.mockClear();
  mockTimers.clearInterval.mockClear();
};

// Helper function to create mock responses
export const createMockResponse = <T = any>(
  data: T,
  success = true,
  error?: string,
) => ({
  success,
  data: success ? data : undefined,
  error: success ? undefined : error,
});

// Helper function to create mock error
export const createMockError = (message: string, code?: string) => {
  const error = new Error(message) as any;
  error.code = code || "UNKNOWN_ERROR";
  return error;
};

// Export all mocks for easy access
export const mocks = {
  solana: mockSolanaWeb3,
  wallet: mockWalletAdapter,
  redis: mockRedis,
  api: mockApiClient,
  fetch: mockFetch,
  webSocket: mockWebSocket,
  localStorage: mockLocalStorage,
  sessionStorage: mockSessionStorage,
  priceProviders: mockPriceProviders,
  paymentProcessors: mockPaymentProcessors,
  logger: mockLogger,
  config: mockConfig,
  env: mockEnv,
  timers: mockTimers,
  crypto: mockCrypto,
  fs: mockFs,
  process: mockProcess,
};
