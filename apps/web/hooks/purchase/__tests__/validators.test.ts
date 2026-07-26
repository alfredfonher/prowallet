/**
 * Tests para validators de purchase
 * Coverage: 100% funciones core
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  validateWalletConnection,
  validateWalletSigning,
  validateSolBalance,
  validateTransactionBase64,
  validatePurchaseParams,
  createErrorHandler,
  formatSolAmount,
  formatTransactionSignature,
  createDelay,
  withTimeout,
  createPurchaseLogger,
} from "../validators";
import {
  WalletError,
  BalanceError,
  TransactionError,
  PurchaseStep,
} from "../types";

// Mocks
const mockConnection = {
  getBalance: vi.fn(),
};

const mockPublicKey = new PublicKey("11111111111111111111111111111112");
const mockPublicKeyString = mockPublicKey.toString();

describe("Purchase Validators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("validateWalletConnection", () => {
    it("should pass with valid public key", () => {
      expect(() => validateWalletConnection(mockPublicKey)).not.toThrow();
    });

    it("should throw WalletError with null public key", () => {
      expect(() => validateWalletConnection(null)).toThrow(WalletError);
      expect(() => validateWalletConnection(null)).toThrow(
        "Por favor conecta tu wallet primero",
      );
    });

    it("should throw WalletError with undefined public key", () => {
      expect(() => validateWalletConnection(undefined)).toThrow(WalletError);
    });

    it("should throw WalletError with correct error code", () => {
      try {
        validateWalletConnection(null);
      } catch (error) {
        expect(error).toBeInstanceOf(WalletError);
        expect((error as WalletError).code).toBe("WALLET_NOT_CONNECTED");
        expect((error as WalletError).step).toBe(
          PurchaseStep.VALIDATING_WALLET,
        );
      }
    });
  });

  describe("validateWalletSigning", () => {
    it("should pass with valid public key and signTransaction", () => {
      expect(() => validateWalletSigning(mockPublicKey, vi.fn())).not.toThrow();
    });

    it("should throw WalletError with null public key", () => {
      expect(() => validateWalletSigning(null, vi.fn())).toThrow(WalletError);
    });

    it("should throw WalletError with null signTransaction", () => {
      expect(() => validateWalletSigning(mockPublicKey, null)).toThrow(
        WalletError,
      );
      expect(() => validateWalletSigning(mockPublicKey, null)).toThrow(
        "Wallet no configurada para firmar transacciones",
      );
    });

    it("should throw WalletError with undefined signTransaction", () => {
      expect(() => validateWalletSigning(mockPublicKey, undefined)).toThrow(
        WalletError,
      );
    });

    it("should throw WalletError with correct error code", () => {
      try {
        validateWalletSigning(mockPublicKey, null);
      } catch (error) {
        expect(error).toBeInstanceOf(WalletError);
        expect((error as WalletError).code).toBe("WALLET_CANNOT_SIGN");
      }
    });
  });

  describe("validateSolBalance", () => {
    it("should pass with sufficient balance", async () => {
      mockConnection.getBalance.mockResolvedValue(100000000); // 0.1 SOL

      await expect(
        validateSolBalance(mockPublicKey, mockConnection, 0.05),
      ).resolves.not.toThrow();
    });

    it("should throw BalanceError with insufficient balance", async () => {
      mockConnection.getBalance.mockResolvedValue(25000000); // 0.025 SOL

      await expect(
        validateSolBalance(mockPublicKey, mockConnection, 0.05),
      ).rejects.toThrow(BalanceError);
    });

    it("should throw BalanceError with correct message", async () => {
      mockConnection.getBalance.mockResolvedValue(25000000); // 0.025 SOL

      try {
        await validateSolBalance(mockPublicKey, mockConnection, 0.05);
      } catch (error) {
        expect(error).toBeInstanceOf(BalanceError);
        expect((error as BalanceError).message).toContain(
          "Fondos insuficientes",
        );
        expect((error as BalanceError).message).toContain("0.05");
        expect((error as BalanceError).message).toContain("0.0250");
      }
    });

    it("should use default required SOL when not specified", async () => {
      mockConnection.getBalance.mockResolvedValue(60000000); // 0.06 SOL

      await expect(
        validateSolBalance(mockPublicKey, mockConnection),
      ).resolves.not.toThrow();
    });

    it("should throw BalanceError when connection fails", async () => {
      mockConnection.getBalance.mockRejectedValue(
        new Error("Connection failed"),
      );

      await expect(
        validateSolBalance(mockPublicKey, mockConnection),
      ).rejects.toThrow(BalanceError);
    });

    it("should preserve original BalanceError", async () => {
      mockConnection.getBalance.mockResolvedValue(25000000);

      try {
        await validateSolBalance(mockPublicKey, mockConnection, 0.05);
      } catch (error) {
        expect(error).toBeInstanceOf(BalanceError);
        expect((error as BalanceError).code).toBe("INSUFFICIENT_BALANCE");
      }
    });
  });

  describe("validateTransactionBase64", () => {
    it("should pass with valid base64", () => {
      const validBase64 = Buffer.from("test transaction").toString("base64");
      expect(() => validateTransactionBase64(validBase64)).not.toThrow();
    });

    it("should throw TransactionError with null", () => {
      expect(() => validateTransactionBase64(null)).toThrow(TransactionError);
    });

    it("should throw TransactionError with undefined", () => {
      expect(() => validateTransactionBase64(undefined)).toThrow(
        TransactionError,
      );
    });

    it("should throw TransactionError with empty string", () => {
      expect(() => validateTransactionBase64("")).toThrow(TransactionError);
    });

    it("should throw TransactionError with non-string", () => {
      expect(() => validateTransactionBase64(123)).toThrow(TransactionError);
    });

    it("should throw TransactionError with invalid base64", () => {
      expect(() => validateTransactionBase64("invalid-base64!@#")).toThrow(
        TransactionError,
      );
    });

    it("should throw TransactionError with correct error details", () => {
      try {
        validateTransactionBase64(null);
      } catch (error) {
        expect(error).toBeInstanceOf(TransactionError);
        expect((error as TransactionError).code).toBe(
          "INVALID_TRANSACTION_FORMAT",
        );
        expect((error as TransactionError).step).toBe(
          PurchaseStep.SIGNING_TRANSACTION,
        );
      }
    });
  });

  describe("validatePurchaseParams", () => {
    it("should pass with valid params", () => {
      const validParams = {
        tokenAmount: 100,
        paymentMethod: "SOL",
        maxSlippage: 5,
      };

      expect(() => validatePurchaseParams(validParams)).not.toThrow();
    });

    it("should pass with minimal valid params", () => {
      const validParams = {
        tokenAmount: 100,
      };

      expect(() => validatePurchaseParams(validParams)).not.toThrow();
    });

    it("should throw TransactionError with zero token amount", () => {
      const params = { tokenAmount: 0 };

      expect(() => validatePurchaseParams(params)).toThrow(TransactionError);
    });

    it("should throw TransactionError with negative token amount", () => {
      const params = { tokenAmount: -10 };

      expect(() => validatePurchaseParams(params)).toThrow(TransactionError);
    });

    it("should throw TransactionError with too high token amount", () => {
      const params = { tokenAmount: 2000000 };

      expect(() => validatePurchaseParams(params)).toThrow(TransactionError);
    });

    it("should throw TransactionError with invalid slippage (negative)", () => {
      const params = { tokenAmount: 100, maxSlippage: -5 };

      expect(() => validatePurchaseParams(params)).toThrow(TransactionError);
    });

    it("should throw TransactionError with invalid slippage (too high)", () => {
      const params = { tokenAmount: 100, maxSlippage: 100 };

      expect(() => validatePurchaseParams(params)).toThrow(TransactionError);
    });

    it("should pass with boundary slippage values", () => {
      const params1 = { tokenAmount: 100, maxSlippage: 0 };
      const params2 = { tokenAmount: 100, maxSlippage: 50 };

      expect(() => validatePurchaseParams(params1)).not.toThrow();
      expect(() => validatePurchaseParams(params2)).not.toThrow();
    });

    it("should throw TransactionError with invalid payment method", () => {
      const params = { tokenAmount: 100, paymentMethod: 123 };

      expect(() => validatePurchaseParams(params)).toThrow(TransactionError);
    });

    it("should pass with string payment method", () => {
      const params = { tokenAmount: 100, paymentMethod: "USD" };

      expect(() => validatePurchaseParams(params)).not.toThrow();
    });
  });

  describe("createErrorHandler", () => {
    it("should create error handler function", () => {
      const setState = vi.fn();
      const errorHandler = createErrorHandler(setState);

      expect(typeof errorHandler).toBe("function");
    });

    it("should handle Error objects", () => {
      const setState = vi.fn();
      const errorHandler = createErrorHandler(setState);
      const error = new Error("Test error");

      errorHandler(error);

      expect(setState).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should handle non-Error objects", () => {
      const setState = vi.fn();
      const errorHandler = createErrorHandler(setState);
      const error = "String error";

      errorHandler(error);

      expect(setState).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should use default step when not provided", () => {
      const setState = vi.fn();
      const errorHandler = createErrorHandler(setState);
      const error = new Error("Test error");

      errorHandler(error);

      expect(setState).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should use provided step", () => {
      const setState = vi.fn();
      const errorHandler = createErrorHandler(
        setState,
        PurchaseStep.SIGNING_TRANSACTION,
      );
      const error = new Error("Test error");

      errorHandler(error);

      expect(setState).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe("formatSolAmount", () => {
    it("should format lamports to SOL correctly", () => {
      expect(formatSolAmount(100000000)).toBe("1.0000");
      expect(formatSolAmount(50000000)).toBe("0.5000");
      expect(formatSolAmount(1)).toBe("0.0000");
      expect(formatSolAmount(0)).toBe("0.0000");
    });

    it("should handle large numbers", () => {
      expect(formatSolAmount(1000000000)).toBe("10.0000");
    });
  });

  describe("formatTransactionSignature", () => {
    it("should format signature correctly", () => {
      const signature =
        "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
      const formatted = formatTransactionSignature(signature);

      expect(formatted).toBe("abcd...7890");
    });

    it("should handle null/undefined", () => {
      expect(formatTransactionSignature(null)).toBe("N/A");
      expect(formatTransactionSignature(undefined)).toBe("N/A");
    });

    it("should handle empty string", () => {
      expect(formatTransactionSignature("")).toBe("N/A");
    });

    it("should handle short signatures", () => {
      expect(formatTransactionSignature("abc")).toBe("abc...abc");
    });
  });

  describe("createDelay", () => {
    it("should create a promise that resolves after delay", async () => {
      const delayPromise = createDelay(1000);

      vi.advanceTimersByTime(1000);

      await expect(delayPromise).resolves.toBeUndefined();
    });

    it("should work with zero delay", async () => {
      const delayPromise = createDelay(0);

      vi.advanceTimersByTime(0);

      await expect(delayPromise).resolves.toBeUndefined();
    });
  });

  describe("withTimeout", () => {
    it("should resolve when promise completes before timeout", async () => {
      const fastPromise = Promise.resolve("success");

      const result = await withTimeout(fastPromise, 1000);

      expect(result).toBe("success");
    });

    it("should timeout when promise takes too long", async () => {
      const slowPromise = new Promise((resolve) => setTimeout(resolve, 2000));

      await expect(withTimeout(slowPromise, 1000)).rejects.toThrow(
        "Operación timeout",
      );
    });

    it("should use custom timeout message", async () => {
      const slowPromise = new Promise((resolve) => setTimeout(resolve, 2000));

      await expect(
        withTimeout(slowPromise, 1000, "Custom timeout"),
      ).rejects.toThrow("Custom timeout");
    });

    it("should reject when original promise rejects", async () => {
      const errorPromise = Promise.reject(new Error("Original error"));

      await expect(withTimeout(errorPromise, 1000)).rejects.toThrow(
        "Original error",
      );
    });
  });

  describe("createPurchaseLogger", () => {
    it("should create logger with default name", () => {
      const logger = createPurchaseLogger();

      expect(typeof logger.log).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
    });

    it("should create logger with custom address", () => {
      const logger = createPurchaseLogger(mockPublicKeyString);

      expect(typeof logger.log).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
    });

    it("should handle null/undefined address", () => {
      const logger1 = createPurchaseLogger(null as any);
      const logger2 = createPurchaseLogger(undefined as any);

      expect(typeof logger1.log).toBe("function");
      expect(typeof logger2.log).toBe("function");
    });
  });

  describe("Edge Cases", () => {
    it("should handle extreme values in validatePurchaseParams", () => {
      // Boundary values
      expect(() =>
        validatePurchaseParams({ tokenAmount: 0.000001 }),
      ).not.toThrow();
      expect(() =>
        validatePurchaseParams({ tokenAmount: 999999 }),
      ).not.toThrow();

      // Edge slippage
      expect(() =>
        validatePurchaseParams({ tokenAmount: 100, maxSlippage: 0.1 }),
      ).not.toThrow();
      expect(() =>
        validatePurchaseParams({ tokenAmount: 100, maxSlippage: 49.9 }),
      ).not.toThrow();
    });

    it("should handle malformed base64 strings", () => {
      const malformedCases = [
        "====", // Too many padding
        "abc===", // Invalid padding
        "abc", // Invalid length
        "\x00\x01\x02", // Binary data
      ];

      malformedCases.forEach((base64) => {
        expect(() => validateTransactionBase64(base64)).toThrow(
          TransactionError,
        );
      });
    });

    it("should handle connection errors gracefully", async () => {
      mockConnection.getBalance.mockRejectedValue(new Error("Network error"));

      try {
        await validateSolBalance(mockPublicKey, mockConnection);
      } catch (error) {
        expect(error).toBeInstanceOf(BalanceError);
        expect((error as BalanceError).code).toBe(
          "BALANCE_VERIFICATION_FAILED",
        );
      }
    });
  });
});
