/**
 * Validación de inputs para operaciones de compra/venta
 */

import { BALANCE_BUFFER_SOL } from "./constants";

/**
 * Estructura de resultado de validación
 */
export interface ValidationResult {
  is_valid: boolean;
  error_message: string | null;
}

/**
 * Valida que la cantidad de tokens sea válida
 *
 * @param token_amount - Cantidad de tokens a validar
 * @returns Resultado de validación
 *
 * @example
 * const result = validate_token_amount(100);
 * if (!result.is_valid) console.error(result.error_message);
 */
export function validate_token_amount(
  token_amount: number | string,
): ValidationResult {
  const amount =
    typeof token_amount === "string"
      ? Number.parseFloat(token_amount)
      : token_amount;

  if (isNaN(amount)) {
    return {
      is_valid: false,
      error_message: "La cantidad debe ser un número válido",
    };
  }

  if (amount <= 0) {
    return {
      is_valid: false,
      error_message: "La cantidad debe ser mayor a 0",
    };
  }

  if (!isFinite(amount)) {
    return {
      is_valid: false,
      error_message: "La cantidad no es válida",
    };
  }

  return {
    is_valid: true,
    error_message: null,
  };
}

/**
 * Valida que hay suficiente balance para comprar
 *
 * @param sol_balance - Balance actual en SOL
 * @param required_sol - SOL requerido (incluyendo fees)
 * @returns Resultado de validación
 *
 * @example
 * const result = validate_sol_balance(1.5, 1.0);
 * if (!result.is_valid) console.error(result.error_message);
 */
export function validate_sol_balance(
  sol_balance: number | null,
  required_sol: number,
): ValidationResult {
  if (sol_balance === null || sol_balance === undefined) {
    return {
      is_valid: false,
      error_message: "No se pudo obtener el balance de SOL",
    };
  }

  const required_with_buffer = required_sol + BALANCE_BUFFER_SOL;

  if (sol_balance < required_with_buffer) {
    return {
      is_valid: false,
      error_message: `Balance insuficiente. Necesitas ${required_with_buffer.toFixed(4)} SOL, tienes ${sol_balance.toFixed(4)} SOL`,
    };
  }

  return {
    is_valid: true,
    error_message: null,
  };
}

/**
 * Valida que hay suficiente balance de tokens para vender
 *
 * @param token_balance - Balance actual de tokens
 * @param required_tokens - Tokens requeridos
 * @returns Resultado de validación
 *
 * @example
 * const result = validate_token_balance(100, 50);
 * if (!result.is_valid) console.error(result.error_message);
 */
export function validate_token_balance(
  token_balance: number | null,
  required_tokens: number,
): ValidationResult {
  if (token_balance === null || token_balance === undefined) {
    return {
      is_valid: false,
      error_message: "No se pudo obtener el balance de tokens",
    };
  }

  if (token_balance < required_tokens) {
    return {
      is_valid: false,
      error_message: `Balance insuficiente. Necesitas ${required_tokens} tokens, tienes ${token_balance}`,
    };
  }

  return {
    is_valid: true,
    error_message: null,
  };
}

/**
 * Valida que la entrada de token tenga un formato válido (decimales)
 *
 * @param input_value - Valor ingresado por el usuario
 * @param max_decimals - Máximo de decimales permitidos (default: 9)
 * @returns true si el formato es válido
 *
 * @example
 * const valid = is_token_input_format_valid("100.123456789");
 * console.log(valid); // true
 */
export function is_token_input_format_valid(
  input_value: string,
  max_decimals = 9,
): boolean {
  // Permitir campo vacío
  if (input_value === "") return true;

  // Solo números y un punto decimal
  const regex = new RegExp(`^\\d*\\.?\\d{0,${max_decimals}}$`);

  return regex.test(input_value);
}

/**
 * Valida que la wallet esté conectada
 *
 * @param wallet_address - Dirección de la wallet
 * @returns Resultado de validación
 *
 * @example
 * const result = validate_wallet_connected("7KLd2Cx...");
 * if (!result.is_valid) console.error(result.error_message);
 */
export function validate_wallet_connected(
  wallet_address: string | null,
): ValidationResult {
  if (!wallet_address || wallet_address.trim().length === 0) {
    return {
      is_valid: false,
      error_message: "Debes conectar tu wallet",
    };
  }

  return {
    is_valid: true,
    error_message: null,
  };
}
