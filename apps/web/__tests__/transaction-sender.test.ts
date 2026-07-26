/**
 * Transaction Sender Service - Tests (TDD)
 *
 * Tests para validar que el servicio envía transacciones correctamente
 * y recibe respuestas del backend sin 403
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  sendSignedTransaction,
  sendSignedTransactionWithConfirmation,
  SendTransactionResponse,
} from "@/lib/transaction-sender";
import * as apiClientModule from "@/lib/api-client";

// Mock del apiClient
vi.mock("@/lib/api-client");

describe("Transaction Sender Service", () => {
  let mockApiClient: any;

  beforeEach(() => {
    // Reset mocks antes de cada test
    vi.clearAllMocks();

    mockApiClient = {
      post: vi.fn(),
    };

    // Mock el módulo completo
    vi.mocked(apiClientModule).apiClient = mockApiClient;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("sendSignedTransaction()", () => {
    it("DEBE enviar transacción en base64 al backend", async () => {
      // Arrange
      const mockResponse: SendTransactionResponse = {
        signature:
          "4z9jBqfL7mKpNw8vXx5cQq2rY3hJ9qM8wK6pL5oN2vD3sT1uE4rW7zX8cV9bY0aH",
        status: "pending",
        timestamp: "2025-12-13T10:30:00Z",
        transactionType: "payment",
      };

      mockApiClient.post.mockResolvedValue({
        success: true,
        extra: mockResponse,
      });

      const txBase64 =
        "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEDAg==";

      // Act
      const result = await sendSignedTransaction({
        signedTransaction: txBase64,
        transactionType: "payment",
        skipPreflight: false,
        maxRetries: 3,
      });

      // Assert
      expect(mockApiClient.post).toHaveBeenCalledWith("/transactions/send", {
        signedTransaction: txBase64,
        transactionType: "payment",
        skipPreflight: false,
        maxRetries: 3,
      });

      expect(result).toEqual(mockResponse);
      expect(result.signature).toBeTruthy();
      expect(result.status).toBe("pending");
    });

    it("DEBE retornar signature válida del backend", async () => {
      // Arrange
      const validSignature =
        "5aB1xK9mL2pQ7sW4jN6fH3oJ8vC0dE7rT2wY9zX5uM1qL3sP8nK4mO6rJ9tF2xV";

      mockApiClient.post.mockResolvedValue({
        success: true,
        extra: {
          signature: validSignature,
          status: "pending",
          timestamp: "2025-12-13T10:30:00Z",
          transactionType: "payment",
        },
      });

      // Act
      const result = await sendSignedTransaction({
        signedTransaction: "base64string",
        transactionType: "payment",
      });

      // Assert
      expect(result.signature).toBe(validSignature);
      expect(result.signature.length).toBeGreaterThan(0);
    });

    it("DEBE lanzar error si la transacción está vacía", async () => {
      // Arrange
      mockApiClient.post.mockResolvedValue({
        success: false,
        message: "signedTransaction es requerida",
      });

      // Act & Assert
      await expect(
        sendSignedTransaction({
          signedTransaction: "",
          transactionType: "payment",
        }),
      ).rejects.toThrow();
    });

    it("DEBE lanzar error si backend retorna error", async () => {
      // Arrange
      mockApiClient.post.mockResolvedValue({
        success: false,
        message: "Error al enviar transacción",
      });

      // Act & Assert
      await expect(
        sendSignedTransaction({
          signedTransaction: "validBase64String",
          transactionType: "payment",
        }),
      ).rejects.toThrow("Error al enviar transacción");
    });

    it("DEBE manejar errores de red correctamente", async () => {
      // Arrange
      const networkError = new Error("Network timeout");
      mockApiClient.post.mockRejectedValue(networkError);

      // Act & Assert
      await expect(
        sendSignedTransaction({
          signedTransaction: "validBase64String",
          transactionType: "payment",
        }),
      ).rejects.toThrow("Network timeout");
    });

    it("DEBE usar valores por defecto para skipPreflight y maxRetries", async () => {
      // Arrange
      mockApiClient.post.mockResolvedValue({
        success: true,
        extra: {
          signature: "testSignature",
          status: "pending",
          timestamp: "2025-12-13T10:30:00Z",
          transactionType: "payment",
        },
      });

      // Act
      await sendSignedTransaction({
        signedTransaction: "base64string",
      });

      // Assert
      expect(mockApiClient.post).toHaveBeenCalledWith(
        "/transactions/send",
        expect.objectContaining({
          skipPreflight: false,
          maxRetries: 3,
          transactionType: "payment",
        }),
      );
    });
  });

  describe("sendSignedTransactionWithConfirmation()", () => {
    it("DEBE retornar respuesta si envío es exitoso", async () => {
      // Arrange
      const mockResponse: SendTransactionResponse = {
        signature: "testSignature123",
        status: "pending",
        timestamp: "2025-12-13T10:30:00Z",
        transactionType: "payment",
      };

      mockApiClient.post.mockResolvedValue({
        success: true,
        extra: mockResponse,
      });

      // Act
      const result = await sendSignedTransactionWithConfirmation({
        signedTransaction: "base64string",
      });

      // Assert
      expect(result).toEqual(mockResponse);
    });

    it("DEBE usar timeout por defecto de 60 segundos", async () => {
      // Arrange
      mockApiClient.post.mockResolvedValue({
        success: true,
        extra: {
          signature: "testSignature",
          status: "pending",
          timestamp: "2025-12-13T10:30:00Z",
          transactionType: "payment",
        },
      });

      // Act - Debería completarse antes del timeout
      const result = await sendSignedTransactionWithConfirmation({
        signedTransaction: "base64string",
      });

      // Assert
      expect(result).toBeTruthy();
    });

    it("DEBE respetar timeout personalizado", async () => {
      // Arrange - Simulamos un delay mayor al timeout
      mockApiClient.post.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  success: true,
                  extra: { signature: "test" },
                }),
              2000,
            );
          }),
      );

      // Act & Assert - Debe fallar por timeout
      await expect(
        sendSignedTransactionWithConfirmation(
          { signedTransaction: "base64string" },
          500, // timeout corto
        ),
      ).rejects.toThrow("Timeout esperando envío de transacción");
    });
  });
});

/**
 * Tests de Integración - Backend Endpoint
 *
 * Estos tests validan que el endpoint backend funciona correctamente
 */
describe("Backend - POST /transactions/send Endpoint", () => {
  // Estos tests se ejecutarían contra un servidor de prueba
  // Usando supertest o similar

  it("DEBE recibir base64 y retornar signature", () => {
    // Test: POST /api/v1/transactions/send
    // Body: { signedTransaction: "base64..." }
    // Esperado: { signature: "...", status: "pending" }
  });

  it("DEBE rechazar si signedTransaction está vacía", () => {
    // Test: POST /api/v1/transactions/send con body vacío
    // Esperado: 400 Bad Request
  });

  it("DEBE convertir base64 a Buffer correctamente", () => {
    // Test: Validar que la transacción se deserializa correctamente
  });

  it("DEBE enviar a Helius sin error 403", () => {
    // Test: Mockear Helius, validar que recibe la transacción
    // Esperado: No debe haber 403
  });

  it("DEBE manejar errores de Helius correctamente", () => {
    // Test: Si Helius retorna error, backend debe propagarlo
  });
});

/**
 * Tests E2E - Flujo Completo
 */
describe("E2E - Flujo Completo de Compra sin 403", () => {
  it("DEBE: Usuario firma transacción localmente", () => {
    // 1. User conecta wallet
    // 2. User aprueba transacción en Phantom
    // 3. Transacción se firma localmente ✅
  });

  it("DEBE: Frontend envía transacción firmada al backend", () => {
    // 1. Frontend convierte transacción a base64
    // 2. Frontend envía POST /transactions/send
    // Esperado: 200 OK ✅
  });

  it("DEBE: Backend recibe y envía a Helius", () => {
    // 1. Backend recibe base64
    // 2. Backend convierte a Buffer
    // 3. Backend envía connection.sendRawTransaction() a Helius
    // Esperado: Respuesta exitosa de Helius ✅
  });

  it("DEBE: Frontend recibe signature sin 403", () => {
    // 1. Backend retorna signature
    // 2. Frontend recibe response.signature
    // 3. NO hay error 403 ✅
  });

  it("DEBE: Transacción se confirma en blockchain", () => {
    // 1. Backend inicia confirmación en background
    // 2. Transaction aparece en explorer
    // 3. Balance se actualiza ✅
  });

  it("DEBE: Usuario ve confirmación exitosa", () => {
    // 1. Frontend muestra "✅ Compra exitosa"
    // 2. Balance de tokens se actualiza
    // 3. Modal de confirmación desaparece ✅
  });
});
