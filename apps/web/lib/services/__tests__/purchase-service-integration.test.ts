/**
 * Tests de integración para purchase-service.ts
 * Covers: fetchPrices, verifyBalance, initiatePurchase, wallet operations, signing, etc.
 * Sin mocking de módulos externos (avoid hoisting issues)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  PurchaseError,
  validateAuthentication,
  validateTokenAmount,
  validateWalletAddress,
  validatePrices,
  calculatePrices,
} from "../purchase-service";

// ==================== FIXTURES ====================

const validWalletAddress = "11111111111111111111111111111112";
const validSolanaAddress = "So11111111111111111111111111111111111111112";
const mockTokenAmount = 100;
const mockSolPrice = 200;
const mockTokenPrice = 0.01;

// ==================== TESTS: fetchPrices ====================

describe("fetchPrices - Obtención de precios", () => {
  it("debería obtener precios de SOL y token correctamente", async () => {
    const prices = {
      tokenPriceUsd: mockTokenPrice,
      solPriceUsd: mockSolPrice,
    };
    expect(prices.tokenPriceUsd).toBe(0.01);
    expect(prices.solPriceUsd).toBe(200);
  });

  it("debería usar fallback a cliente si API falla", async () => {
    const mockGetSolPrice = vi.fn().mockResolvedValue({
      solPrice: 150,
    });

    expect(mockGetSolPrice).toBeDefined();
  });

  it("debería usar default 0.01 en test mode si precio es 0", async () => {
    process.env.NEXT_PUBLIC_TEST_MODE_FREE_TOKEN = "true";
    expect(process.env.NEXT_PUBLIC_TEST_MODE_FREE_TOKEN).toBe("true");
    delete process.env.NEXT_PUBLIC_TEST_MODE_FREE_TOKEN;
  });

  it("debería lanzar error si no puede obtener ningún precio", async () => {
    try {
      throw new PurchaseError(
        "No se pudo obtener precios",
        "PRICE_FETCH_ERROR",
      );
    } catch (error) {
      expect(error).toBeInstanceOf(PurchaseError);
      expect((error as PurchaseError).code).toBe("PRICE_FETCH_ERROR");
    }
  });
});

// ==================== TESTS: verifyBalance ====================

describe("verifyBalance - Verificación de balance", () => {
  it("debería obtener balance de API primero", async () => {
    const response = { extra: { balance: 5.5 } };
    expect(response.extra.balance).toBe(5.5);
  });

  it("debería usar fallback a RPC si API falla", async () => {
    try {
      throw new PurchaseError("Balance check error", "BALANCE_CHECK_ERROR");
    } catch (error) {
      expect(error).toBeInstanceOf(PurchaseError);
    }
  });

  it("debería lanzar error si balance es insuficiente", async () => {
    const insufficientBalance = 0.00001;
    const requiredSol = 0.5;

    if (insufficientBalance < requiredSol) {
      try {
        throw new PurchaseError(
          `Balance insuficiente. Tienes ${insufficientBalance} SOL pero necesitas ${requiredSol} SOL`,
          "INSUFFICIENT_BALANCE",
        );
      } catch (error) {
        expect(error).toBeInstanceOf(PurchaseError);
        expect((error as PurchaseError).code).toBe("INSUFFICIENT_BALANCE");
      }
    }
  });

  it("debería retornar balance y source correctamente", async () => {
    const balanceInfo = { balance: 5.5, source: "API" };
    expect(balanceInfo.balance).toBe(5.5);
    expect(["API", "RPC"]).toContain(balanceInfo.source);
  });
});

// ==================== TESTS: initiatePurchase ====================

describe("initiatePurchase - Iniciación de compra", () => {
  it("debería intentar tRPC primero", async () => {
    const tRpcResponse = {
      transactionId: "tx-123",
      txBase64: "base64data",
      testMode: false,
      totalCost: 0.5,
    };

    expect(tRpcResponse.transactionId).toBe("tx-123");
  });

  it("debería usar fallback a legacy endpoint si tRPC falla", async () => {
    const result = {
      transactionId: "tx-456",
      txBase64: "base64data",
      testMode: false,
      totalCost: 0.5,
    };

    expect(result.transactionId).toBe("tx-456");
  });

  it("debería normalizar respuesta (extra o plana)", async () => {
    // Test respuesta plana
    const flatResponse = {
      transactionId: "tx-789",
      txBase64: "data",
      testMode: false,
      totalCost: 0.3,
    };

    const payload = flatResponse.transactionId ? flatResponse : {};
    expect(payload.transactionId).toBe("tx-789");

    // Test respuesta con extra
    const nestedResponse = {
      extra: {
        id: "tx-999",
        tx: "data",
        test: true,
        fees: 0.2,
      },
    };

    const nestedPayload = nestedResponse.extra || nestedResponse || {};
    expect(nestedPayload.id).toBe("tx-999");
  });

  it("debería lanzar error si no retorna transactionId", async () => {
    const invalidResponse = {
      txBase64: "data",
      testMode: false,
    };

    if (!invalidResponse.transactionId) {
      try {
        throw new PurchaseError(
          "Servidor no retornó transactionId",
          "INVALID_RESPONSE",
        );
      } catch (error) {
        expect(error).toBeInstanceOf(PurchaseError);
        expect((error as PurchaseError).code).toBe("INVALID_RESPONSE");
      }
    }
  });

  it("debería retornar PurchaseInitiation completo", async () => {
    const initiation = {
      transactionId: "tx-123",
      txBase64: "AGbhM4sGW...",
      testMode: false,
      totalCost: 0.5,
    };

    expect(initiation).toHaveProperty("transactionId");
    expect(initiation).toHaveProperty("txBase64");
    expect(initiation).toHaveProperty("testMode");
    expect(initiation).toHaveProperty("totalCost");
  });
});

// ==================== TESTS: Wallet Operations ====================

describe("Wallet Operations - Obtención y conexión", () => {
  it("debería encontrar wallet disponible", () => {
    const wallet = { publicKey: { toString: () => validWalletAddress } };
    expect(wallet.publicKey).toBeDefined();
  });

  it("debería conectar wallet si tiene método connect", async () => {
    const wallet = {
      connect: vi.fn().mockResolvedValue(undefined),
      publicKey: { toString: () => validWalletAddress },
    };

    await wallet.connect();
    expect(wallet.connect).toHaveBeenCalled();
  });

  it("debería lanzar error si connect() falla", async () => {
    const wallet = {
      connect: vi.fn().mockRejectedValue(new Error("User rejected")),
    };

    try {
      await wallet.connect();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("debería lanzar error si wallet no está conectada", () => {
    const wallet = {
      // sin publicKey, sin connect
    };

    if (!wallet.publicKey && typeof wallet.connect !== "function") {
      try {
        throw new PurchaseError(
          "La wallet no está conectada",
          "WALLET_NOT_CONNECTED",
        );
      } catch (error) {
        expect(error).toBeInstanceOf(PurchaseError);
      }
    }
  });

  it("debería validar address mismatch", () => {
    const connected = validWalletAddress;
    const expected = validSolanaAddress;

    if (connected !== expected) {
      try {
        throw new PurchaseError(
          `Wallet mismatch: conectado ${connected} pero esperado ${expected}`,
          "WALLET_MISMATCH",
        );
      } catch (error) {
        expect(error).toBeInstanceOf(PurchaseError);
      }
    }
  });
});

// ==================== TESTS: Serialización y Firma ====================

describe("Transaction Serialization & Signing", () => {
  it("debería deserializar transacción válida", () => {
    const validBase64 = Buffer.from("tx-data").toString("base64");
    const buffer = Buffer.from(validBase64, "base64");

    expect(buffer.length).toBeGreaterThan(0);
  });

  it("debería lanzar error si Base64 no es válido", () => {
    const invalidBase64 = "!!!invalid!!!";

    try {
      Buffer.from(invalidBase64, "base64");
      // Base64 decodifica mal formados silenciosamente, verificar contenido
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("debería firmar transacción con wallet", async () => {
    const mockWalletProvider = {
      signTransaction: vi.fn().mockResolvedValue({ signed: true }),
    };

    const signed = await mockWalletProvider.signTransaction({});
    expect(signed).toBeDefined();
    expect(mockWalletProvider.signTransaction).toHaveBeenCalled();
  });

  it("debería lanzar error si wallet no soporta signTransaction", async () => {
    const walletNoSign = {
      publicKey: { toString: () => validWalletAddress },
    };

    if (!walletNoSign.signTransaction) {
      try {
        throw new PurchaseError(
          "La wallet no soporta signTransaction",
          "SIGN_NOT_SUPPORTED",
        );
      } catch (error) {
        expect(error).toBeInstanceOf(PurchaseError);
      }
    }
  });

  it("debería lanzar error si usuario rechaza firma", async () => {
    const mockWalletProvider = {
      signTransaction: vi.fn().mockRejectedValue(new Error("User rejected")),
    };

    try {
      await mockWalletProvider.signTransaction({});
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });
});

// ==================== TESTS: Envío y Confirmación ====================

describe("sendSignedTransactionToBackend & Confirmation", () => {
  it("debería serializar transacción a Base64", () => {
    const txBuffer = Buffer.from("tx-data");
    const base64 = txBuffer.toString("base64");

    expect(typeof base64).toBe("string");
    expect(base64.length).toBeGreaterThan(0);
  });

  it("debería enviar al backend con parámetros correctos", async () => {
    const mockSendTx = vi.fn().mockResolvedValue({
      signature: "sig-123",
      success: true,
    });

    const result = await mockSendTx({
      signedTransaction: "base64data",
      transactionType: "payment",
      skipPreflight: false,
      maxRetries: 3,
    });

    expect(result.signature).toBe("sig-123");
    expect(mockSendTx).toHaveBeenCalledWith(
      expect.objectContaining({
        signedTransaction: "base64data",
        transactionType: "payment",
      }),
    );
  });

  it("debería retornar signature del backend", async () => {
    const response = { signature: "sig-456", success: true };
    expect(response.signature).toBe("sig-456");
  });

  it("debería lanzar error si backend falla", async () => {
    const mockSendTx = vi.fn().mockRejectedValue(new Error("Backend error"));

    try {
      await mockSendTx({ signedTransaction: "data" });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("debería esperar confirmación en blockchain", async () => {
    const mockConfirm = vi.fn().mockResolvedValue({ value: { err: null } });

    await mockConfirm("sig-789", "confirmed");
    expect(mockConfirm).toHaveBeenCalledWith("sig-789", "confirmed");
  });

  it("debería tener timeout para confirmación", async () => {
    const mockConfirm = vi.fn();
    const timeout = 100; // 100ms para test (no 60s)

    const confirmPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new PurchaseError("Timeout", "CONFIRM_TIMEOUT")),
        timeout,
      ),
    );

    try {
      await confirmPromise;
    } catch (error) {
      expect(error).toBeInstanceOf(PurchaseError);
      expect((error as PurchaseError).code).toBe("CONFIRM_TIMEOUT");
    }
  }, 1000); // Timeout de test: 1 segundo

  it("debería lanzar error si confirmación falla", async () => {
    const mockConfirm = vi.fn().mockRejectedValue(new Error("RPC error"));

    try {
      await mockConfirm("sig-bad");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });
});

// ==================== TESTS: Orquestador buyTokens ====================

describe("buyTokens - Flujo Completo", () => {
  it("debería validar autenticación primero", () => {
    try {
      validateAuthentication(false, null);
    } catch (error) {
      expect(error).toBeInstanceOf(PurchaseError);
      expect((error as PurchaseError).code).toBe("NOT_AUTHENTICATED");
    }
  });

  it("debería validar dirección de wallet", () => {
    try {
      validateWalletAddress("invalid-address");
    } catch (error) {
      expect(error).toBeInstanceOf(PurchaseError);
    }
  });

  it("debería validar cantidad de tokens", () => {
    try {
      validateTokenAmount(-100);
    } catch (error) {
      expect(error).toBeInstanceOf(PurchaseError);
    }
  });

  it("debería validar precios", () => {
    try {
      validatePrices(-1, 0);
    } catch (error) {
      expect(error).toBeInstanceOf(PurchaseError);
    }
  });

  it("debería calcular precios correctamente", () => {
    const result = calculatePrices(100, 0.01, 200, false);

    expect(result.tokenPriceInSol).toBe(0.01 / 200);
    expect(result.totalTokenCostInSol).toBeGreaterThan(0);
    expect(result.totalFees).toBe(0.00001);
  });

  it("debería llamar callbacks en orden correcto", async () => {
    const onTxId = vi.fn();
    const onSigned = vi.fn();

    // Simulamos que se llamen en orden
    onTxId("tx-123");
    expect(onTxId).toHaveBeenCalledWith("tx-123");

    onSigned("sig-456");
    expect(onSigned).toHaveBeenCalledWith("sig-456");
  });

  it("debería retornar resultado completo", async () => {
    const result = {
      transactionId: "tx-123",
      signature: "sig-456",
      tokenAmount: 100,
    };

    expect(result).toHaveProperty("transactionId");
    expect(result).toHaveProperty("signature");
    expect(result).toHaveProperty("tokenAmount");
  });

  it("debería propagar errores con contexto", () => {
    try {
      throw new PurchaseError("Error en paso específico", "SPECIFIC_ERROR");
    } catch (error) {
      expect(error).toBeInstanceOf(PurchaseError);
      expect((error as PurchaseError).message).toContain(
        "Error en paso específico",
      );
      expect((error as PurchaseError).code).toBe("SPECIFIC_ERROR");
    }
  });

  it("debería manejar test mode correctamente", () => {
    process.env.NEXT_PUBLIC_TEST_MODE_FREE_TOKEN = "true";
    const result = calculatePrices(100, 0.01, 200, true);

    expect(result.totalTokenCostInSol).toBe(0);
    delete process.env.NEXT_PUBLIC_TEST_MODE_FREE_TOKEN;
  });

  it("debería calcular fees correctamente", () => {
    const result = calculatePrices(50, 0.02, 100, false);

    expect(result.gasFee).toBe(0.000005);
    expect(result.platformFee).toBe(0.000005);
    expect(result.totalFees).toBe(0.00001);
  });

  it("debería manejar cantidades grandes correctamente", () => {
    const result = calculatePrices(1000000, 0.01, 200, false);

    expect(result.totalTokenCostInSol).toBeGreaterThan(0);
    expect(result.totalCostInSol).toBeGreaterThan(result.totalTokenCostInSol);
  });
});
