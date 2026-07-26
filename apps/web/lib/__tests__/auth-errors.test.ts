import { describe, it, expect } from "vitest";
import {
  parse_auth_error,
  get_user_friendly_message,
  is_retryable,
  get_action_suggestion,
} from "../auth-errors";

describe("auth_errors", () => {
  describe("parse_auth_error", () => {
    it("should parse structured error response", () => {
      const error = {
        error: {
          code: "INVALID_SIGNATURE",
          message: "Signature verification failed",
        },
      };

      const parsed = parse_auth_error(error);

      expect(parsed.code).toBe("INVALID_SIGNATURE");
      expect(parsed.message).toBe("Signature verification failed");
      expect(parsed.user_message).toBe(
        "La firma es inválida. Verifica que hayas firmado el mensaje correcto",
      );
    });

    it("should identify retryable errors", () => {
      const error = {
        error: {
          code: "CHALLENGE_EXPIRED",
          message: "Challenge has expired",
        },
      };

      const parsed = parse_auth_error(error);

      expect(parsed.is_retryable).toBe(true);
    });

    it("should identify non-retryable errors", () => {
      const error = {
        error: {
          code: "INVALID_SIGNATURE",
          message: "Invalid signature",
        },
      };

      const parsed = parse_auth_error(error);

      expect(parsed.is_retryable).toBe(false);
    });

    it("should provide action suggestion", () => {
      const error = {
        error: {
          code: "CHALLENGE_EXPIRED",
          message: "Challenge expired",
        },
      };

      const parsed = parse_auth_error(error);

      expect(parsed.action_suggestion).toBe(
        "Solicita un nuevo challenge e intenta de nuevo",
      );
    });

    it("should handle Error instances", () => {
      const error = new Error("Something went wrong");

      const parsed = parse_auth_error(error);

      expect(parsed.message).toBe("Something went wrong");
    });

    it("should handle unknown errors", () => {
      const parsed = parse_auth_error("random error string");

      expect(parsed.code).toBe("UNKNOWN_ERROR");
      expect(parsed.is_retryable).toBe(true);
    });

    it("should include details when available", () => {
      const error = {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          details: "Missing public_key field",
        },
      };

      const parsed = parse_auth_error(error);

      expect(parsed.details).toBe("Missing public_key field");
    });

    it("should handle all error codes", () => {
      const error_codes = [
        "VALIDATION_ERROR",
        "CHALLENGE_ERROR",
        "CHALLENGE_EXPIRED",
        "INVALID_SIGNATURE",
        "INVALID_TOKEN",
        "USER_NOT_FOUND",
        "AUTH_SERVER_ERROR",
        "MISSING_AUTH_HEADER",
        "NOT_AUTHENTICATED",
        "FORBIDDEN",
        "INTERNAL_SERVER_ERROR",
        "TOKEN_VERIFICATION_FAILED",
      ];

      for (const code of error_codes) {
        const error = {
          error: {
            code,
            message: "Test error",
          },
        };

        const parsed = parse_auth_error(error);

        expect(parsed.code).toBe(code);
        expect(parsed.user_message).toBeTruthy();
        expect(parsed.action_suggestion).toBeTruthy();
      }
    });
  });

  describe("get_user_friendly_message", () => {
    it("should return friendly message", () => {
      const error = {
        error: {
          code: "CHALLENGE_EXPIRED",
          message: "Challenge has expired",
        },
      };

      const message = get_user_friendly_message(error);

      expect(message).toBe("El challenge expiró. Por favor, intenta de nuevo");
    });

    it("should handle unknown errors", () => {
      const message = get_user_friendly_message("unknown");

      expect(message).toBe("Ocurrió un error desconocido");
    });
  });

  describe("is_retryable", () => {
    it("should return true for retryable errors", () => {
      const retryable_codes = [
        "CHALLENGE_ERROR",
        "CHALLENGE_EXPIRED",
        "AUTH_SERVER_ERROR",
        "INTERNAL_SERVER_ERROR",
        "TOKEN_VERIFICATION_FAILED",
      ];

      for (const code of retryable_codes) {
        const error = {
          error: {
            code,
            message: "Test error",
          },
        };

        expect(is_retryable(error)).toBe(true);
      }
    });

    it("should return false for non-retryable errors", () => {
      const non_retryable_codes = [
        "VALIDATION_ERROR",
        "INVALID_SIGNATURE",
        "INVALID_TOKEN",
        "USER_NOT_FOUND",
        "NOT_AUTHENTICATED",
        "FORBIDDEN",
      ];

      for (const code of non_retryable_codes) {
        const error = {
          error: {
            code,
            message: "Test error",
          },
        };

        expect(is_retryable(error)).toBe(false);
      }
    });
  });

  describe("get_action_suggestion", () => {
    it("should return action suggestion", () => {
      const error = {
        error: {
          code: "INVALID_SIGNATURE",
          message: "Invalid signature",
        },
      };

      const suggestion = get_action_suggestion(error);

      expect(suggestion).toBe(
        "Asegúrate de usar el mismo wallet y firma el mensaje correctamente",
      );
    });
  });
});
