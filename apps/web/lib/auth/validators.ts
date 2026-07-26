/**
 * Validadores de contraseña para registro y cambios de clave
 */

/**
 * Estructura con los requisitos de password validados
 */
export interface PasswordRequirements {
  longitud: boolean;
  mayuscula: boolean;
  minuscula: boolean;
  numero: boolean;
  simbolo: boolean;
}

/**
 * Valida cada requisito de la contraseña
 *
 * Requisitos:
 * - Mínimo 8 caracteres
 * - Al menos una mayúscula (A-Z)
 * - Al menos una minúscula (a-z)
 * - Al menos un número (0-9)
 * - Al menos un símbolo (@$!%*?&)
 *
 * @param password - La contraseña a validar
 * @returns Objeto con cada requisito validado
 *
 * @example
 * const reqs = validate_password_requirements("MiPassword123!");
 * console.log(reqs.longitud); // true
 * console.log(reqs.simbolo); // true
 */
export function validate_password_requirements(
  password: string,
): PasswordRequirements {
  return {
    longitud: password.length >= 8,
    mayuscula: /[A-Z]/.test(password),
    minuscula: /[a-z]/.test(password),
    numero: /\d/.test(password),
    simbolo: /[@$!%*?&]/.test(password),
  };
}

/**
 * Valida que la contraseña cumpla TODOS los requisitos
 *
 * @param password - La contraseña a validar
 * @returns true si cumple todos los requisitos, false si no
 *
 * @example
 * const valid = is_password_valid("MiPassword123!");
 * console.log(valid); // true
 *
 * const invalid = is_password_valid("123");
 * console.log(invalid); // false (muy corta)
 */
export function is_password_valid(password: string): boolean {
  const reqs = validate_password_requirements(password);
  return (
    reqs.longitud &&
    reqs.mayuscula &&
    reqs.minuscula &&
    reqs.numero &&
    reqs.simbolo
  );
}

/**
 * Retorna los requisitos que le faltan al password como array de strings
 *
 * @param password - La contraseña a validar
 * @returns Array con los requisitos faltantes (mensajes en español)
 *
 * @example
 * const missing = get_missing_password_requirements("pass");
 * console.log(missing);
 * // ["Mínimo 8 caracteres", "Mayúscula (A-Z)", "Número (0-9)", "Símbolo (@$!%*?&)"]
 */
export function get_missing_password_requirements(password: string): string[] {
  const reqs = validate_password_requirements(password);
  const missing: string[] = [];

  if (!reqs.longitud) missing.push("Mínimo 8 caracteres");
  if (!reqs.mayuscula) missing.push("Mayúscula (A-Z)");
  if (!reqs.minuscula) missing.push("Minúscula (a-z)");
  if (!reqs.numero) missing.push("Número (0-9)");
  if (!reqs.simbolo) missing.push("Símbolo (@$!%*?&)");

  return missing;
}
