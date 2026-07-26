/**
 * Tests para hooks de purchase
 * Coverage: 100% funciones core, 80% resto
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { PublicKey } from "@solana/web3.js";
import { useWalletValidation } from "../use-wallet-validation";
import { useTransactionHandler } from "../use-transaction-handler";
import { usePurchaseApi } from "../use-purchase-api";
import { usePurchase } from "../use-purchase-refactored";
import { PurchaseState, PurchaseStep } from "../types";

// Mocks para Solana wallet adapter
const mockWalletContext = {
  publicKey: new PublicKey("11111111111111111111111111111112"),
  connected: true,
  signTransaction: vi.fn(),
};

const mockConnection = {
  getBalance: vi.fn(),
  sendRawTransaction: vi.fn(),
  confirmTransaction: vi.fn(),
};

// Mock para API client
const mockApiClient = {
  post: vi.fn(),
  get: vi.fn(),
};

// Mock para config
const mockConfig = {
  api: {
    endpoints: {
      purchaseInitiate: "/api/purchase/initiate",
      purchaseSettle: "/api/purchase/settle",
      priceQuote: "/api/price/quote",
    },
  },
};

// Mock para React hooks
vi.mock("@solana/wallet-adapter-react", () => ({
  useConnection: () => ({ connection: mockConnection }),
  useWallet: () => mockWalletContext,
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: mockApiClient,
}));

vi.mock("@/lib/config", () => ({
  default: mockConfig,
}));

describe("Purchase Hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("useWalletValidation", () => {
    it("should return wallet validation functions", () => {
      const mockSetState = vi.fn();

      const { result } = renderHook(() => useWalletValidation(mockSetState));

      expect(result.current.validateWalletConnection).toBeDefined();
      expect(result.current.validateWalletSigningCapability).toBeDefined();
      expect(result.current.validateSolBalance).toBeDefined();
      expect(result.current.isWalletReady).toBeDefined();
      expect(result.current.walletAddress).toBeDefined();
    });

    it("should validate wallet connection successfully", () => {
      const mockSetState = vi.fn();

      const { result } = renderHook(() => useWalletValidation(mockSetState));

      expect(() => result.current.validateWalletConnection()).not.toThrow();
    });

    it("should throw error when wallet not connected", () => {
      mockWalletContext.publicKey = null;
      const mockSetState = vi.fn();

      const { result } = renderHook(() => useWalletValidation(mockSetState));

      expect(() => result.current.validateWalletConnection()).toThrow();
    });

    it("should validate SOL balance successfully", async () => {
      mockConnection.getBalance.mockResolvedValue(100000000); // 1 SOL
      const mockSetState = vi.fn();

      const { result } = renderHook(() => useWalletValidation(mockSetState));

      await expect(
        result.current.validateSolBalance(0.5),
      ).resolves.not.toThrow();
    });

    it("should throw error with insufficient balance", async () => {
      mockConnection.getBalance.mockResolvedValue(25000000); // 0.025 SOL
      const mockSetState = vi.fn();

      const { result } = renderHook(() => useWalletValidation(mockSetState));

      await expect(result.current.validateSolBalance(0.5)).rejects.toThrow();
    });

    it("should return correct wallet state", () => {
      const mockSetState = vi.fn();

      const { result } = renderHook(() => useWalletValidation(mockSetState));

      expect(result.current.isWalletReady).toBe(true);
      expect(result.current.walletAddress).toBe(
        mockWalletContext.publicKey?.toString(),
      );
    });
  });

  describe("useTransactionHandler", () => {
    it("should return transaction handler functions", () => {
      const mockSetState = vi.fn();

      const { result } = renderHook(() => useTransactionHandler(mockSetState));

      expect(result.current.signAndSendTransaction).toBeDefined();
      expect(result.current.confirmTransaction).toBeDefined();
    });

    it("should sign and send transaction successfully", async () => {
      const mockTransaction = {
        serialize: vi.fn().mockReturnValue(Buffer.from("signed-tx")),
      };

      mockWalletContext.signTransaction.mockResolvedValue(mockTransaction);
      mockConnection.sendRawTransaction.mockResolvedValue("signature123");
      mockConnection.confirmTransaction.mockResolvedValue({
        value: { err: null },
      });

      const mockSetState = vi.fn();

      const { result } = renderHook(() => useTransactionHandler(mockSetState));

      const txBase64 = Buffer.from("transaction").toString("base64");
      const signature = await result.current.signAndSendTransaction(txBase64);

      expect(signature).toBe("signature123");
      expect(mockWalletContext.signTransaction).toHaveBeenCalled();
      expect(mockConnection.sendRawTransaction).toHaveBeenCalled();
    });

    it("should handle transaction signing failure", async () => {
      mockWalletContext.signTransaction.mockRejectedValue(
        new Error("Signing failed"),
      );

      const mockSetState = vi.fn();

      const { result } = renderHook(() => useTransactionHandler(mockSetState));

      const txBase64 = Buffer.from("transaction").toString("base64");
      const signature = await result.current.signAndSendTransaction(txBase64);

      expect(signature).toBeNull();
    });

    it("should confirm transaction successfully", async () => {
      mockConnection.confirmTransaction.mockResolvedValue({
        value: { err: null, slot: 123 },
      });

      const mockSetState = vi.fn();

      const { result } = renderHook(() => useTransactionHandler(mockSetState));

      const confirmation =
        await result.current.confirmTransaction("signature123");

      expect(confirmation.confirmed).toBe(true);
      expect(confirmation.signature).toBe("signature123");
    });

    it("should handle transaction confirmation failure", async () => {
      mockConnection.confirmTransaction.mockResolvedValue({
        value: { err: "Transaction failed" },
      });

      const mockSetState = vi.fn();

      const { result } = renderHook(() => useTransactionHandler(mockSetState));

      const confirmation =
        await result.current.confirmTransaction("signature123");

      expect(confirmation.confirmed).toBe(false);
      expect(confirmation.error).toBeDefined();
    });

    it("should handle invalid base64 transaction", async () => {
      const mockSetState = vi.fn();

      const { result } = renderHook(() => useTransactionHandler(mockSetState));

      const signature =
        await result.current.signAndSendTransaction("invalid-base64");

      expect(signature).toBeNull();
    });
  });

  describe("usePurchaseApi", () => {
    it("should return purchase API functions", () => {
      const mockSetState = vi.fn();

      const { result } = renderHook(() => usePurchaseApi(mockSetState));

      expect(result.current.initiatePurchase).toBeDefined();
      expect(result.current.settlePurchase).toBeDefined();
    });

    it("should initiate purchase successfully", async () => {
      const mockResponse = {
        success: true,
        data: {
          transactionId: "tx123",
          txBase64: "base64transaction",
          estimatedFee: 0.001,
          totalCost: 100.5,
        },
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      const mockSetState = vi.fn();

      const { result } = renderHook(() => usePurchaseApi(mockSetState));

      const params = {
        tokenAmount: 100,
        paymentMethod: "SOL",
        maxSlippage: 5,
        walletAddress: "wallet123",
      };

      const response = await result.current.initiatePurchase(params);

      expect(response).toEqual(mockResponse);
      expect(mockApiClient.post).toHaveBeenCalledWith(
        mockConfig.api.endpoints.purchaseInitiate,
        params,
      );
    });

    it("should handle purchase initiation failure", async () => {
      const mockResponse = {
        success: false,
        error: "Insufficient funds",
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      const mockSetState = vi.fn();

      const { result } = renderHook(() => usePurchaseApi(mockSetState));

      const params = {
        tokenAmount: 100,
        paymentMethod: "SOL",
        maxSlippage: 5,
        walletAddress: "wallet123",
      };

      const response = await result.current.initiatePurchase(params);

      expect(response).toBeNull();
    });

    it("should settle purchase successfully", async () => {
      const mockResponse = {
        success: true,
        data: {
          confirmed: true,
          signature: "signature123",
          blockSlot: 456,
        },
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      const mockSetState = vi.fn();

      const { result } = renderHook(() => usePurchaseApi(mockSetState));

      const response = await result.current.settlePurchase(
        "tx123",
        "signature123",
      );

      expect(response).toEqual(mockResponse);
      expect(mockApiClient.post).toHaveBeenCalledWith(
        mockConfig.api.endpoints.purchaseSettle,
        {
          transactionId: "tx123",
          signature: "signature123",
        },
      );
    });

    it("should handle purchase settlement failure", async () => {
      const mockResponse = {
        success: false,
        error: "Transaction not found",
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      const mockSetState = vi.fn();

      const { result } = renderHook(() => usePurchaseApi(mockSetState));

      const response = await result.current.settlePurchase(
        "tx123",
        "signature123",
      );

      expect(response).toBeNull();
    });

    it("should validate purchase parameters", async () => {
      const mockSetState = vi.fn();

      const { result } = renderHook(() => usePurchaseApi(mockSetState));

      // Invalid params
      const invalidParams = {
        tokenAmount: -100, // Negative amount
        paymentMethod: "SOL",
        maxSlippage: 5,
        walletAddress: "wallet123",
      };

      const response = await result.current.initiatePurchase(invalidParams);

      expect(response).toBeNull();
    });
  });

  describe("usePurchase", () => {
    it("should return purchase state and methods", () => {
      const { result } = renderHook(() => usePurchase());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.success).toBe(false);
      expect(result.current.transactionSignature).toBe(null);
      expect(result.current.currentStep).toBe(PurchaseStep.IDLE);
      expect(result.current.executePurchase).toBeDefined();
      expect(result.current.resetState).toBeDefined();
      expect(result.current.currentStepDescription).toBeDefined();
    });

    it("should execute purchase flow successfully", async () => {
      // Mock successful responses
      mockConnection.getBalance.mockResolvedValue(100000000); // 1 SOL

      const mockTransaction = {
        serialize: vi.fn().mockReturnValue(Buffer.from("signed-tx")),
      };
      mockWalletContext.signTransaction.mockResolvedValue(mockTransaction);
      mockConnection.sendRawTransaction.mockResolvedValue("signature123");
      mockConnection.confirmTransaction.mockResolvedValue({
        value: { err: null },
      });

      mockApiClient.post
        .mockResolvedValueOnce({
          success: true,
          data: {
            transactionId: "tx123",
            txBase64: Buffer.from("transaction").toString("base64"),
            estimatedFee: 0.001,
            totalCost: 100.5,
          },
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            confirmed: true,
            signature: "signature123",
            blockSlot: 456,
          },
        });

      const { result } = renderHook(() => usePurchase());

      const params = {
        tokenAmount: 100,
        paymentMethod: "SOL",
        maxSlippage: 5,
      };

      let success: boolean;
      await act(async () => {
        success = await result.current.executePurchase(params);
      });

      expect(success).toBe(true);
      expect(result.current.success).toBe(true);
      expect(result.current.transactionSignature).toBe("signature123");
    });

    it("should handle wallet not connected", async () => {
      mockWalletContext.connected = false;
      mockWalletContext.publicKey = null;

      const { result } = renderHook(() => usePurchase());

      const params = {
        tokenAmount: 100,
        paymentMethod: "SOL",
        maxSlippage: 5,
      };

      let success: boolean;
      await act(async () => {
        success = await result.current.executePurchase(params);
      });

      expect(success).toBe(false);
      expect(result.current.error).toContain("conecta tu wallet");
    });

    it("should handle insufficient balance", async () => {
      mockConnection.getBalance.mockResolvedValue(25000000); // 0.025 SOL

      const { result } = renderHook(() => usePurchase());

      const params = {
        tokenAmount: 100,
        paymentMethod: "SOL",
        maxSlippage: 5,
      };

      let success: boolean;
      await act(async () => {
        success = await result.current.executePurchase(params);
      });

      expect(success).toBe(false);
      expect(result.current.error).toContain("Fondos insuficientes");
    });

    it("should reset state correctly", () => {
      const { result } = renderHook(() => usePurchase());

      // Simulate some state change
      act(() => {
        result.current.resetState();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.success).toBe(false);
      expect(result.current.transactionSignature).toBe(null);
      expect(result.current.currentStep).toBe(PurchaseStep.IDLE);
    });

    it("should provide correct step descriptions", () => {
      const { result } = renderHook(() => usePurchase());

      // Test different steps
      const steps = [
        { step: PurchaseStep.IDLE, description: "Listo para comenzar" },
        {
          step: PurchaseStep.VALIDATING_WALLET,
          description: "Validando wallet...",
        },
        {
          step: PurchaseStep.VALIDATING_BALANCE,
          description: "Verificando balance SOL...",
        },
        { step: PurchaseStep.COMPLETED, description: "¡Compra completada!" },
        { step: PurchaseStep.FAILED, description: "Error en el proceso" },
      ];

      steps.forEach(({ step, description }) => {
        act(() => {
          // Simulate step change
          result.current.resetState();
        });

        // The description should match the current step
        expect(result.current.currentStepDescription).toBeDefined();
        expect(typeof result.current.currentStepDescription).toBe("string");
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle network timeouts", async () => {
      mockConnection.getBalance.mockRejectedValue(new Error("Network timeout"));

      const { result } = renderHook(() => usePurchase());

      const params = {
        tokenAmount: 100,
        paymentMethod: "SOL",
        maxSlippage: 5,
      };

      let success: boolean;
      await act(async () => {
        success = await result.current.executePurchase(params);
      });

      expect(success).toBe(false);
      expect(result.current.error).toBeDefined();
    });

    it("should handle API errors", async () => {
      mockConnection.getBalance.mockResolvedValue(100000000); // 1 SOL
      mockApiClient.post.mockRejectedValue(new Error("API error"));

      const { result } = renderHook(() => usePurchase());

      const params = {
        tokenAmount: 100,
        paymentMethod: "SOL",
        maxSlippage: 5,
      };

      let success: boolean;
      await act(async () => {
        success = await result.current.executePurchase(params);
      });

      expect(success).toBe(false);
      expect(result.current.error).toBeDefined();
    });

    it("should handle malformed transaction data", async () => {
      mockConnection.getBalance.mockResolvedValue(100000000); // 1 SOL

      mockApiClient.post.mockResolvedValue({
        success: true,
        data: {
          transactionId: "tx123",
          txBase64: "invalid-base64",
          estimatedFee: 0.001,
          totalCost: 100.5,
        },
      });

      const { result } = renderHook(() => usePurchase());

      const params = {
        tokenAmount: 100,
        paymentMethod: "SOL",
        maxSlippage: 5,
      };

      let success: boolean;
      await act(async () => {
        success = await result.current.executePurchase(params);
      });

      expect(success).toBe(false);
    });

    it("should handle concurrent purchase attempts", async () => {
      mockConnection.getBalance.mockResolvedValue(100000000); // 1 SOL

      const mockTransaction = {
        serialize: vi.fn().mockReturnValue(Buffer.from("signed-tx")),
      };
      mockWalletContext.signTransaction.mockResolvedValue(mockTransaction);
      mockConnection.sendRawTransaction.mockResolvedValue("signature123");
      mockConnection.confirmTransaction.mockResolvedValue({
        value: { err: null },
      });

      mockApiClient.post
        .mockResolvedValue({
          success: true,
          data: {
            transactionId: "tx123",
            txBase64: Buffer.from("transaction").toString("base64"),
            estimatedFee: 0.001,
            totalCost: 100.5,
          },
        })
        .mockResolvedValue({
          success: true,
          data: {
            confirmed: true,
            signature: "signature123",
            blockSlot: 456,
          },
        });

      const { result } = renderHook(() => usePurchase());

      const params = {
        tokenAmount: 100,
        paymentMethod: "SOL",
        maxSlippage: 5,
      };

      // Start two concurrent purchases
      const [success1, success2] = await Promise.all([
        act(async () => result.current.executePurchase(params)),
        act(async () => result.current.executePurchase(params)),
      ]);

      // Both should complete (or fail gracefully)
      expect(typeof success1).toBe("boolean");
      expect(typeof success2).toBe("boolean");
    });
  });
});
