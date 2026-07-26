import { describe, it, expect } from "vitest";
import {
  WalletAuthError,
  InvalidSignatureError,
  ChallengeExpiredError,
  UserNotFoundError,
  ValidationError,
  JWTError,
  ChallengeError,
  AuthServerError,
  is_wallet_auth_error,
  to_wallet_auth_error,
} from "../errors";

describe("Auth Error Classes", () => {
  describe("WalletAuthError", () => {
    it("should create error with message and code", () => {
      const error = new WalletAuthError("Test error", "TEST_CODE");
      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_CODE");
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe("WalletAuthError");
    });

    it("should support custom status code", () => {
      const error = new WalletAuthError("Test error", "TEST_CODE", 500);
      expect(error.statusCode).toBe(500);
    });

    it("should convert to JSON", () => {
      const error = new WalletAuthError("Test", "CODE", 400);
      const json = error.toJSON();
      expect(json).toEqual({
        name: "WalletAuthError",
        message: "Test",
        code: "CODE",
        statusCode: 400,
      });
    });
  });

  describe("InvalidSignatureError", () => {
    it("should create with default message", () => {
      const error = new InvalidSignatureError();
      expect(error.message).toContain("Invalid wallet signature");
      expect(error.code).toBe("INVALID_SIGNATURE");
      expect(error.statusCode).toBe(401);
    });

    it("should create with custom reason", () => {
      const error = new InvalidSignatureError("Signature mismatch");
      expect(error.message).toContain("Signature mismatch");
    });

    it("should be instance of WalletAuthError", () => {
      const error = new InvalidSignatureError();
      expect(error instanceof WalletAuthError).toBe(true);
    });
  });

  describe("ChallengeExpiredError", () => {
    it("should create with expiration message", () => {
      const error = new ChallengeExpiredError();
      expect(error.message).toContain("Challenge expired");
      expect(error.code).toBe("CHALLENGE_EXPIRED");
      expect(error.statusCode).toBe(401);
    });
  });

  describe("UserNotFoundError", () => {
    it("should include public key in message", () => {
      const pubKey = "GmYsHTNVhnJwpV5yiHa8NwLqnMpan3Qy8LsqA7L9yzH1";
      const error = new UserNotFoundError(pubKey);
      expect(error.message).toContain(pubKey);
      expect(error.code).toBe("USER_NOT_FOUND");
      expect(error.statusCode).toBe(404);
    });
  });

  describe("ValidationError", () => {
    it("should create with field info", () => {
      const error = new ValidationError("Invalid format", "public_key");
      expect(error.message).toBe("Invalid format");
      expect(error.field).toBe("public_key");
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.statusCode).toBe(400);
    });

    it("should work without field", () => {
      const error = new ValidationError("Invalid input");
      expect(error.message).toBe("Invalid input");
      expect(error.field).toBeUndefined();
    });
  });

  describe("JWTError", () => {
    it("should create JWT error", () => {
      const error = new JWTError("Token expired");
      expect(error.message).toBe("Token expired");
      expect(error.code).toBe("JWT_ERROR");
      expect(error.statusCode).toBe(401);
    });
  });

  describe("ChallengeError", () => {
    it("should create with default code", () => {
      const error = new ChallengeError("Challenge not found");
      expect(error.message).toBe("Challenge not found");
      expect(error.code).toBe("CHALLENGE_ERROR");
      expect(error.statusCode).toBe(400);
    });

    it("should create with custom code", () => {
      const error = new ChallengeError(
        "Challenge expired",
        "CHALLENGE_NOT_FOUND",
      );
      expect(error.code).toBe("CHALLENGE_NOT_FOUND");
    });
  });

  describe("AuthServerError", () => {
    it("should create with default message", () => {
      const error = new AuthServerError();
      expect(error.message).toContain("Internal server error");
      expect(error.code).toBe("AUTH_SERVER_ERROR");
      expect(error.statusCode).toBe(500);
    });

    it("should create with custom message", () => {
      const error = new AuthServerError("Database connection failed");
      expect(error.message).toBe("Database connection failed");
      expect(error.statusCode).toBe(500);
    });
  });

  describe("Type Guards", () => {
    it("should detect WalletAuthError", () => {
      const error = new InvalidSignatureError();
      expect(is_wallet_auth_error(error)).toBe(true);
    });

    it("should detect subclass errors", () => {
      const errors = [
        new InvalidSignatureError(),
        new ChallengeExpiredError(),
        new UserNotFoundError("key"),
        new ValidationError("msg"),
        new JWTError("msg"),
        new ChallengeError("msg"),
        new AuthServerError(),
      ];

      errors.forEach((error) => {
        expect(is_wallet_auth_error(error)).toBe(true);
      });
    });

    it("should reject non-WalletAuthError", () => {
      expect(is_wallet_auth_error(new Error("Regular error"))).toBe(false);
      expect(is_wallet_auth_error("string")).toBe(false);
      expect(is_wallet_auth_error(null)).toBe(false);
      expect(is_wallet_auth_error(undefined)).toBe(false);
    });
  });

  describe("Error Conversion", () => {
    it("should pass through WalletAuthError", () => {
      const original = new InvalidSignatureError();
      const converted = to_wallet_auth_error(original);
      expect(converted).toBe(original);
    });

    it("should convert Error to AuthServerError", () => {
      const error = new Error("Something went wrong");
      const converted = to_wallet_auth_error(error);
      expect(converted instanceof AuthServerError).toBe(true);
      expect(converted.message).toContain("Something went wrong");
    });

    it("should handle non-Error objects", () => {
      const converted = to_wallet_auth_error("string error");
      expect(converted instanceof AuthServerError).toBe(true);
      expect(converted.message).toContain("Unknown error");
    });

    it("should handle null/undefined", () => {
      const nullConverted = to_wallet_auth_error(null);
      const undefinedConverted = to_wallet_auth_error(undefined);

      expect(nullConverted instanceof AuthServerError).toBe(true);
      expect(undefinedConverted instanceof AuthServerError).toBe(true);
    });
  });

  describe("Error Inheritance", () => {
    it("should maintain prototype chain", () => {
      const error = new InvalidSignatureError();
      expect(error instanceof InvalidSignatureError).toBe(true);
      expect(error instanceof WalletAuthError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    it("should preserve stack trace", () => {
      const error = new InvalidSignatureError();
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("InvalidSignatureError");
    });
  });

  describe("Error Serialization", () => {
    it("should serialize all error types", () => {
      const errors = [
        new InvalidSignatureError(),
        new ChallengeExpiredError(),
        new UserNotFoundError("key"),
        new ValidationError("msg", "field"),
        new JWTError("msg"),
        new ChallengeError("msg"),
        new AuthServerError(),
      ];

      errors.forEach((error) => {
        const json = error.toJSON();
        expect(json).toHaveProperty("name");
        expect(json).toHaveProperty("message");
        expect(json).toHaveProperty("code");
        expect(json).toHaveProperty("statusCode");
      });
    });
  });
});
