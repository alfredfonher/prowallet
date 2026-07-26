import { describe, it, expect, beforeEach, vi } from "vitest";
import { request_challenge_handler } from "../request-challenge.handler";
import { login_wallet_handler } from "../login-wallet.handler";
import { create_jwt_token, verify_jwt_token } from "../jwt.service";
import {
  ChallengeExpiredError,
  InvalidSignatureError,
  ValidationError,
} from "../errors";

/**
 * Tests de integración para el flujo completo de autenticación
 */
describe("wallet_authentication_flow", () => {
  const mock_public_key = "11111111111111111111111111111112";
  const mock_message = "Sign this message: 1234567890";
  const mock_signature = "signature_valid_ed25519_signature_hex_string_here";

  describe("complete_flow", () => {
    it("should handle complete wallet login flow successfully", async () => {
      // 1. Request challenge
      const req_challenge = {
        body: { public_key: mock_public_key },
        headers: {},
      };

      const challenge_result = await handle_request_challenge(req_challenge);

      expect(challenge_result.success).toBe(true);
      expect(challenge_result.data.message).toBeDefined();

      // 2. Validate and login
      const req_login = {
        body: {
          public_key: mock_public_key,
          message: challenge_result.data.message,
          signature: mock_signature,
        },
        headers: {},
      };

      const login_result = await handle_login_wallet(req_login);

      expect(login_result.success).toBe(true);
      expect(login_result.data.token).toBeDefined();
      expect(login_result.data.user).toBeDefined();

      // 3. Verify token
      const token = login_result.data.token;
      const decoded = verify_jwt_token(token);

      expect(decoded.user_id).toBeDefined();
      expect(decoded.username).toBeDefined();
      expect(decoded.public_key).toBe(mock_public_key);
    });

    it("should handle missing public_key validation", async () => {
      const req = {
        body: {
          /* missing public_key */
        },
        headers: {},
      };

      const result = await handle_request_challenge(req);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe("VALIDATION_ERROR");
    });

    it("should handle invalid signature error", async () => {
      const req_challenge = {
        body: { public_key: mock_public_key },
        headers: {},
      };

      const challenge_result = await handle_request_challenge(req_challenge);

      const req_login = {
        body: {
          public_key: mock_public_key,
          message: challenge_result.data.message,
          signature: "invalid_signature_here",
        },
        headers: {},
      };

      const login_result = await handle_login_wallet(req_login);

      expect(login_result.success).toBe(false);
      expect(login_result.error.code).toBe("INVALID_SIGNATURE");
    });

    it("should handle expired challenge error", async () => {
      // Crear challenge que ya expiró
      const req_login = {
        body: {
          public_key: mock_public_key,
          message: "expired_challenge_message",
          signature: mock_signature,
        },
        headers: {},
      };

      const result = await handle_login_wallet(req_login);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe("CHALLENGE_EXPIRED");
    });

    it("should create consistent tokens", () => {
      const user_id = 123;
      const username = "test_user";
      const public_key = mock_public_key;

      // Create two tokens with same data
      const token1 = create_jwt_token({
        user_id,
        username,
        public_key,
        is_admin: false,
      }).token;

      const token2 = create_jwt_token({
        user_id,
        username,
        public_key,
        is_admin: false,
      }).token;

      // Tokens should be different (due to iat)
      expect(token1).not.toBe(token2);

      // But decode to same data
      const decoded1 = verify_jwt_token(token1);
      const decoded2 = verify_jwt_token(token2);

      expect(decoded1.user_id).toBe(decoded2.user_id);
      expect(decoded1.username).toBe(decoded2.username);
      expect(decoded1.public_key).toBe(decoded2.public_key);
    });

    it("should handle concurrent requests", async () => {
      const requests = [];

      for (let i = 0; i < 5; i++) {
        const req = {
          body: { public_key: `${mock_public_key}_${i}` },
          headers: {},
        };

        requests.push(handle_request_challenge(req));
      }

      const results = await Promise.all(requests);

      expect(results).toHaveLength(5);
      expect(results.every((r) => r.success)).toBe(true);
      expect(new Set(results.map((r) => r.data.message)).size).toBe(5); // Todos diferentes
    });

    it("should preserve user data through login flow", async () => {
      const user_data = {
        public_key: mock_public_key,
        username: "test_wallet_user",
      };

      // Login
      const login_token = create_jwt_token({
        user_id: 1,
        username: user_data.username,
        public_key: user_data.public_key,
        is_admin: false,
      }).token;

      // Verify
      const decoded = verify_jwt_token(login_token);

      expect(decoded.username).toBe(user_data.username);
      expect(decoded.public_key).toBe(user_data.public_key);
    });
  });

  describe("error_handling", () => {
    it("should return 400 for validation errors", async () => {
      const req = {
        body: {
          /* invalid */
        },
        headers: {},
      };

      const result = await handle_request_challenge(req);

      expect(result.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 401 for signature errors", async () => {
      const req = {
        body: {
          public_key: mock_public_key,
          message: mock_message,
          signature: "invalid",
        },
        headers: {},
      };

      const result = await handle_login_wallet(req);

      expect(result.error.code).toMatch(/INVALID_SIGNATURE|CHALLENGE/);
    });

    it("should include details in development mode", async () => {
      const prev_env = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const req = {
        body: {
          /* invalid */
        },
        headers: {},
      };

      const result = await handle_request_challenge(req);

      expect(result.error.details).toBeDefined();

      process.env.NODE_ENV = prev_env;
    });

    it("should not include details in production mode", async () => {
      const prev_env = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const req = {
        body: {
          /* invalid */
        },
        headers: {},
      };

      const result = await handle_request_challenge(req);

      expect(result.error.details).toBeUndefined();

      process.env.NODE_ENV = prev_env;
    });
  });
});

/**
 * Mock handlers para testing
 */
async function handle_request_challenge(req: any): Promise<any> {
  return new Promise((resolve) => {
    const res = {
      status: (code: number) => ({
        json: (data: any) => resolve({ ...data, _status: code }),
      }),
      json: (data: any) => resolve(data),
    };

    request_challenge_handler(req as any, res as any);
  });
}

async function handle_login_wallet(req: any): Promise<any> {
  return new Promise((resolve) => {
    const res = {
      status: (code: number) => ({
        json: (data: any) => resolve({ ...data, _status: code }),
      }),
      json: (data: any) => resolve(data),
    };

    login_wallet_handler(req as any, res as any);
  });
}
