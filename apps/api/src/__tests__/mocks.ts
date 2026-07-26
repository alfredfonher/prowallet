import { vi } from "vitest";

// Fix circular reference in mockLogger first
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => mockLogger),
};

// Mock @solana/web3.js
vi.mock("@solana/web3.js", () => {
  class MockTransaction {
    recentBlockhash: string | undefined;
    feePayer: any;
    instructions: any[] = [];

    constructor(options?: any) {
      this.recentBlockhash = options?.recentBlockhash;
      this.feePayer = options?.feePayer;
      this.instructions = [];
    }

    add(instruction: any) {
      this.instructions.push(instruction);
      return this;
    }
  }

  return {
    Connection: vi.fn(),
    PublicKey: vi.fn().mockImplementation((value) => {
      // Handle the case where value might be a Buffer (from secret key)
      if (Buffer.isBuffer(value)) {
        return {
          toString: vi.fn(() => "mock-public-key-from-buffer"),
          toBase58: vi.fn(() => "mock-public-key-from-buffer"),
          toBuffer: vi.fn(() => value),
        };
      }
      return {
        toString: vi.fn(() => value || "mock-public-key"),
        toBase58: vi.fn(() => value || "mock-public-key"),
        toBuffer: vi.fn(() => Buffer.from("mock-buffer")),
      };
    }),
    Keypair: Object.assign(
      vi.fn(() => {
        // Import real Keypair for actual key generation
        const { Keypair: RealKeypair } = require("@solana/web3.js");
        return RealKeypair.generate();
      }),
      {
        generate: vi.fn(() => {
          const { Keypair: RealKeypair } = require("@solana/web3.js");
          return RealKeypair.generate();
        }),
        fromSecretKey: vi.fn((secretKey) => {
          const { Keypair: RealKeypair } = require("@solana/web3.js");
          return RealKeypair.fromSecretKey(secretKey);
        }),
      },
    ),
    Transaction: MockTransaction,
    clusterApiUrl: vi.fn(() => "https://api.devnet.solana.com"),
  };
});

// Mock @solana/spl-token
vi.mock("@solana/spl-token", () => ({
  getAssociatedTokenAddress: vi.fn(),
  createTransferInstruction: vi.fn(),
  TOKEN_PROGRAM_ID: new (require("@solana/web3.js").PublicKey)(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  ),
}));

// Mock logging service
vi.mock("../../services/logging/logger.service", () => ({
  loggerService: mockLogger,
}));

// Mock redis service
vi.mock("../../services/redis/redis.service", () => ({
  redisService: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

// Mock price service
vi.mock("../../services/price/price.service", () => ({
  priceService: {
    getPrice: vi.fn(),
  },
}));
