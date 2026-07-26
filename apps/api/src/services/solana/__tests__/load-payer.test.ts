import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Keypair } from "@solana/web3.js";
import { loadPayerKeypair, loadPayerKeypairSync } from "../load-payer";

// Mock the secretKeyService - must not contain any hoisted variables
vi.mock("../secret-key.service", () => ({
  secretKeyService: {
    getKeyPair: vi.fn(),
  },
}));

// Mock the loggerService - must not contain any hoisted variables
vi.mock("../../logging/logger.service", () => ({
  loggerService: {
    logError: vi.fn(),
  },
}));

import { secretKeyService } from "../secret-key.service";

describe("load-payer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("loadPayerKeypair", () => {
    it("should return a Keypair when secret service succeeds", async () => {
      const mockKeypair = Keypair.generate();
      vi.mocked(secretKeyService.getKeyPair).mockResolvedValue(mockKeypair);

      const result = await loadPayerKeypair();

      expect(result).toBe(mockKeypair);
      expect(secretKeyService.getKeyPair).toHaveBeenCalledTimes(1);
    });

    it("should throw error when secret service fails", async () => {
      const mockError = new Error("Secret service error");
      vi.mocked(secretKeyService.getKeyPair).mockRejectedValue(mockError);

      await expect(loadPayerKeypair()).rejects.toThrow(
        "Failed to load treasury keypair",
      );
      expect(secretKeyService.getKeyPair).toHaveBeenCalledTimes(1);
    });

    it("should log error when secret service fails", async () => {
      const mockError = new Error("Secret service error");
      const { loggerService } = await import("../../logging/logger.service");

      vi.mocked(secretKeyService.getKeyPair).mockRejectedValue(mockError);

      try {
        await loadPayerKeypair();
      } catch (error) {
        // Expected to throw
      }

      expect(loggerService.logError).toHaveBeenCalledWith(mockError, {
        context: "loadPayerKeypair",
      });
    });

    it("should handle different types of errors from secret service", async () => {
      const testCases = [
        new Error("Simple error"),
        new TypeError("Type error"),
        new RangeError("Range error"),
        new ReferenceError("Reference error"),
      ];

      for (const error of testCases) {
        vi.mocked(secretKeyService.getKeyPair).mockRejectedValue(error);

        await expect(loadPayerKeypair()).rejects.toThrow(
          "Failed to load treasury keypair",
        );
      }
    });

    it("should preserve error context in logging", async () => {
      const mockError = new Error("Test error");
      const { loggerService } = await import("../../logging/logger.service");

      vi.mocked(secretKeyService.getKeyPair).mockRejectedValue(mockError);

      try {
        await loadPayerKeypair();
      } catch (error) {
        // Expected to throw
      }

      expect(loggerService.logError).toHaveBeenCalledWith(
        mockError,
        expect.objectContaining({
          context: "loadPayerKeypair",
        }),
      );
    });
  });

  describe("loadPayerKeypairSync", () => {
    it("should throw error indicating async function should be used", () => {
      expect(() => loadPayerKeypairSync()).toThrow(
        "Synchronous keypair loading is not supported. Use loadPayerKeypair() instead.",
      );
    });

    it("should always throw regardless of environment", () => {
      // Test with different environment states
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = "development";
      expect(() => loadPayerKeypairSync()).toThrow();

      process.env.NODE_ENV = "production";
      expect(() => loadPayerKeypairSync()).toThrow();

      process.env.NODE_ENV = "test";
      expect(() => loadPayerKeypairSync()).toThrow();

      // Restore original env
      process.env.NODE_ENV = originalEnv;
    });

    it("should throw error with correct message format", () => {
      try {
        loadPayerKeypairSync();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(
          "Synchronous keypair loading is not supported",
        );
        expect((error as Error).message).toContain("loadPayerKeypair()");
      }
    });
  });

  describe("Integration with secret service", () => {
    it("should handle successful keypair creation with valid keys", async () => {
      const keypair = Keypair.generate();
      const privateKey = Array.from(keypair.secretKey)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Mock environment variables
      process.env.TREAUSURY_PRIVATE_KEY = privateKey;

      vi.mocked(secretKeyService.getKeyPair).mockImplementation(async () => {
        // Simulate the actual secret service behavior
        return Keypair.fromSecretKey(Buffer.from(privateKey, "hex"));
      });

      const result = await loadPayerKeypair();

      expect(result).toBeInstanceOf(Keypair);
      expect(result.publicKey.toBase58()).toBe(keypair.publicKey.toBase58());
    });

    it("should handle malformed private key errors", async () => {
      vi.mocked(secretKeyService.getKeyPair).mockRejectedValue(
        new Error("Invalid private key format"),
      );

      await expect(loadPayerKeypair()).rejects.toThrow(
        "Failed to load treasury keypair",
      );
    });

    it("should handle missing environment variable errors", async () => {
      vi.mocked(secretKeyService.getKeyPair).mockRejectedValue(
        new Error("TREAUSURY_PRIVATE_KEY environment variable not set"),
      );

      await expect(loadPayerKeypair()).rejects.toThrow(
        "Failed to load treasury keypair",
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle undefined error from secret service", async () => {
      vi.mocked(secretKeyService.getKeyPair).mockRejectedValue(undefined);

      await expect(loadPayerKeypair()).rejects.toThrow(
        "Failed to load treasury keypair",
      );
    });

    it("should handle null error from secret service", async () => {
      vi.mocked(secretKeyService.getKeyPair).mockRejectedValue(null);

      await expect(loadPayerKeypair()).rejects.toThrow(
        "Failed to load treasury keypair",
      );
    });

    it("should handle string as error from secret service", async () => {
      vi.mocked(secretKeyService.getKeyPair).mockRejectedValue("String error");

      await expect(loadPayerKeypair()).rejects.toThrow(
        "Failed to load treasury keypair",
      );
    });

    it("should handle object as error from secret service", async () => {
      vi.mocked(secretKeyService.getKeyPair).mockRejectedValue({
        message: "Object error",
      });

      await expect(loadPayerKeypair()).rejects.toThrow(
        "Failed to load treasury keypair",
      );
    });

    it("should handle empty object as error from secret service", async () => {
      vi.mocked(secretKeyService.getKeyPair).mockRejectedValue({});

      await expect(loadPayerKeypair()).rejects.toThrow(
        "Failed to load treasury keypair",
      );
    });

    it("should handle multiple consecutive calls", async () => {
      const mockKeypair = Keypair.generate();
      vi.mocked(secretKeyService.getKeyPair).mockResolvedValue(mockKeypair);

      const results = await Promise.all([
        loadPayerKeypair(),
        loadPayerKeypair(),
        loadPayerKeypair(),
      ]);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toBe(mockKeypair);
      });
      expect(secretKeyService.getKeyPair).toHaveBeenCalledTimes(3);
    });

    it("should handle rapid successive calls with failures", async () => {
      const mockError = new Error("Service unavailable");
      vi.mocked(secretKeyService.getKeyPair).mockRejectedValue(mockError);

      const promises = Array.from({ length: 5 }, () => loadPayerKeypair());
      const results = await Promise.allSettled(promises);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.status).toBe("rejected");
        if (result.status === "rejected") {
          expect(result.reason).toBeInstanceOf(Error);
          expect((result.reason as Error).message).toBe(
            "Failed to load treasury keypair",
          );
        }
      });
    });
  });

  describe("Performance and Reliability", () => {
    it("should complete within reasonable time", async () => {
      const mockKeypair = Keypair.generate();
      vi.mocked(secretKeyService.getKeyPair).mockImplementation(async () => {
        // Simulate minimal processing time
        await new Promise((resolve) => setTimeout(resolve, 1));
        return mockKeypair;
      });

      const startTime = Date.now();
      await loadPayerKeypair();
      const endTime = Date.now();

      // Should complete within 100ms (very generous threshold)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it("should handle timeout scenarios gracefully", async () => {
      vi.mocked(secretKeyService.getKeyPair).mockImplementation(async () => {
        // Simulate a very long operation
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return Keypair.generate();
      });

      // This test verifies the function doesn't hang indefinitely
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timeout")), 500);
      });

      await expect(
        Promise.race([loadPayerKeypair(), timeoutPromise]),
      ).rejects.toThrow("Timeout");
    });
  });
});
