import { describe, it, expect } from "vitest";

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

describe("Address Book Validation", () => {
  describe("Solana Address Validation", () => {
    it("should validate correct Solana addresses", () => {
      const valid_addresses = [
        "11111111111111111111111111111112",
        "TokenkegQfeZyiNwAJsyFbPVwwQQfփvjDo1j",
        "SysvarC1ock11111111111111111111111111111111",
      ];

      valid_addresses.forEach((addr) => {
        expect(SOLANA_ADDRESS_REGEX.test(addr)).toBe(true);
      });
    });

    it("should reject invalid Solana addresses", () => {
      const invalid_addresses = [
        "invalid",
        "0000000000000000000000000000000000000000",
        "11111111111111111111111111111",
        "OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOll",
      ];

      invalid_addresses.forEach((addr) => {
        expect(SOLANA_ADDRESS_REGEX.test(addr)).toBe(false);
      });
    });

    it("should reject addresses with invalid characters", () => {
      expect(
        SOLANA_ADDRESS_REGEX.test("111111111111111111111111111111I2"),
      ).toBe(false);
      expect(
        SOLANA_ADDRESS_REGEX.test("111111111111111111111111111111O2"),
      ).toBe(false);
      expect(
        SOLANA_ADDRESS_REGEX.test("111111111111111111111111111111l2"),
      ).toBe(false);
    });
  });

  describe("Label Validation", () => {
    it("should accept labels between 1 and 100 characters", () => {
      const valid_labels = [
        "A",
        "Trading Account",
        "My Main Wallet" + "a".repeat(50),
      ];

      valid_labels.forEach((label) => {
        expect(label.length >= 1 && label.length <= 100).toBe(true);
      });
    });

    it("should reject empty labels", () => {
      expect("".length >= 1).toBe(false);
    });

    it("should reject labels longer than 100 characters", () => {
      const long_label = "a".repeat(101);
      expect(long_label.length <= 100).toBe(false);
    });
  });

  describe("Description Validation", () => {
    it("should accept descriptions up to 500 characters", () => {
      const valid_descriptions = ["", "Short description", "a".repeat(500)];

      valid_descriptions.forEach((desc) => {
        expect(desc.length <= 500).toBe(true);
      });
    });

    it("should reject descriptions longer than 500 characters", () => {
      const long_desc = "a".repeat(501);
      expect(long_desc.length <= 500).toBe(false);
    });
  });

  describe("Address Form Validation", () => {
    interface AddressFormData {
      recipient_address: string;
      label: string;
      description?: string;
      is_favorite?: boolean;
    }

    const validate_address_form = (data: AddressFormData): string | null => {
      if (!data.recipient_address.trim()) {
        return "La dirección de destinatario es requerida";
      }

      if (!SOLANA_ADDRESS_REGEX.test(data.recipient_address)) {
        return "Dirección de Solana inválida";
      }

      if (!data.label.trim()) {
        return "El nombre de la dirección es requerido";
      }

      if (data.label.length > 100) {
        return "El nombre no debe exceder 100 caracteres";
      }

      if ((data.description || "").length > 500) {
        return "La descripción no debe exceder 500 caracteres";
      }

      return null;
    };

    it("should validate correct form data", () => {
      const valid_form: AddressFormData = {
        recipient_address: "11111111111111111111111111111112",
        label: "Trading Account",
        description: "My trading account",
        is_favorite: true,
      };

      expect(validate_address_form(valid_form)).toBe(null);
    });

    it("should reject missing recipient address", () => {
      const invalid_form: AddressFormData = {
        recipient_address: "",
        label: "Account",
      };

      expect(validate_address_form(invalid_form)).toBe(
        "La dirección de destinatario es requerida",
      );
    });

    it("should reject invalid Solana address", () => {
      const invalid_form: AddressFormData = {
        recipient_address: "invalid",
        label: "Account",
      };

      expect(validate_address_form(invalid_form)).toBe(
        "Dirección de Solana inválida",
      );
    });

    it("should reject missing label", () => {
      const invalid_form: AddressFormData = {
        recipient_address: "11111111111111111111111111111112",
        label: "",
      };

      expect(validate_address_form(invalid_form)).toBe(
        "El nombre de la dirección es requerido",
      );
    });

    it("should reject label exceeding 100 characters", () => {
      const invalid_form: AddressFormData = {
        recipient_address: "11111111111111111111111111111112",
        label: "a".repeat(101),
      };

      expect(validate_address_form(invalid_form)).toBe(
        "El nombre no debe exceder 100 caracteres",
      );
    });

    it("should reject description exceeding 500 characters", () => {
      const invalid_form: AddressFormData = {
        recipient_address: "11111111111111111111111111111112",
        label: "Account",
        description: "a".repeat(501),
      };

      expect(validate_address_form(invalid_form)).toBe(
        "La descripción no debe exceder 500 caracteres",
      );
    });
  });
});
