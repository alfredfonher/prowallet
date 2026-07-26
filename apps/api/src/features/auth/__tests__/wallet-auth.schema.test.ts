import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  wallet_login_request_schema,
  request_challenge_schema,
} from "../wallet-auth.schema";

describe("wallet_auth_schema", () => {
  describe("request_challenge_schema", () => {
    it("should validate valid public key", () => {
      // PublicKey de Solana válida (en base58)
      const input = {
        public_key: "11111111111111111111111111111112",
      };

      const result = request_challenge_schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject invalid public key", () => {
      const input = {
        public_key: "not-a-valid-solana-key",
      };

      const result = request_challenge_schema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject empty public key", () => {
      const input = {
        public_key: "",
      };

      const result = request_challenge_schema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject missing public key", () => {
      const input = {};

      const result = request_challenge_schema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("wallet_login_request_schema", () => {
    it("should validate complete login request", () => {
      const input = {
        public_key: "11111111111111111111111111111112",
        message: "Sign this message to authenticate with ProWallet",
        signature:
          "3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f",
      };

      const result = wallet_login_request_schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject when public_key is missing", () => {
      const input = {
        message: "Sign this message",
        signature: "3c4d5e6f7a8b9c0d1e2f",
      };

      const result = wallet_login_request_schema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject when message is too short", () => {
      const input = {
        public_key: "11111111111111111111111111111112",
        message: "short",
        signature: "3c4d5e6f7a8b9c0d1e2f",
      };

      const result = wallet_login_request_schema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject when signature is too short", () => {
      const input = {
        public_key: "11111111111111111111111111111112",
        message: "Sign this message to authenticate with ProWallet",
        signature: "short",
      };

      const result = wallet_login_request_schema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
