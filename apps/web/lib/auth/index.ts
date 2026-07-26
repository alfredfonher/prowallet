/**
 * Módulo de autenticación - exporta utilidades y handlers
 */

export {
  validate_password_requirements,
  is_password_valid,
  get_missing_password_requirements,
  type PasswordRequirements,
} from "./validators";

export {
  handle_login_submit,
  handle_register_submit,
  type LoginResult,
  type RegisterResult,
} from "./auth-handlers";
