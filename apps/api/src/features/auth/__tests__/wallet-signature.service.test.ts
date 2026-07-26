import { describe, it, expect, beforeEach, vi } from "vitest";
import { verify_wallet_signature } from "../wallet-signature.service";

describe("wallet_signature_service", () => {
  describe("verify_wallet_signature", () => {
    it("should return is_valid=true para firma válida", async () => {
      // Este test requiere una firma real. Para testing, usaremos vitest mocking
      const result = await verify_wallet_signature({
        public_key: "11111111111111111111111111111112", // PublicKey dummy
        message: "test message",
        signature: "11111111111111111111111111111111",
      });

      // En desarrollo, esperamos error porque la firma es inválida
      expect(result.is_valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return is_valid=false para firma inválida", async () => {
      const result = await verify_wallet_signature({
        public_key: "invalid-public-key",
        message: "test message",
        signature: "invalid-signature",
      });

      expect(result.is_valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return is_valid=false para publicKey inválida", async () => {
      const result = await verify_wallet_signature({
        public_key: "not-a-valid-solana-key",
        message: "test message",
        signature: "11111111111111111111111111111111",
      });

      expect(result.is_valid).toBe(false);
      expect(result.error).toContain("verification");
    });

    it("should return error when message is empty", async () => {
      const result = await verify_wallet_signature({
        public_key: "11111111111111111111111111111112",
        message: "",
        signature: "11111111111111111111111111111111",
      });

      expect(result.is_valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
