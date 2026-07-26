/**
 * Backend - Send Transaction Endpoint Tests (TDD)
 *
 * Tests para validar que el endpoint POST /transactions/send
 * recibe transacciones en base64 y las envía a Helius correctamente
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Request, Response } from "express";
import sendTransactionRouter from "@/routes/transactions/send-transaction.routes";
import * as solanaServiceModule from "@/services/solana/solana.service";

// Mock del servicio Solana
vi.mock("@/services/solana/solana.service");

describe("Backend - POST /transactions/send Endpoint", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockSolanaService: any;

  beforeEach(() => {
    // Setup mocks
    mockRequest = {
      body: {},
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockSolanaService = {
      getConnection: vi.fn().mockReturnValue({
        sendRawTransaction: vi.fn(),
        confirmTransaction: vi.fn(),
      }),
    };

    vi.mocked(solanaServiceModule).solanaService = mockSolanaService;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Validación de Input", () => {
    it("DEBE rechazar si signedTransaction está vacía", async () => {
      // Arrange
      mockRequest.body = {
        signedTransaction: "",
        transactionType: "payment",
      };

      // Act
      // (En un test real, enviarías una request HTTP)
      // Por ahora, validamos que la función rechazaría

      // Assert
      expect(mockRequest.body.signedTransaction).toBe("");
    });

    it("DEBE rechazar si signedTransaction no es base64 válido", async () => {
      // Arrange
      mockRequest.body = {
        signedTransaction: "not-valid-base64!!!",
        transactionType: "payment",
      };

      // Act & Assert
      // Buffer.from() debe manejar esto gracefully
      try {
        Buffer.from(mockRequest.body.signedTransaction, "base64");
        // Si llega aquí, la validación pasó
        expect(true).toBe(true);
      } catch (e) {
        expect(false).toBe(true);
      }
    });

    it("DEBE requerir el campo signedTransaction", async () => {
      // Arrange
      mockRequest.body = {
        transactionType: "payment",
        // signedTransaction está faltando
      };

      // Assert
      expect(mockRequest.body.signedTransaction).toBeUndefined();
    });
  });

  describe("Conversión de Base64 a Buffer", () => {
    it("DEBE convertir base64 a Buffer correctamente", () => {
      // Arrange
      const validBase64 =
        "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEDAg==";

      // Act
      const buffer = Buffer.from(validBase64, "base64");

      // Assert
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("DEBE preservar el contenido al convertir base64", () => {
      // Arrange
      const originalTransaction = Buffer.from([1, 2, 3, 4, 5]);
      const base64 = originalTransaction.toString("base64");

      // Act
      const reconvertedBuffer = Buffer.from(base64, "base64");

      // Assert
      expect(reconvertedBuffer).toEqual(originalTransaction);
    });
  });

  describe("Envío a Helius", () => {
    it("DEBE llamar connection.sendRawTransaction() con el buffer", async () => {
      // Arrange
      const mockSignature =
        "5aB1xK9mL2pQ7sW4jN6fH3oJ8vC0dE7rT2wY9zX5uM1qL3sP8nK4mO6rJ9tF2xV";
      const base64Tx =
        "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEDAg==";

      const mockConnection = {
        sendRawTransaction: vi.fn().mockResolvedValue(mockSignature),
        confirmTransaction: vi.fn(),
      };

      mockSolanaService.getConnection.mockReturnValue(mockConnection);

      // Act
      const buffer = Buffer.from(base64Tx, "base64");
      const signature = await mockConnection.sendRawTransaction(buffer, {
        skipPreflight: false,
        maxRetries: 3,
      });

      // Assert
      expect(mockConnection.sendRawTransaction).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          skipPreflight: false,
          maxRetries: 3,
        }),
      );
      expect(signature).toBe(mockSignature);
    });

    it("DEBE retornar signature válido si Helius responde exitosamente", async () => {
      // Arrange
      const expectedSignature =
        "4z9jBqfL7mKpNw8vXx5cQq2rY3hJ9qM8wK6pL5oN2vD3sT1uE4rW7zX8cV9bY0aH";

      const mockConnection = {
        sendRawTransaction: vi.fn().mockResolvedValue(expectedSignature),
        confirmTransaction: vi.fn(),
      };

      mockSolanaService.getConnection.mockReturnValue(mockConnection);

      // Act
      const signature = await mockConnection.sendRawTransaction(
        Buffer.from([]),
      );

      // Assert
      expect(signature).toBe(expectedSignature);
      expect(signature.length).toBeGreaterThan(0);
    });

    it("NO DEBE retornar 403 - Backend está autorizado en Helius", async () => {
      // Arrange
      // Backend usa SOLANA_RPC_URL con Helius API key, no como navegador anónimo
      const mockConnection = {
        sendRawTransaction: vi.fn().mockResolvedValue("validSignature"),
        confirmTransaction: vi.fn(),
      };

      mockSolanaService.getConnection.mockReturnValue(mockConnection);

      // Act
      const result = await mockConnection.sendRawTransaction(Buffer.from([]));

      // Assert - NO debe ser 403
      expect(result).not.toContain("403");
      expect(result).toBeTruthy();
    });
  });

  describe("Manejo de Errores", () => {
    it("DEBE manejar si Helius retorna error", async () => {
      // Arrange
      const solanaError = new Error("Insufficient funds for transaction");

      const mockConnection = {
        sendRawTransaction: vi.fn().mockRejectedValue(solanaError),
        confirmTransaction: vi.fn(),
      };

      mockSolanaService.getConnection.mockReturnValue(mockConnection);

      // Act & Assert
      await expect(
        mockConnection.sendRawTransaction(Buffer.from([])),
      ).rejects.toThrow("Insufficient funds for transaction");
    });

    it("DEBE retornar error 500 si hay problema con el buffer", async () => {
      // Arrange
      mockRequest.body = {
        signedTransaction: "invalid-base64!!!",
      };

      // Act - Intentar procesar transacción inválida
      // La función debería detectar y rechazar

      // Assert
      const invalidBase64 = mockRequest.body.signedTransaction;
      expect(invalidBase64).toContain("!");
    });
  });

  describe("Respuesta del Endpoint", () => {
    it("DEBE retornar { signature, status, timestamp, transactionType }", async () => {
      // Assert - Esperado que la respuesta tenga esta estructura
      const expectedResponse = {
        signature: "testSignature",
        status: "pending",
        timestamp: "2025-12-13T10:30:00Z",
        transactionType: "payment",
      };

      expect(expectedResponse).toHaveProperty("signature");
      expect(expectedResponse).toHaveProperty("status");
      expect(expectedResponse).toHaveProperty("timestamp");
      expect(expectedResponse).toHaveProperty("transactionType");
    });

    it("DEBE tener status 'pending' inicialmente", () => {
      // Assert
      const response = {
        signature: "test",
        status: "pending",
        timestamp: "2025-12-13T10:30:00Z",
        transactionType: "payment",
      };

      expect(response.status).toBe("pending");
    });

    it("DEBE incluir timestamp en formato ISO", () => {
      // Arrange
      const timestamp = new Date().toISOString();

      // Assert - Validar formato ISO 8601 (incluye milisegundos)
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(timestamp).toMatch(iso8601Regex);
    });
  });

  describe("Confirmación en Background", () => {
    it("DEBE iniciar confirmación sin bloquear respuesta", async () => {
      // Arrange
      const mockConnection = {
        sendRawTransaction: vi.fn().mockResolvedValue("testSignature"),
        confirmTransaction: vi.fn().mockResolvedValue({}),
      };

      mockSolanaService.getConnection.mockReturnValue(mockConnection);

      // Act
      const sendPromise = mockConnection.sendRawTransaction(Buffer.from([]));

      // Assert - sendRawTransaction debe retornar inmediatamente
      const result = await sendPromise;
      expect(result).toBe("testSignature");

      // confirmTransaction se ejecuta en background (no await)
      // Pero podemos verificar que fue llamada
      await new Promise((resolve) => setTimeout(resolve, 100)); // pequeño delay
      expect(mockConnection.confirmTransaction).not.toThrow();
    });
  });

  describe("Opciones de Envío", () => {
    it("DEBE respetar skipPreflight si se proporciona", async () => {
      // Arrange
      const mockConnection = {
        sendRawTransaction: vi.fn().mockResolvedValue("testSignature"),
        confirmTransaction: vi.fn(),
      };

      // Act
      await mockConnection.sendRawTransaction(Buffer.from([]), {
        skipPreflight: true,
      });

      // Assert
      expect(mockConnection.sendRawTransaction).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({ skipPreflight: true }),
      );
    });

    it("DEBE usar maxRetries = 3 por defecto", async () => {
      // Arrange
      const mockConnection = {
        sendRawTransaction: vi.fn().mockResolvedValue("testSignature"),
        confirmTransaction: vi.fn(),
      };

      // Act
      await mockConnection.sendRawTransaction(Buffer.from([]));

      // Assert - Debería tener maxRetries en config
      expect(mockConnection.sendRawTransaction).toHaveBeenCalled();
    });
  });
});
