import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { getRequiredEnvVar } from "../../utils/env";

/**
 * Token Service - Handles JWT and refresh token generation/validation
 * Architecture:
 * - Access Token (JWT): 15-minute expiry, stored in memory on frontend
 * - Refresh Token: 7-day expiry, stored in httpOnly secure cookie
 * - Token rotation: New refresh token issued on each use
 */

interface TokenPayload {
  user_id: number;
  email: string;
  is_admin: boolean;
  iat: number;
}

interface RefreshTokenData {
  user_id: number;
  token_hash: string;
  expires_at: Date;
}

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

export class TokenService {
  /**
   * Generates an access token (short-lived JWT)
   * Expires in 15 minutes
   */
  static generate_access_token(
    user_id: number,
    email: string,
    is_admin: boolean = false,
  ): string {
    const payload: TokenPayload = {
      user_id,
      email,
      is_admin,
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, getRequiredEnvVar("JWT_SECRET"), {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });
  }

  /**
   * Generates a refresh token (long-lived JWT)
   * Expires in 7 days
   * Should be stored in httpOnly secure cookie on frontend
   */
  static generate_refresh_token(user_id: number, email: string): string {
    const payload = {
      user_id,
      email,
      type: "refresh",
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, getRequiredEnvVar("JWT_REFRESH_SECRET"), {
      expiresIn: `${REFRESH_TOKEN_EXPIRY}s`,
    });
  }

  /**
   * Verifies an access token and returns the payload
   * Throws error if token is invalid or expired
   */
  static verify_access_token(token: string): TokenPayload {
    try {
      return jwt.verify(
        token,
        getRequiredEnvVar("JWT_SECRET"),
      ) as TokenPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error("Token de acceso expirado");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error("Token de acceso inválido");
      }
      throw error;
    }
  }

  /**
   * Verifies a refresh token and returns the payload
   * Throws error if token is invalid or expired
   */
  static verify_refresh_token(token: string): {
    user_id: number;
    email: string;
    type: string;
    iat: number;
  } {
    try {
      return jwt.verify(token, getRequiredEnvVar("JWT_REFRESH_SECRET")) as {
        user_id: number;
        email: string;
        type: string;
        iat: number;
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error("Refresh token expirado");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error("Refresh token inválido");
      }
      throw error;
    }
  }

  /**
   * Generates a secure random token for email verification or password reset
   * Returns a 32-byte hex string (64 characters)
   * Should be hashed before storing in database
   */
  static generate_secure_token(): string {
    return randomBytes(32).toString("hex");
  }

  /**
   * Generates refresh token data for storing in database
   * Token is hashed using SHA256 for security (not plaintext in DB)
   */
  static generate_refresh_token_data(user_id: number): RefreshTokenData {
    const token = this.generate_secure_token();
    const token_hash = this.hash_token(token);
    const expires_at = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000);

    return {
      user_id,
      token_hash,
      expires_at,
    };
  }

  /**
   * Simple SHA256 hash for token comparison
   * Note: In production, consider using bcrypt for token hashing
   */
  static hash_token(token: string): string {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Compares a plaintext token with a hashed token
   */
  static verify_token_hash(token: string, hash: string): boolean {
    return this.hash_token(token) === hash;
  }

  /**
   * Extracts user ID and email from access token without verification
   * Useful for logging and debugging
   * WARNING: Only use this when you need unverified claims
   */
  static decode_without_verification(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch {
      return null;
    }
  }

  /**
   * Checks if a token is expired
   */
  static is_token_expired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) {
        return true;
      }
      return decoded.exp < Math.floor(Date.now() / 1000);
    } catch {
      return true;
    }
  }
}
