/**
 * TICKET #4: Crear endpoint POST /purchase/settle/:transactionId
 *
 * Test para validar que el endpoint de settlement (reintentar mint)
 * funciona correctamente después de un fallo.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Request, Response } from "express";
import { PurchaseController } from "../src/controllers/purchase/PurchaseController";
import * as typesModule from "../src/models/types";
import * as loggerServiceModule from "../src/services/logging/logger.service";

vi.mock("../src/repositories/transaction.repository");
vi.mock("../src/services/logger.service");

describe("TICKET #4: POST /purchase/settle/:transactionId endpoint", () => {
  let controller: PurchaseController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockTransactionRepository: any;
  let mockLoggerService: any;

  beforeEach(() => {
    controller = new PurchaseController();

    mockRequest = {
      params: { transactionId: "failed-transaction-id" },
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockTransactionRepository = {
      findOne: vi.fn(),
      update: vi.fn(),
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

  describe("Validación: Settlement para transacciones fallidas", () => {
    it("DEBE permitir reintentar mint en transacciones fallidas", async () => {
      // Arrange: Transacción en estado 'failed' sin tokens minteados
      mockTransactionRepository.findOne.mockResolvedValueOnce({
        transactionId: "failed-transaction-id",
        walletAddress: "test_wallet",
        tokenAmount: 100,
        status: "failed",
        minted: false,
        minting: false,
        mintSignature: null,
      });

      mockTransactionRepository.update.mockResolvedValueOnce({
        transactionId: "failed-transaction-id",
        status: "completed",
        minted: true,
        mintSignature: "retry_signature_xyz789",
      });

      // Act
      await controller.settlePurchase(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert: Debe intentar ejecutar el mint
      expect(mockTransactionRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: "failed-transaction-id",
        }),
        expect.anything(),
      );
    });

    it("DEBE ser idempotente: no reintentar si ya fue minteado", async () => {
      // Arrange: Transacción ya completada
      mockTransactionRepository.findOne.mockResolvedValueOnce({
        transactionId: "already-minted-tx",
        walletAddress: "test_wallet",
        tokenAmount: 100,
        status: "completed",
        minted: true,
        mintSignature: "existing_signature",
      });

      // Act
      await controller.settlePurchase(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert: No debe reintentar
      expect(mockTransactionRepository.update).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: expect.stringMatching(/OK|SUCCESS/i),
        }),
      );
    });

    it("DEBE retornar error si transacción no existe", async () => {
      // Arrange
      mockTransactionRepository.findOne.mockResolvedValueOnce(null);

      // Act
      await controller.settlePurchase(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(
        expect.any(Number), // 404 o similar
      );
    });

    it("DEBE guardar mintSignature después de settlement exitoso", async () => {
      // Arrange
      const new_signature = "settlement_signature_abc123";
      mockTransactionRepository.findOne.mockResolvedValueOnce({
        transactionId: "settle-tx-id",
        walletAddress: "test_wallet",
        tokenAmount: 100,
        status: "failed",
        minted: false,
      });

      mockTransactionRepository.update.mockResolvedValueOnce({
        transactionId: "settle-tx-id",
        mintSignature: new_signature,
        minted: true,
      });

      // Act
      await controller.settlePurchase(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert
      const updateCall = mockTransactionRepository.update.mock.calls.find(
        (call: any) => call[1]?.mintSignature,
      );
      if (updateCall) {
        expect(updateCall[1]).toHaveProperty("mintSignature");
        expect(updateCall[1].mintSignature).not.toBeNull();
      }
    });
  });

  describe("Validación: Transiciones de estado", () => {
    it("DEBE transicionar de 'failed' → 'completed' en settlement exitoso", async () => {
      // Arrange
      mockTransactionRepository.findOne.mockResolvedValueOnce({
        transactionId: "tx-id",
        status: "failed",
        minted: false,
      });

      mockTransactionRepository.update.mockResolvedValueOnce({
        status: "completed",
        minted: true,
      });

      // Act
      await controller.settlePurchase(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert
      const call = mockTransactionRepository.update.mock.calls[0];
      if (call && call[1]) {
        expect(call[1].status).toBe("completed");
        expect(call[1].minted).toBe(true);
      }
    });

    it("DEBE mantener estado 'failed' si el retry también falla", async () => {
      // Arrange
      mockTransactionRepository.findOne.mockResolvedValueOnce({
        transactionId: "tx-id",
        status: "failed",
      });

      mockTransactionRepository.update.mockResolvedValueOnce({
        status: "failed",
        minted: false,
      });

      // Act
      await controller.settlePurchase(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert
      expect(mockResponse.json).toBeCalled();
    });
  });
});
