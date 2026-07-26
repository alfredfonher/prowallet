/**
 * Tipos para parsear errores de autenticación
 */

export interface AuthErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
  };
  request_id?: string;
}

export interface ParsedAuthError {
  code: string;
  message: string;
  user_message: string;
  is_retryable: boolean;
  action_suggestion: string;
  details?: string;
}

/**
 * Mapeo de códigos de error a mensajes amigables
 */
const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: "Datos inválidos enviados",
  CHALLENGE_ERROR: "Error al crear el challenge de autenticación",
  CHALLENGE_EXPIRED: "El challenge expiró. Por favor, intenta de nuevo",
  INVALID_SIGNATURE:
    "La firma es inválida. Verifica que hayas firmado el mensaje correcto",
  INVALID_TOKEN: "El token es inválido o expiró",
  USER_NOT_FOUND: "Usuario no encontrado",
  AUTH_SERVER_ERROR: "Error en el servidor de autenticación",
  MISSING_AUTH_HEADER: "Autenticación requerida",
  NOT_AUTHENTICATED: "No estás autenticado",
  FORBIDDEN: "No tienes permisos para esta acción",
  INTERNAL_SERVER_ERROR: "Error interno del servidor",
  TOKEN_VERIFICATION_FAILED: "Error al verificar el token",
};

const RETRYABLE_ERRORS = new Set([
  "CHALLENGE_ERROR",
  "CHALLENGE_EXPIRED",
  "AUTH_SERVER_ERROR",
  "INTERNAL_SERVER_ERROR",
  "TOKEN_VERIFICATION_FAILED",
]);

const ACTION_SUGGESTIONS: Record<string, string> = {
  VALIDATION_ERROR: "Verifica los datos enviados y intenta de nuevo",
  CHALLENGE_ERROR: "Intenta solicitar un nuevo challenge",
  CHALLENGE_EXPIRED: "Solicita un nuevo challenge e intenta de nuevo",
  INVALID_SIGNATURE:
    "Asegúrate de usar el mismo wallet y firma el mensaje correctamente",
  INVALID_TOKEN: "Por favor, inicia sesión de nuevo",
  USER_NOT_FOUND: "El usuario no existe. Intenta con otra wallet",
  AUTH_SERVER_ERROR: "Intenta de nuevo en unos momentos",
  MISSING_AUTH_HEADER: "Por favor, inicia sesión primero",
  NOT_AUTHENTICATED: "Por favor, inicia sesión primero",
  FORBIDDEN: "No tienes permisos para acceder a este recurso",
  INTERNAL_SERVER_ERROR: "Intenta de nuevo más tarde",
  TOKEN_VERIFICATION_FAILED:
    "Tu sesión expiró. Por favor, inicia sesión de nuevo",
};

/**
 * Parsea una respuesta de error de autenticación
 */
export function parse_auth_error(error: unknown): ParsedAuthError {
  let error_response: AuthErrorResponse | null = null;

  if (error instanceof Response) {
    // Si es una respuesta HTTP
    try {
      const data = error.json() as any;
      if (data.error) {
        error_response = data as AuthErrorResponse;
      }
    } catch {
      // Fallback si no es JSON
    }
  } else if (typeof error === "object" && error !== null && "error" in error) {
    error_response = error as AuthErrorResponse;
  } else if (error instanceof Error) {
    // Intentar parsear el mensaje de error
    try {
      const data = JSON.parse(error.message);
      if (data.error) {
        error_response = data as AuthErrorResponse;
      }
    } catch {
      // Fallback si no es JSON
    }
  }

  if (error_response) {
    const code = error_response.error.code;
    const is_retryable = RETRYABLE_ERRORS.has(code);

    return {
      code,
      message: error_response.error.message,
      user_message:
        ERROR_MESSAGES[code] ||
        error_response.error.message ||
        "Ocurrió un error",
      is_retryable,
      action_suggestion:
        ACTION_SUGGESTIONS[code] || "Por favor, intenta de nuevo",
      details: error_response.error.details,
    };
  }

  // Fallback para errores no estructurados
  const generic_error = error instanceof Error ? error.message : String(error);

  return {
    code: "UNKNOWN_ERROR",
    message: generic_error,
    user_message: "Ocurrió un error desconocido",
    is_retryable: true,
    action_suggestion: "Por favor, intenta de nuevo",
  };
}

/**
 * Obtiene un mensaje amigable para mostrar al usuario
 */
export function get_user_friendly_message(error: unknown): string {
  const parsed = parse_auth_error(error);
  return parsed.user_message;
}

/**
 * Verifica si un error es retryable
 */
export function is_retryable(error: unknown): boolean {
  const parsed = parse_auth_error(error);
  return parsed.is_retryable;
}

/**
 * Obtiene la sugerencia de acción para el usuario
 */
export function get_action_suggestion(error: unknown): string {
  const parsed = parse_auth_error(error);
  return parsed.action_suggestion;
}
