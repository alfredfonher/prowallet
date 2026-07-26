/**
 * Tests simples para purchase-service.ts
 * TDD: Tests primero
 * Entorno: Node puro sin React/Vite
 */

import { describe, it, expect } from "vitest";
import {
  validateAuthentication,
  validateWalletAddress,
  validateTokenAmount,
  validatePrices,
  calculatePrices,
  PurchaseError,
} from "../purchase-service";

// ==================== VALIDACIÓN: AUTENTICACIÓN ====================

describe("validateAuthentication", () => {
  it("debería lanzar error si no está autenticado", () => {
    expect(() => validateAuthentication(false, null)).toThrow(PurchaseError);
    expect(() => validateAuthentication(false, null)).toThrow(
      "Debes estar autenticado",
    );
  });

  it("debería lanzar error si no hay usuario", () => {
    expect(() => validateAuthentication(true, null)).toThrow(PurchaseError);
  });

  it("debería pasar si está autenticado con usuario", () => {
    expect(() => validateAuthentication(true, { id: "123" })).not.toThrow();
  });
});

// ==================== VALIDACIÓN: DIRECCIÓN DE WALLET ====================

describe("validateWalletAddress", () => {
  it("debería lanzar error si la dirección está vacía", () => {
    expect(() => validateWalletAddress("")).toThrow(PurchaseError);
  });

  it("debería lanzar error si la dirección solo tiene espacios", () => {
    expect(() => validateWalletAddress("   ")).toThrow(PurchaseError);
  });

  it("debería lanzar error si la dirección no es válida en Solana", () => {
    expect(() => validateWalletAddress("invalid-address!")).toThrow(
      PurchaseError,
    );
  });

  it("debería pasar con una dirección válida", () => {
    const validAddress = "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD";
    expect(() => validateWalletAddress(validAddress)).not.toThrow();
  });

  it("debería validar formato base58 de Solana", () => {
    // Direcciones inválidas de Solana
    const invalidAddresses = [
      "0x1234567890", // Formato Ethereum
      "InvalidAddress", // Caracteres inválidos (0, O, I, l)
      "abc123", // Muy corta
    ];

    invalidAddresses.forEach((addr) => {
      expect(() => validateWalletAddress(addr)).toThrow(PurchaseError);
    });
  });
});

// ==================== VALIDACIÓN: CANTIDAD DE TOKENS ====================

describe("validateTokenAmount", () => {
  it("debería lanzar error si la cantidad es 0", () => {
    expect(() => validateTokenAmount(0)).toThrow(PurchaseError);
    expect(() => validateTokenAmount(0)).toThrow("mayor a 0");
  });

  it("debería lanzar error si la cantidad es negativa", () => {
    expect(() => validateTokenAmount(-5)).toThrow(PurchaseError);
  });

  it("debería lanzar error si la cantidad es Infinity", () => {
    expect(() => validateTokenAmount(Infinity)).toThrow(PurchaseError);
    expect(() => validateTokenAmount(-Infinity)).toThrow(PurchaseError);
  });

  it("debería lanzar error si la cantidad es NaN", () => {
    expect(() => validateTokenAmount(NaN)).toThrow(PurchaseError);
  });

  it("debería pasar con cantidades positivas válidas", () => {
    expect(() => validateTokenAmount(1)).not.toThrow();
    expect(() => validateTokenAmount(100)).not.toThrow();
    expect(() => validateTokenAmount(0.001)).not.toThrow();
    expect(() => validateTokenAmount(999999)).not.toThrow();
  });
});

// ==================== VALIDACIÓN: PRECIOS ====================

describe("validatePrices", () => {
  it("debería lanzar error si el precio del token es inválido", () => {
    expect(() => validatePrices(0, 100)).toThrow(PurchaseError);
    expect(() => validatePrices(-5, 100)).toThrow(PurchaseError);
    expect(() => validatePrices(NaN, 100)).toThrow(PurchaseError);
    expect(() => validatePrices(Infinity, 100)).toThrow(PurchaseError);
  });

  it("debería lanzar error si el precio de SOL es inválido", () => {
    expect(() => validatePrices(0.01, 0)).toThrow(PurchaseError);
    expect(() => validatePrices(0.01, -1)).toThrow(PurchaseError);
    expect(() => validatePrices(0.01, NaN)).toThrow(PurchaseError);
    expect(() => validatePrices(0.01, Infinity)).toThrow(PurchaseError);
  });

  it("debería pasar con precios válidos positivos", () => {
    expect(() => validatePrices(0.01, 132.5)).not.toThrow();
    expect(() => validatePrices(0.001, 50)).not.toThrow();
    expect(() => validatePrices(1, 1)).not.toThrow();
  });
});

// ==================== CÁLCULO: PRECIOS ====================

describe("calculatePrices", () => {
  it("debería calcular precio de token en SOL correctamente", () => {
    const result = calculatePrices(100, 0.01, 132.5, false);

    const expectedPriceInSol = 0.01 / 132.5;
    expect(result.tokenPriceInSol).toBeCloseTo(expectedPriceInSol, 8);
  });

  it("debería calcular costo total del token correctamente en modo normal", () => {
    const tokenAmount = 100;
    const tokenPrice = 0.01;
    const solPrice = 132.5;

    const result = calculatePrices(tokenAmount, tokenPrice, solPrice, false);

    const expectedTokenCost = (tokenPrice / solPrice) * tokenAmount;
    expect(result.totalTokenCostInSol).toBeCloseTo(expectedTokenCost, 8);
  });

  it("debería incluir fees correctamente", () => {
    const result = calculatePrices(100, 0.01, 132.5, false);

    expect(result.gasFee).toBe(0.000005);
    expect(result.platformFee).toBe(0.000005);
    expect(result.totalFees).toBe(0.00001);
  });

  it("debería calcular costo total = token + fees en modo normal", () => {
    const result = calculatePrices(100, 0.01, 132.5, false);

    const expected = result.totalTokenCostInSol + result.totalFees;
    expect(result.totalCostInSol).toBeCloseTo(expected, 8);
  });

  it("debería cobrar solo fees en test mode (tokens gratis)", () => {
    const result = calculatePrices(100, 0.01, 132.5, true);

    expect(result.totalTokenCostInSol).toBe(0);
    expect(result.totalCostInSol).toBe(0.00001); // Solo fees
  });

  it("debería validar precios antes de calcular", () => {
    expect(() => calculatePrices(100, 0, 132.5, false)).toThrow(PurchaseError);
    expect(() => calculatePrices(100, 0.01, 0, false)).toThrow(PurchaseError);
  });

  it("debería manejar cantidades muy pequeñas", () => {
    const result = calculatePrices(0.001, 0.01, 132.5, false);

    expect(result.totalTokenCostInSol).toBeGreaterThan(0);
    expect(isFinite(result.totalCostInSol)).toBe(true);
  });

  it("debería manejar cantidades muy grandes", () => {
    const result = calculatePrices(1000000, 0.01, 132.5, false);

    expect(result.totalTokenCostInSol).toBeGreaterThan(0);
    expect(isFinite(result.totalCostInSol)).toBe(true);
  });

  it("debería ser consistente con múltiples cálculos", () => {
    const params = [100, 0.01, 132.5, false] as const;
    const result1 = calculatePrices(...params);
    const result2 = calculatePrices(...params);

    expect(result1.totalCostInSol).toBe(result2.totalCostInSol);
  });
});

// ==================== ERROR HANDLING ====================

describe("PurchaseError", () => {
  it("debería crear error con mensaje y código", () => {
    const error = new PurchaseError("Test error", "TEST_CODE");

    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_CODE");
    expect(error.name).toBe("PurchaseError");
  });

  it("debería ser instancia de Error", () => {
    const error = new PurchaseError("Test", "CODE");
    expect(error instanceof Error).toBe(true);
    expect(error instanceof PurchaseError).toBe(true);
  });

  it("debería poder ser catcheado como Error normal", () => {
    const error = new PurchaseError("Test", "CODE");
    let caught = false;

    try {
      throw error;
    } catch (e) {
      caught = true;
      expect(e instanceof Error).toBe(true);
    }

    expect(caught).toBe(true);
  });

  it("debería tener stack trace", () => {
    const error = new PurchaseError("Test error", "TEST_CODE");
    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe("string");
  });
});

// ==================== INTEGRACIÓN: FLUJO COMPLETO ====================

describe("Purchase Flow - Validaciones", () => {
  it("debería validar todos los parámetros de entrada", () => {
    const validParams = {
      isAuthenticated: true,
      user: { id: "123" },
      walletAddress: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
      tokenAmount: 100,
      tokenPrice: 0.01,
      solPrice: 132.5,
    };

    // Validar cada uno
    expect(() =>
      validateAuthentication(validParams.isAuthenticated, validParams.user),
    ).not.toThrow();
    expect(() =>
      validateWalletAddress(validParams.walletAddress),
    ).not.toThrow();
    expect(() => validateTokenAmount(validParams.tokenAmount)).not.toThrow();
    expect(() =>
      validatePrices(validParams.tokenPrice, validParams.solPrice),
    ).not.toThrow();
  });

  it("debería rechazar flujo incompleto (no autenticado)", () => {
    expect(() => validateAuthentication(false, null)).toThrow();
  });

  it("debería rechazar wallet inválida", () => {
    expect(() => validateWalletAddress("not-a-wallet")).toThrow();
  });

  it("debería rechazar cantidad negativa", () => {
    expect(() => validateTokenAmount(-100)).toThrow();
  });

  it("debería rechazar precios inválidos", () => {
    expect(() => validatePrices(0, 100)).toThrow();
    expect(() => validatePrices(0.01, 0)).toThrow();
  });
});
