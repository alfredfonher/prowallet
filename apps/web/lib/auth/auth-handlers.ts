/**
 * Manejadores de autenticación (login y registro)
 */

/**
 * Resultado del intento de login
 */
export interface LoginResult {
  success: boolean;
  error: string | null;
  token?: string;
  user?: any;
}

/**
 * Resultado del intento de registro
 */
export interface RegisterResult {
  success: boolean;
  error: string | null;
  token?: string;
  user?: any;
}

/**
 * Intenta hacer login con email y contraseña
 *
 * Flujo:
 * 1. Valida email y password no estén vacíos
 * 2. Envía POST /auth/login
 * 3. Guarda token en sessionStorage
 * 4. Retorna resultado
 *
 * @param email - Email del usuario
 * @param password - Contraseña
 * @param api_url - URL base del API (opcional, usa config por defecto)
 * @returns Resultado con success, error, token y user
 *
 * @example
 * const result = await handle_login_submit(
 *   "user@example.com",
 *   "Password123!",
 *   "http://localhost:3001/api/v1"
 * );
 *
 * if (result.success) {
 *   console.log("Login exitoso, token:", result.token);
 * } else {
 *   console.error("Error:", result.error);
 * }
 */
export async function handle_login_submit(
  email: string,
  password: string,
  api_url: string,
): Promise<LoginResult> {
  // Validar inputs
  if (!email || !password) {
    return {
      success: false,
      error: "Email y contraseña son requeridos",
    };
  }

  try {
    const response = await fetch(`${api_url}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Error al iniciar sesión",
      };
    }

    // Guardar token y usuario
    const token = data.data?.token || data.tokenValue;
    if (token) {
      sessionStorage.setItem("auth_token", token);
    }
    if (data.data?.user) {
      sessionStorage.setItem("user", JSON.stringify(data.data.user));
    }

    return {
      success: true,
      error: null,
      token,
      user: data.data?.user,
    };
  } catch (err) {
    const error_msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Error de conexión: ${error_msg}`,
    };
  }
}

/**
 * Intenta hacer registro con email y contraseña
 *
 * Flujo:
 * 1. Valida email, password y confirmPassword
 * 2. Valida que passwords coincidan
 * 3. Envía POST /auth/register
 * 4. Guarda token en sessionStorage
 * 5. Retorna resultado
 *
 * @param email - Email del usuario
 * @param password - Contraseña
 * @param confirm_password - Confirmación de contraseña
 * @param api_url - URL base del API (opcional, usa config por defecto)
 * @returns Resultado con success, error, token y user
 *
 * @example
 * const result = await handle_register_submit(
 *   "user@example.com",
 *   "Password123!",
 *   "Password123!",
 *   "http://localhost:3001/api/v1"
 * );
 *
 * if (result.success) {
 *   console.log("Registro exitoso");
 * } else {
 *   console.error("Error:", result.error);
 * }
 */
export async function handle_register_submit(
  email: string,
  password: string,
  confirm_password: string,
  api_url: string,
): Promise<RegisterResult> {
  // Validar inputs
  if (!email || !password || !confirm_password) {
    return {
      success: false,
      error: "Todos los campos son requeridos",
    };
  }

  if (password !== confirm_password) {
    return {
      success: false,
      error: "Las contraseñas no coinciden",
    };
  }

  try {
    const response = await fetch(`${api_url}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Manejar errores detallados del backend
      if (data.extra?.details && Array.isArray(data.extra.details)) {
        return {
          success: false,
          error: `Error: ${data.extra.details.join(", ")}`,
        };
      }
      if (data.extra?.error) {
        return {
          success: false,
          error: data.extra.error,
        };
      }
      if (data.message) {
        return {
          success: false,
          error: data.message,
        };
      }
      return {
        success: false,
        error: `Error ${response.status}: ${JSON.stringify(data)}`,
      };
    }

    if (data.success) {
      // Guardar token y usuario
      const token = data.data?.access_token || data.data?.token;
      if (token) {
        sessionStorage.setItem("auth_token", token);
      }
      if (data.data?.user) {
        sessionStorage.setItem("user", JSON.stringify(data.data.user));
      }

      return {
        success: true,
        error: null,
        token,
        user: data.data?.user,
      };
    }

    return {
      success: false,
      error: "Error desconocido en el registro",
    };
  } catch (err) {
    const error_msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Error de conexión: ${error_msg}`,
    };
  }
}
