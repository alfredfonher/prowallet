import { describe, it, expect, vi, beforeEach } from "vitest";
import * as jwt from "jsonwebtoken";

// Set JWT_SECRET before importing the service module
process.env.JWT_SECRET = "test_secret_key_for_testing_only";

import {
  create_jwt_token,
  verify_jwt_token,
  decode_jwt_token,
  get_token_expiry,
  is_token_expired,
} from "../jwt.service";

describe("jwt_service", () => {
  const valid_input = {
    user_id: 123,
    username: "test_user",
    public_key: "11111111111111111111111111111112",
    is_admin: false,
  };

  describe("create_jwt_token", () => {
    it("should create a valid token", () => {
      const result = create_jwt_token(valid_input);

      expect(result.token).toBeDefined();
      expect(result.expires_in).toBe("24h");
      expect(result.token).toMatch(/^eyJ/);
    });

    it("should create unique tokens for different users", () => {
      const token1 = create_jwt_token(valid_input);
      const token2 = create_jwt_token({
        ...valid_input,
        user_id: 456,
        username: "another_user",
      });

      expect(token1.token).not.toBe(token2.token);
    });

    it("should include user data in token payload", () => {
      const result = create_jwt_token(valid_input);
      const decoded = jwt.decode(result.token) as any;

      expect(decoded.user_id).toBe(valid_input.user_id);
      expect(decoded.username).toBe(valid_input.username);
      expect(decoded.public_key).toBe(valid_input.public_key);
      expect(decoded.is_admin).toBe(valid_input.is_admin);
    });

    it("should include iat claim in token", () => {
      const before_time = Math.floor(Date.now() / 1000);
      const result = create_jwt_token(valid_input);
      const after_time = Math.floor(Date.now() / 1000);
      const decoded = jwt.decode(result.token) as any;

      expect(decoded.iat).toBeGreaterThanOrEqual(before_time);
      expect(decoded.iat).toBeLessThanOrEqual(after_time);
    });

    it("should throw JWTError on invalid input", () => {
      expect(() => {
        create_jwt_token({
          user_id: NaN,
          username: "",
          public_key: "",
          is_admin: false,
        });
      }).toThrow();
    });
  });

  describe("verify_jwt_token", () => {
    it("should verify a valid token", () => {
      const { token } = create_jwt_token(valid_input);
      const decoded = verify_jwt_token(token);

      expect(decoded.user_id).toBe(valid_input.user_id);
      expect(decoded.username).toBe(valid_input.username);
      expect(decoded.public_key).toBe(valid_input.public_key);
      expect(decoded.is_admin).toBe(valid_input.is_admin);
    });

    it("should throw error for invalid token", () => {
      expect(() => {
        verify_jwt_token("invalid.token.here");
      }).toThrow("Invalid token");
    });

    it("should throw error for expired token", () => {
      // Crear token con expiración muy corta
      const secret = process.env.JWT_SECRET || "test-secret";
      const expired_token = jwt.sign(valid_input, secret, {
        expiresIn: "-1h",
      });

      expect(() => {
        verify_jwt_token(expired_token);
      }).toThrow("Token has expired");
    });

    it("should throw error for tampered token", () => {
      const { token } = create_jwt_token(valid_input);
      const tampered_token = token.slice(0, -5) + "XXXXX";

      expect(() => {
        verify_jwt_token(tampered_token);
      }).toThrow("Invalid token");
    });

    it("should include exp claim in decoded token", () => {
      const { token } = create_jwt_token(valid_input);
      const decoded = verify_jwt_token(token);

      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  describe("decode_jwt_token", () => {
    it("should decode a token without verification", () => {
      const { token } = create_jwt_token(valid_input);
      const decoded = decode_jwt_token(token);

      expect(decoded).toBeDefined();
      expect(decoded?.user_id).toBe(valid_input.user_id);
      expect(decoded?.username).toBe(valid_input.username);
    });

    it("should return null for invalid token", () => {
      const decoded = decode_jwt_token("invalid.token");
      expect(decoded).toBeNull();
    });

    it("should decode expired token without throwing", () => {
      const secret = process.env.JWT_SECRET || "test-secret";
      const expired_token = jwt.sign(valid_input, secret, {
        expiresIn: "-1h",
      });

      const decoded = decode_jwt_token(expired_token);
      expect(decoded).toBeDefined();
      expect(decoded?.user_id).toBe(valid_input.user_id);
    });

    it("should return null on decode error", () => {
      const decoded = decode_jwt_token("");
      expect(decoded).toBeNull();
    });
  });

  describe("get_token_expiry", () => {
    it("should return expiry timestamp for valid token", () => {
      const { token } = create_jwt_token(valid_input);
      const expiry = get_token_expiry(token);

      expect(expiry).toBeDefined();
      expect(expiry).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it("should return null for invalid token", () => {
      const expiry = get_token_expiry("invalid.token");
      expect(expiry).toBeNull();
    });

    it("should return expiry even for expired token", () => {
      const secret = process.env.JWT_SECRET || "test-secret";
      const expired_token = jwt.sign(valid_input, secret, {
        expiresIn: "-1h",
      });

      const expiry = get_token_expiry(expired_token);
      expect(expiry).toBeDefined();
      expect(expiry).toBeLessThan(Math.floor(Date.now() / 1000));
    });
  });

  describe("is_token_expired", () => {
    it("should return false for valid token", () => {
      const { token } = create_jwt_token(valid_input);
      const expired = is_token_expired(token);

      expect(expired).toBe(false);
    });

    it("should return true for expired token", () => {
      const secret = process.env.JWT_SECRET || "test-secret";
      const expired_token = jwt.sign(valid_input, secret, {
        expiresIn: "-1h",
      });

      const expired = is_token_expired(expired_token);
      expect(expired).toBe(true);
    });

    it("should return true for invalid token", () => {
      const expired = is_token_expired("invalid.token");
      expect(expired).toBe(true);
    });
  });
});
