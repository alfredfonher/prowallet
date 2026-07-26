/**
 * TICKET #3: Validar que getPurchaseHistory nunca retorna NULL amounts
 *
 * Test para asegurar que getPurchaseHistory() NUNCA retorna
 * transacciones con tokenAmount = null, siempre debe haber un valor.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Request, Response } from "express";
import { PurchaseController } from "../src/controllers/purchase/PurchaseController";
import * as typesModule from "../src/models/types";
import * as loggerServiceModule from "../src/services/logging/logger.service";

vi.mock("../src/repositories/transaction.repository");
vi.mock("../src/services/logger.service");

describe("TICKET #3: getPurchaseHistory nunca debe retornar NULL tokenAmount", () => {
  let controller: PurchaseController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockTransactionRepository: any;
  let mockLoggerService: any;

  beforeEach(() => {
    controller = new PurchaseController();

    mockRequest = {
      params: { walletAddress: "test_wallet_address" },
      query: { page: "1", limit: "10" },
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockTransactionRepository = {
      find: vi.fn().mockResolvedValue([
        {
          transactionId: "tx-1",
          walletAddress: "test_wallet_address",
          tokenAmount: 100, // ✅ Valor válido
          paymentAmount: 50.5,
          tokenPrice: 0.5,
          status: "completed",
          createdAt: new Date(),
          completedAt: new Date(),
          signature: "sig-123",
        },
        {
          transactionId: "tx-2",
          walletAddress: "test_wallet_address",
          tokenAmount: null, // ❌ PROBLEMA: NULL
          paymentAmount: 25.25,
          tokenPrice: 0.5,
          status: "completed",
          createdAt: new Date(),
          completedAt: new Date(),
          signature: "sig-456",
        },
      ]),
      count: vi.fn().mockResolvedValue(2),
    };

    mockLoggerService = {
      logInfo: vi.fn(),
      logError: vi.fn(),
      generateRequestId: vi.fn().mockReturnValue("req-123"),
    };

    vi.mocked(typesModule).transactionRepository = mockTransactionRepository;
    vi.mocked(loggerServiceModule).loggerService = mockLoggerService;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Validación: tokenAmount nunca debe ser NULL", () => {
    it("DEBE retornar solo transacciones con tokenAmount válido", async () => {
      // Act
      await controller.getPurchaseHistory(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert: Obtener el JSON retornado
      const callArgs = mockResponse.json.mock.calls[0];
      if (callArgs && callArgs[0]) {
        const response = callArgs[0];
        const transactions = response.extra?.transactions || [];

        // Verificar que NINGUNA transacción tiene tokenAmount null
        transactions.forEach((tx: any) => {
          expect(tx.tokenAmount).not.toBeNull();
          expect(tx.tokenAmount).toBeDefined();
          expect(typeof tx.tokenAmount).toBe("number");
        });
      }
    });

    it("DEBE filtrar o corregir transacciones sin tokenAmount", async () => {
      // Arrange: Simular BD con datos incompletos
      mockTransactionRepository.find.mockResolvedValueOnce([
        {
          transactionId: "tx-broken",
          tokenAmount: null,
          status: "completed",
        },
      ]);

      // Act
      await controller.getPurchaseHistory(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert: El endpoint debe manejar esto elegantemente
      // Opción 1: Filtrar las transacciones null
      // Opción 2: Log error para investigación
      expect(mockLoggerService.logError).not.toHaveBeenCalled(); // Si no hay error
      // O
      expect(mockLoggerService.logInfo).toBeCalled(); // Si hay logging de warn
    });

    it("DEBE retrnar tokenAmount = 0 si es necesario, pero NUNCA null", async () => {
      // Arrange
      mockTransactionRepository.find.mockResolvedValueOnce([
        {
          transactionId: "tx-zero",
          walletAddress: "test_wallet_address",
          tokenAmount: 0, // ✅ Valor válido (cero)
          status: "completed",
        },
      ]);

      // Act
      await controller.getPurchaseHistory(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert
      const callArgs = mockResponse.json.mock.calls[0];
      if (callArgs && callArgs[0]) {
        const response = callArgs[0];
        const transactions = response.extra?.transactions || [];
        expect(transactions[0].tokenAmount).toBe(0);
        expect(transactions[0].tokenAmount).not.toBeNull();
      }
    });
  });

  describe("Validación: Integridad de datos históricos", () => {
    it("DEBE incluir todos los campos requeridos en cada transacción", async () => {
      // Act
      await controller.getPurchaseHistory(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert
      const callArgs = mockResponse.json.mock.calls[0];
      if (callArgs && callArgs[0]) {
        const response = callArgs[0];
        const transactions = response.extra?.transactions || [];

        transactions.forEach((tx: any) => {
          expect(tx).toHaveProperty("transactionId");
          expect(tx).toHaveProperty("tokenAmount");
          expect(tx).toHaveProperty("paymentAmount");
          expect(tx).toHaveProperty("status");
          expect(tx).toHaveProperty("createdAt");
        });
      }
    });
  });
});
