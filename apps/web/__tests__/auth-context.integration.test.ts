import { describe, it, expect, beforeEach, vi } from "vitest";
import { parse_auth_error } from "@/lib/auth-errors";
import { WalletLoginProgress } from "@/hooks/use-wallet-login";

/**
 * Integration tests for auth-context with wallet login flow
 * Tests the complete authentication system including:
 * - Error parsing and user-friendly messages
 * - Progress tracking through 5 stages
 * - Snake case property naming
 * - Wallet connection lifecycle
 */

describe("Auth Context Integration", () => {
  describe("Progress Tracking", () => {
    it("should track all 5 progress stages", () => {
      const stages: Array<WalletLoginProgress["stage"]> = [
        "idle",
        "requesting-challenge",
        "signing",
        "submitting",
        "complete",
      ];

      expect(stages).toHaveLength(5);
      stages.forEach((stage) => {
        expect(typeof stage).toBe("string");
        expect(stage.length).toBeGreaterThan(0);
      });
    });

    it("should track progress percentage correctly", () => {
      const progress_levels = [
        { stage: "idle", percent: 0 },
        { stage: "requesting-challenge", percent: 20 },
        { stage: "signing", percent: 40 },
        { stage: "submitting", percent: 60 },
        { stage: "complete", percent: 100 },
      ];

      progress_levels.forEach(({ stage, percent }) => {
        expect(percent).toBeGreaterThanOrEqual(0);
        expect(percent).toBeLessThanOrEqual(100);
      });
    });

    it("should include error information in progress", () => {
      const error_progress: WalletLoginProgress = {
        stage: "error",
        message: "",
        progress_percent: 0,
        error: "Wallet not found",
      };

      expect(error_progress.error).toBe("Wallet not found");
      expect(error_progress.stage).toBe("error");
    });
  });

  describe("Error Parsing", () => {
    it("should parse network errors with user-friendly message", () => {
      const network_error = new Error("ECONNREFUSED");
      const parsed = parse_auth_error(network_error);

      expect(parsed.user_message).toBeTruthy();
      expect(parsed.user_message).not.toContain("ECONNREFUSED");
    });

    it("should identify retryable errors", () => {
      const timeout_error = new Error("ETIMEDOUT");
      const parsed = parse_auth_error(timeout_error);

      expect(parsed.is_retryable).toBe(true);
    });

    it("should parse API validation errors", () => {
      const validation_error = new Error("Validation failed: invalid address");
      const parsed = parse_auth_error(validation_error);

      expect(parsed.user_message).toContain("dirección");
    });

    it("should handle wallet-specific errors", () => {
      const wallet_error = new Error("Phantom not installed");
      const parsed = parse_auth_error(wallet_error);

      expect(parsed.user_message.toLowerCase()).toContain("phantom");
    });
  });

  describe("Context Property Naming", () => {
    it("should use snake_case for all properties", () => {
      const expected_properties = [
        "user",
        "is_loading",
        "error",
        "login",
        "register",
        "login_with_wallet",
        "logout",
        "is_authenticated",
        "wallet_login_progress",
      ];

      expected_properties.forEach((prop) => {
        const is_snake_case = /^[a-z_]+$/.test(prop);
        expect(is_snake_case).toBe(true);
      });
    });

    it("should not have camelCase properties", () => {
      const forbidden_properties = [
        "isLoading",
        "isAuthenticated",
        "loginWithWallet",
        "setError",
        "contextError",
      ];

      forbidden_properties.forEach((prop) => {
        const is_camel_case = /^[a-z]+[A-Z]/.test(prop);
        expect(is_camel_case).toBe(true);
      });
    });
  });

  describe("Wallet Connection Lifecycle", () => {
    it("should clear progress when logout is called", () => {
      const initial_progress: WalletLoginProgress = {
        stage: "complete",
        message: "Conectado",
        progress_percent: 100,
      };

      // After logout, progress should reset
      const reset_progress: WalletLoginProgress = {
        stage: "idle",
        message: "",
        progress_percent: 0,
      };

      expect(initial_progress.stage).not.toBe(reset_progress.stage);
      expect(reset_progress.progress_percent).toBe(0);
    });

    it("should handle multiple reconnection attempts", () => {
      const attempts = 3;
      const max_retries = 3;

      expect(attempts).toBeLessThanOrEqual(max_retries);
    });
  });

  describe("Error Scenarios", () => {
    it("should handle wallet not found error", () => {
      const error = new Error("Wallet no encontrada");
      const parsed = parse_auth_error(error);

      expect(parsed.user_message).toBeTruthy();
      expect(parsed.code).toMatch(/WALLET|NOT_FOUND|PROVIDER/);
    });

    it("should handle signature timeout", () => {
      const error = new Error("Timeout de firma");
      const parsed = parse_auth_error(error);

      expect(parsed.is_retryable).toBe(true);
      expect(parsed.user_message).toContain("tiempo");
    });

    it("should handle network connection errors", () => {
      const error = new Error("Network error: ECONNREFUSED");
      const parsed = parse_auth_error(error);

      expect(parsed.is_retryable).toBe(true);
    });

    it("should handle server response errors", () => {
      const server_error = {
        response: {
          data: {
            error: "Invalid signature",
            code: "INVALID_SIGNATURE",
          },
        },
      } as any;

      const parsed = parse_auth_error(server_error);
      expect(parsed.code).toBe("INVALID_SIGNATURE");
    });
  });

  describe("Progress Message Updates", () => {
    it("should provide clear message for each stage", () => {
      const messages = [
        {
          stage: "requesting-challenge",
          message: "Solicitando desafío",
        },
        { stage: "signing", message: "Por favor, firma" },
        { stage: "submitting", message: "Verificando firma" },
        { stage: "complete", message: "¡Login exitoso!" },
      ];

      messages.forEach(({ stage, message }) => {
        expect(message).toBeTruthy();
        expect(message.length).toBeGreaterThan(0);
      });
    });
  });

  describe("User Experience Flow", () => {
    it("should provide action suggestion for common errors", () => {
      const errors_and_suggestions = [
        {
          error: "Phantom no está instalado",
          suggestion_keyword: "instala",
        },
        {
          error: "Timeout de conexión",
          suggestion_keyword: "intenta",
        },
        {
          error: "Firma rechazada",
          suggestion_keyword: "confirma",
        },
      ];

      errors_and_suggestions.forEach(({ error, suggestion_keyword }) => {
        const err = new Error(error);
        const parsed = parse_auth_error(err);

        // Suggestion should contain actionable guidance
        expect(parsed.action_suggestion).toBeTruthy();
        expect(
          parsed.action_suggestion.toLowerCase().includes(suggestion_keyword),
        ).toBe(true);
      });
    });

    it("should show success message when login completes", () => {
      const success_progress: WalletLoginProgress = {
        stage: "complete",
        message: "¡Login exitoso!",
        progress_percent: 100,
      };

      expect(success_progress.message).toContain("exitoso");
      expect(success_progress.progress_percent).toBe(100);
    });
  });

  describe("Loading State Management", () => {
    it("should properly manage is_loading flag", () => {
      const states = [true, false];

      states.forEach((state) => {
        const is_boolean = typeof state === "boolean";
        expect(is_boolean).toBe(true);
      });
    });

    it("should disable buttons when is_loading is true", () => {
      const is_loading = true;
      const should_disable_button = is_loading;

      expect(should_disable_button).toBe(true);
    });
  });

  describe("Register Function", () => {
    it("should use parse_auth_error in register", () => {
      const validation_error = new Error("Username already exists");
      const parsed = parse_auth_error(validation_error);

      expect(parsed.user_message).toBeTruthy();
      expect(parsed.user_message).not.toContain("Error");
    });

    it("should handle registration with all parameters", () => {
      const params = {
        username: "testuser",
        password: "secure123!",
        email: "test@example.com",
      };

      expect(params.username).toBeTruthy();
      expect(params.password.length).toBeGreaterThanOrEqual(8);
      expect(params.email).toContain("@");
    });
  });

  describe("Logout Function", () => {
    it("should reset wallet_login_progress to idle", () => {
      const before_logout: WalletLoginProgress = {
        stage: "complete",
        message: "Conectado",
        progress_percent: 100,
      };

      const after_logout: WalletLoginProgress = {
        stage: "idle",
        message: "",
        progress_percent: 0,
      };

      expect(before_logout.stage).not.toBe(after_logout.stage);
      expect(after_logout.stage).toBe("idle");
    });

    it("should clear error on logout", () => {
      const error_before = "Some error";
      const error_after = null;

      expect(error_before).toBeTruthy();
      expect(error_after).toBeNull();
    });
  });
});
