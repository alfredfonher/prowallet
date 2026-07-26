import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EnvironmentSecretStorage } from "../secret-key.service";

// Mock console methods to avoid noise in tests
const originalConsoleError = console.error;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

describe("SecretKeyService - KeyPair Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.error = vi.fn();
    console.log = vi.fn();
    console.warn = vi.fn();
    delete process.env.TREASURY_PRIVATE_KEY;
    delete process.env.AUTHORITY_KEYPAIR_PATH;
  });

  afterEach(() => {
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
  });

  describe("EnvironmentSecretStorage - KeyPair Generation", () => {
    let storage: EnvironmentSecretStorage;

    beforeEach(() => {
      storage = new EnvironmentSecretStorage();
    });

    it("should create keypair from valid hex private key", async () => {
      // Import real Keypair for this test
      const { Keypair } = await import("@solana/web3.js");

      // Generate a real keypair for testing
      const keypair = Keypair.generate();
      const privateKey = Array.from(keypair.secretKey)
        .map((b: any) => b.toString(16).padStart(2, "0"))
        .join("");

      process.env.TREASURY_PRIVATE_KEY = privateKey;

      const result = await storage.getKeyPair();

      // Check that result has the expected Keypair properties
      expect(result).toHaveProperty("publicKey");
      expect(result).toHaveProperty("secretKey");
      expect(typeof result.publicKey.toBase58).toBe("function");
      expect(typeof result.secretKey).toBe("object");

      // Verify the keys match
      expect(result.publicKey.toBase58()).toBe(keypair.publicKey.toBase58());
    });

    it("should handle invalid private key format", async () => {
      process.env.TREASURY_PRIVATE_KEY = "invalid_key_format";

      await expect(storage.getKeyPair()).rejects.toThrow(
        "Invalid private key format",
      );
    });

    it("should handle missing private key", async () => {
      // Don't set any private key

      await expect(storage.getKeyPair()).rejects.toThrow(
        "TREASURY_PRIVATE_KEY environment variable not set and AUTHORITY_KEYPAIR_PATH not found",
      );
    });
  });
});
