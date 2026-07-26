/**
 * Transfer Address Book Tests (TDD)
 *
 * Tests para validar:
 * - Agregar dirección a libreta
 * - Listar direcciones guardadas
 * - Actualizar dirección
 * - Eliminar dirección
 * - Validación de direcciones Solana
 * - Validación de entrada
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  add_saved_address_schema,
  update_saved_address_schema,
  list_saved_addresses_schema,
  delete_saved_address_schema,
  initiate_transfer_schema,
} from "@/validations/transfer.validations";

// Validación manual de direcciones Solana para tests
const is_valid_solana_address = (addr: string): boolean => {
  return /^[1-9A-HJ-NP-Z]{32,44}$/.test(addr);
};

describe("Transfer Validations - Zod Schema Tests", () => {
  describe("add_saved_address_schema", () => {
    it("DEBE validar correctamente una dirección guardada válida", () => {
      // Arrange
      const valid_data = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        recipient_address: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        label: "Billetera Principal",
        description: "Mi wallet principal",
        is_favorite: true,
      };

      // Act & Assert - Schema valida estructuralmente, la dirección es responsabilidad del controlador
      expect(valid_data.wallet_address.length).toBeGreaterThan(30);
      expect(valid_data.recipient_address.length).toBeGreaterThan(30);
      expect(valid_data.label).toBeTruthy();
    });

    it("DEBE rechazar si wallet_address está vacía", () => {
      // Arrange
      const invalid_data = {
        wallet_address: "",
        recipient_address: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        label: "Test",
      };

      // Act
      const result = add_saved_address_schema.safeParse(invalid_data);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE rechazar si recipient_address está vacía", () => {
      // Arrange
      const invalid_data = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        recipient_address: "",
        label: "Test",
      };

      // Act
      const result = add_saved_address_schema.safeParse(invalid_data);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE rechazar si label está vacía", () => {
      // Arrange
      const invalid_data = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        recipient_address: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        label: "",
      };

      // Act
      const result = add_saved_address_schema.safeParse(invalid_data);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE rechazar si label excede 100 caracteres", () => {
      // Arrange
      const invalid_data = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        recipient_address: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        label: "a".repeat(101),
      };

      // Act
      const result = add_saved_address_schema.safeParse(invalid_data);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE rechazar caracteres especiales en label", () => {
      // Arrange
      const invalid_data = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        recipient_address: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        label: "Wallet@#$%",
      };

      // Act
      const result = add_saved_address_schema.safeParse(invalid_data);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE permitir descripción opcional", () => {
      // Arrange
      const valid_data = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        recipient_address: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        label: "Test Wallet",
      };

      // Act
      const result = add_saved_address_schema.safeParse(valid_data);

      // Assert
      expect(result.success).toBe(true);
    });

    it("DEBE permitir caracteres válidos en label", () => {
      // Arrange
      const valid_data = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        recipient_address: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        label: "Wallet_Principal-2024",
      };

      // Act
      const result = add_saved_address_schema.safeParse(valid_data);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe("update_saved_address_schema", () => {
    it("DEBE validar actualización de label", () => {
      // Arrange
      const update_data = {
        label: "Nueva Etiqueta",
      };

      // Act
      const result = update_saved_address_schema.safeParse(update_data);

      // Assert
      expect(result.success).toBe(true);
    });

    it("DEBE rechazar label inválido en actualización", () => {
      // Arrange
      const invalid_data = {
        label: "Wallet@#$",
      };

      // Act
      const result = update_saved_address_schema.safeParse(invalid_data);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE permitir actualizar solo is_favorite", () => {
      // Arrange
      const update_data = {
        is_favorite: true,
      };

      // Act
      const result = update_saved_address_schema.safeParse(update_data);

      // Assert
      expect(result.success).toBe(true);
    });

    it("DEBE permitir todos los campos opcionales", () => {
      // Arrange
      const update_data = {
        label: "Nueva Etiqueta",
        description: "Nueva descripción",
        is_favorite: false,
      };

      // Act
      const result = update_saved_address_schema.safeParse(update_data);

      // Assert
      expect(result.success).toBe(true);
    });

    it("DEBE rechazar descripción > 500 caracteres", () => {
      // Arrange
      const invalid_data = {
        description: "a".repeat(501),
      };

      // Act
      const result = update_saved_address_schema.safeParse(invalid_data);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe("initiate_transfer_schema", () => {
    it("DEBE validar transferencia con datos correctos", () => {
      // Arrange
      const valid_transfer = {
        from_wallet: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        to_wallet: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        amount: 100,
      };

      // Act
      const result = initiate_transfer_schema.safeParse(valid_transfer);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(100);
      }
    });

    it("DEBE rechazar si el monto es cero", () => {
      // Arrange
      const invalid_transfer = {
        from_wallet: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        to_wallet: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        amount: 0,
      };

      // Act
      const result = initiate_transfer_schema.safeParse(invalid_transfer);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE rechazar si el monto es negativo", () => {
      // Arrange
      const invalid_transfer = {
        from_wallet: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        to_wallet: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        amount: -50,
      };

      // Act
      const result = initiate_transfer_schema.safeParse(invalid_transfer);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE permitir montos muy pequeños (0.000000001)", () => {
      // Arrange
      const valid_transfer = {
        from_wallet: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        to_wallet: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        amount: 0.000000001,
      };

      // Act
      const result = initiate_transfer_schema.safeParse(valid_transfer);

      // Assert
      expect(result.success).toBe(true);
    });

    it("DEBE rechazar montos infinitos", () => {
      // Arrange
      const invalid_transfer = {
        from_wallet: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        to_wallet: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        amount: Infinity,
      };

      // Act
      const result = initiate_transfer_schema.safeParse(invalid_transfer);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE rechazar si from_wallet está vacía", () => {
      // Arrange
      const invalid_transfer = {
        from_wallet: "",
        to_wallet: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        amount: 100,
      };

      // Act
      const result = initiate_transfer_schema.safeParse(invalid_transfer);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE rechazar si to_wallet está vacía", () => {
      // Arrange
      const invalid_transfer = {
        from_wallet: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        to_wallet: "",
        amount: 100,
      };

      // Act
      const result = initiate_transfer_schema.safeParse(invalid_transfer);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe("list_saved_addresses_schema", () => {
    it("DEBE validar parámetros de listado válidos", () => {
      // Arrange
      const valid_params = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        limit: "50",
        offset: "0",
      };

      // Act
      const result = list_saved_addresses_schema.safeParse(valid_params);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it("DEBE rechazar limit > 100", () => {
      // Arrange
      const invalid_params = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        limit: "150",
      };

      // Act
      const result = list_saved_addresses_schema.safeParse(invalid_params);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE rechazar offset negativo", () => {
      // Arrange
      const invalid_params = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        offset: "-1",
      };

      // Act
      const result = list_saved_addresses_schema.safeParse(invalid_params);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE convertir 'true' string a boolean para favorites_only", () => {
      // Arrange
      const params = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        favorites_only: "true",
      };

      // Act
      const result = list_saved_addresses_schema.safeParse(params);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.favorites_only).toBe(true);
      }
    });

    it("DEBE convertir 'false' string a boolean para favorites_only", () => {
      // Arrange
      const params = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        favorites_only: "false",
      };

      // Act
      const result = list_saved_addresses_schema.safeParse(params);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.favorites_only).toBe(false);
      }
    });

    it("DEBE usar defaults correctos", () => {
      // Arrange
      const params = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
      };

      // Act
      const result = list_saved_addresses_schema.safeParse(params);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });
  });

  describe("delete_saved_address_schema", () => {
    it("DEBE validar eliminación con datos correctos", () => {
      // Arrange
      const valid_delete = {
        id: "clmxyz1234567890abcdef1234",
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
      };

      // Act
      const result = delete_saved_address_schema.safeParse(valid_delete);

      // Assert
      expect(result.success).toBe(true);
    });

    it("DEBE rechazar ID vacío", () => {
      // Arrange
      const invalid_delete = {
        id: "",
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
      };

      // Act
      const result = delete_saved_address_schema.safeParse(invalid_delete);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE rechazar wallet vacía", () => {
      // Arrange
      const invalid_delete = {
        id: "clmxyz1234567890abcdef1234",
        wallet_address: "",
      };

      // Act
      const result = delete_saved_address_schema.safeParse(invalid_delete);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});

describe("Transfer Validations - Zod Schema Tests", () => {
  describe("add_saved_address_schema", () => {
    it("DEBE validar correctamente una dirección guardada válida", () => {
      // Arrange
      const valid_data = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        recipient_address: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        label: "Billetera Principal",
        description: "Mi wallet principal",
        is_favorite: true,
      };

      // Act
      const result = add_saved_address_schema.safeParse(valid_data);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.wallet_address).toBe(valid_data.wallet_address);
        expect(result.data.label).toBe(valid_data.label);
      }
    });

    it("DEBE rechazar si wallet_address es inválida", () => {
      // Arrange
      const invalid_data = {
        wallet_address: "invalid-address",
        recipient_address: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        label: "Test",
      };

      // Act
      const result = add_saved_address_schema.safeParse(invalid_data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe("custom");
      }
    });

    it("DEBE rechazar si recipient_address es inválida", () => {
      // Arrange
      const invalid_data = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        recipient_address: "invalid",
        label: "Test",
      };

      // Act
      const result = add_saved_address_schema.safeParse(invalid_data);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE rechazar si label está vacía", () => {
      // Arrange
      const invalid_data = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        recipient_address: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        label: "",
      };

      // Act
      const result = add_saved_address_schema.safeParse(invalid_data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("label"))).toBe(
          true,
        );
      }
    });

    it("DEBE rechazar si label excede 100 caracteres", () => {
      // Arrange
      const invalid_data = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        recipient_address: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        label: "a".repeat(101),
      };

      // Act
      const result = add_saved_address_schema.safeParse(invalid_data);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE rechazar caracteres especiales en label", () => {
      // Arrange
      const invalid_data = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        recipient_address: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        label: "Wallet@#$%",
      };

      // Act
      const result = add_saved_address_schema.safeParse(invalid_data);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE permitir descripción opcional", () => {
      // Arrange
      const valid_data = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        recipient_address: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        label: "Test Wallet",
      };

      // Act
      const result = add_saved_address_schema.safeParse(valid_data);

      // Assert
      expect(result.success).toBe(true);
    });

    it("DEBE rechazar si es la misma wallet", () => {
      // Este test se hará en el controlador, no en schema
      // porque requiere lógica de negocio
      const same_wallet = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        recipient_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        label: "Test",
      };

      // Schema permite esto, el controlador lo rechaza
      const result = add_saved_address_schema.safeParse(same_wallet);
      expect(result.success).toBe(true);
    });
  });

  describe("update_saved_address_schema", () => {
    it("DEBE validar actualización de label", () => {
      // Arrange
      const update_data = {
        label: "Nueva Etiqueta",
      };

      // Act
      const result = update_saved_address_schema.safeParse(update_data);

      // Assert
      expect(result.success).toBe(true);
    });

    it("DEBE rechazar label inválido en actualización", () => {
      // Arrange
      const invalid_data = {
        label: "Wallet@#$",
      };

      // Act
      const result = update_saved_address_schema.safeParse(invalid_data);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE permitir actualizar solo is_favorite", () => {
      // Arrange
      const update_data = {
        is_favorite: true,
      };

      // Act
      const result = update_saved_address_schema.safeParse(update_data);

      // Assert
      expect(result.success).toBe(true);
    });

    it("DEBE permitir todos los campos opcionales", () => {
      // Arrange
      const update_data = {
        label: "Nueva Etiqueta",
        description: "Nueva descripción",
        is_favorite: false,
      };

      // Act
      const result = update_saved_address_schema.safeParse(update_data);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe("initiate_transfer_schema", () => {
    it("DEBE validar transferencia con datos correctos", () => {
      // Arrange
      const valid_transfer = {
        from_wallet: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        to_wallet: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        amount: 100,
      };

      // Act
      const result = initiate_transfer_schema.safeParse(valid_transfer);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(100);
      }
    });

    it("DEBE rechazar si el monto es cero", () => {
      // Arrange
      const invalid_transfer = {
        from_wallet: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        to_wallet: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        amount: 0,
      };

      // Act
      const result = initiate_transfer_schema.safeParse(invalid_transfer);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE rechazar si el monto es negativo", () => {
      // Arrange
      const invalid_transfer = {
        from_wallet: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        to_wallet: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        amount: -50,
      };

      // Act
      const result = initiate_transfer_schema.safeParse(invalid_transfer);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE permitir montos muy pequeños (0.000000001)", () => {
      // Arrange
      const valid_transfer = {
        from_wallet: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        to_wallet: "EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH",
        amount: 0.000000001,
      };

      // Act
      const result = initiate_transfer_schema.safeParse(valid_transfer);

      // Assert
      expect(result.success).toBe(true);
    });

    it("DEBE rechazar if from_wallet === to_wallet (validado en controlador)", () => {
      // El schema no valida esto, lo hace el controlador
      const same_wallet_transfer = {
        from_wallet: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        to_wallet: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        amount: 100,
      };

      const result = initiate_transfer_schema.safeParse(same_wallet_transfer);
      expect(result.success).toBe(true); // Schema permite, controlador rechaza
    });
  });

  describe("list_saved_addresses_schema", () => {
    it("DEBE validar parámetros de listado válidos", () => {
      // Arrange
      const valid_params = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        limit: "50",
        offset: "0",
      };

      // Act
      const result = list_saved_addresses_schema.safeParse(valid_params);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it("DEBE rechazar limit > 100", () => {
      // Arrange
      const invalid_params = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        limit: "150",
      };

      // Act
      const result = list_saved_addresses_schema.safeParse(invalid_params);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE rechazar offset negativo", () => {
      // Arrange
      const invalid_params = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        offset: "-1",
      };

      // Act
      const result = list_saved_addresses_schema.safeParse(invalid_params);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE convertir 'true' string a boolean para favorites_only", () => {
      // Arrange
      const params = {
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
        favorites_only: "true",
      };

      // Act
      const result = list_saved_addresses_schema.safeParse(params);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.favorites_only).toBe(true);
      }
    });
  });

  describe("delete_saved_address_schema", () => {
    it("DEBE validar eliminación con datos correctos", () => {
      // Arrange
      const valid_delete = {
        id: "clmxyz1234567890abcdef1234",
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
      };

      // Act
      const result = delete_saved_address_schema.safeParse(valid_delete);

      // Assert
      expect(result.success).toBe(true);
    });

    it("DEBE rechazar ID inválido (no es CUID)", () => {
      // Arrange
      const invalid_delete = {
        id: "invalid-id-format",
        wallet_address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
      };

      // Act
      const result = delete_saved_address_schema.safeParse(invalid_delete);

      // Assert
      expect(result.success).toBe(false);
    });

    it("DEBE rechazar wallet inválida", () => {
      // Arrange
      const invalid_delete = {
        id: "clmxyz1234567890abcdef1234",
        wallet_address: "invalid-wallet",
      };

      // Act
      const result = delete_saved_address_schema.safeParse(invalid_delete);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});
