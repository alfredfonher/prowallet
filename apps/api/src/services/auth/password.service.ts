import bcrypt from "bcrypt";

/**
 * Password Service - Handles password validation and hashing
 * Requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 lowercase letter (a-z)
 * - At least 1 number (0-9)
 * - At least 1 special character (@$!%*?&)
 */

const BCRYPT_ROUNDS = 12;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[a-zA-Z\d@$!%*?&]{8,}$/;

interface PasswordValidationResult {
  is_valid: boolean;
  errors: string[];
  suggestions: string[];
}

export class PasswordService {
  /**
   * Validates password against security requirements
   * Returns detailed validation result with errors and suggestions
   */
  static validate_password(password: string): PasswordValidationResult {
    const errors: string[] = [];
    const suggestions: string[] = [];

    // Check if password exists
    if (!password) {
      return {
        is_valid: false,
        errors: ["La contraseña es requerida"],
        suggestions: ["Ingresa una contraseña"],
      };
    }

    // Check minimum length
    if (password.length < PASSWORD_MIN_LENGTH) {
      errors.push(`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`);
      suggestions.push(
        `Tu contraseña tiene ${password.length} caracteres, necesita ${PASSWORD_MIN_LENGTH}`,
      );
    }

    // Check maximum length
    if (password.length > PASSWORD_MAX_LENGTH) {
      errors.push(`Máximo ${PASSWORD_MAX_LENGTH} caracteres`);
    }

    // Check for uppercase
    if (!/[A-Z]/.test(password)) {
      errors.push("Requiere al menos 1 mayúscula (A-Z)");
      suggestions.push("Agrega una letra mayúscula (ej: 'A')");
    }

    // Check for lowercase
    if (!/[a-z]/.test(password)) {
      errors.push("Requiere al menos 1 minúscula (a-z)");
      suggestions.push("Agrega una letra minúscula (ej: 'a')");
    }

    // Check for numbers
    if (!/\d/.test(password)) {
      errors.push("Requiere al menos 1 número (0-9)");
      suggestions.push("Agrega un número (ej: '5')");
    }

    // Check for special characters
    if (!/[@$!%*?&]/.test(password)) {
      errors.push("Requiere al menos 1 símbolo (@$!%*?&)");
      suggestions.push("Agrega un símbolo de: @$!%*?&");
    }

    // Check for spaces
    if (/\s/.test(password)) {
      errors.push("No puede contener espacios");
      suggestions.push("Remueve los espacios de tu contraseña");
    }

    const is_valid = errors.length === 0 && PASSWORD_REGEX.test(password);

    return {
      is_valid,
      errors,
      suggestions,
    };
  }

  /**
   * Hashes a password using bcrypt
   * Returns the hashed password (safe to store in database)
   */
  static async hash_password(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  /**
   * Compares a plaintext password with a hashed password
   * Returns true if passwords match, false otherwise
   */
  static async compare_passwords(
    plaintext: string,
    hashed: string,
  ): Promise<boolean> {
    return bcrypt.compare(plaintext, hashed);
  }

  /**
   * Validates and hashes password in one call
   * Useful for signup flow
   */
  static async validate_and_hash(password: string): Promise<{
    is_valid: boolean;
    hashed?: string;
    validation: PasswordValidationResult;
  }> {
    const validation = this.validate_password(password);

    if (!validation.is_valid) {
      return {
        is_valid: false,
        validation,
      };
    }

    const hashed = await this.hash_password(password);

    return {
      is_valid: true,
      hashed,
      validation,
    };
  }

  /**
   * Generates a temporary random password for password reset
   * Format: 16 random alphanumeric characters
   * NOTE: This should be replaced with a proper token-based reset system
   */
  static generate_temp_password(): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@$!%*?&";
    let password = "";

    // Ensure it has uppercase
    password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];

    // Ensure it has lowercase
    password += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];

    // Ensure it has number
    password += "0123456789"[Math.floor(Math.random() * 10)];

    // Ensure it has special char
    password += "@$!%*?&"[Math.floor(Math.random() * 7)];

    // Fill rest with random chars
    for (let i = 0; i < 12; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }

    // Shuffle the password
    return password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  }
}
