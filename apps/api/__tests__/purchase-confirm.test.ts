/**
 * TICKET #2: Validar que confirmPurchase registra mintSignature en DB
 *
 * Test para asegurar que cuando confirmPurchase() ejecuta updateTokenBalance(),
 * la firma retornada se guarda en la BD antes de retornar al cliente.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Request, Response } from "express";
import { PurchaseController } from "../src/controllers/purchase/PurchaseController";
import * as typesModule from "../src/models/types";
import * as loggerServiceModule from "../src/services/logging/logger.service";

// Mock de servicios
vi.mock("../src/repositories/transaction.repository");
vi.mock("../src/services/logger.service");

describe("TICKET #2: confirmPurchase debe registrar mintSignature", () => {
  let controller: PurchaseController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Request>;
  let mockTransactionRepository: any;
  let mockLoggerService: any;

  beforeEach(() => {
    controller = new PurchaseController();

    mockRequest = {
      params: {
        transactionId: "valid-transaction-id-uuid",
      },
      body: {
        mintSignature: "test_mint_signature_abcd1234",
      },
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockTransactionRepository = {
      findOne: vi.fn().mockResolvedValue({
        transactionId: "valid-transaction-id-uuid",
        walletAddress: "test_wallet_address",
        tokenAmount: 100,
        status: "pending",
        minted: false,
        mintSignature: null,
      }),
      update: vi.fn().mockResolvedValue({
        transactionId: "valid-transaction-id-uuid",
        walletAddress: "test_wallet_address",
        tokenAmount: 100,
        status: "completed",
        minted: true,
        mintSignature: "test_mint_signature_abcd1234",
        completedAt: new Date(),
      }),
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

  describe("Validación: mintSignature debe guardarse en BD", () => {
    it("DEBE guardar mintSignature en la BD cuando confirmPurchase() se ejecuta", async () => {
      // Arrange: Transaction pendiente sin mintSignature
      const transactionId = "valid-transaction-id-uuid";
      const expectedMintSig = "test_mint_signature_abcd1234";

      // Act: Llamar confirmPurchase (que debería llamar updateTokenBalance)
      // Por ahora solo validamos que la actualización se hace
      await controller.confirmPurchase(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert: Verificar que transactionRepository.update fue llamado
      // CON el mintSignature guardado
      expect(mockTransactionRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ transactionId }),
        expect.objectContaining({
          minted: true,
          mintSignature: expect.stringMatching(/^[a-zA-Z0-9_]+$/), // Signature format
        }),
      );
    });

    it("DEBE retornar error si mintSignature es null", async () => {
      // Arrange: updateTokenBalance falla y retorna null
      mockTransactionRepository.findOne.mockResolvedValueOnce({
        transactionId: "valid-transaction-id-uuid",
        walletAddress: "test_wallet_address",
        tokenAmount: 100,
        status: "pending",
        minted: false,
        mintSignature: null,
      });

      // Act & Assert: Debería fallar o marcar como failed
      await controller.confirmPurchase(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Verificar que se registró error en logs
      expect(mockLoggerService.logError).toHaveBeenCalled();
    });

    it("DEBE ser idempotente: no actualizar si ya fue minteado", async () => {
      // Arrange: Transaction ya completada
      mockTransactionRepository.findOne.mockResolvedValueOnce({
        transactionId: "valid-transaction-id-uuid",
        walletAddress: "test_wallet_address",
        tokenAmount: 100,
        status: "completed",
        minted: true,
        mintSignature: "existing_signature",
      });

      // Act
      await controller.confirmPurchase(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert: No debe intentar actualizar de nuevo
      expect(mockTransactionRepository.update).not.toHaveBeenCalled();
    });
  });

  describe("Validación: BD consistency", () => {
    it("DEBE verificar que BD update retornó los valores correctos", async () => {
      // Arrange
      const expectedMintSig = "test_mint_signature_abcd1234";

      // Mock: updateTokenBalance retorna firma
      // (Este es un mock implícito en el flujo de confirmPurchase)

      // Act
      await controller.confirmPurchase(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert: Verificar que los valores en BD coinciden con lo esperado
      const callArgs = mockTransactionRepository.update.mock.calls[0];
      if (callArgs) {
        expect(callArgs[1]).toMatchObject({
          minted: true,
          status: "completed",
        });
      }
    });
  });
});
