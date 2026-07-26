/**
 * CSRF Protection Service
 *
 * Implementa protección CSRF (Cross-Site Request Forgery) mediante tokens.
 * El token se genera en el cliente y se valida en el servidor.
 *
 * Estrategia:
 * 1. Token almacenado en sessionStorage (no accesible por scripts maliciosos vía CORS)
 * 2. Token enviado en header personalizado X-CSRF-Token (no en cookies)
 * 3. Validación del servidor de origen (Origin/Referer headers)
 */

import { apiClient } from "./api-client";

export class CSRFProtectionService {
  private readonly tokenKey = "csrf_token";
  private readonly headerName = "X-CSRF-Token";
  private readonly tokenLength = 32;

  /**
   * Genera un token CSRF aleatorio
   */
  private generateToken(): string {
    if (typeof window === "undefined") {
      throw new Error("CSRF token generation requires browser environment");
    }

    // Usar crypto.getRandomValues para generar bytes aleatorios
    const array = new Uint8Array(this.tokenLength);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(array);
    } else {
      // Fallback para navegadores antiguos
      for (let i = 0; i < this.tokenLength; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }

    // Convertir a hexadecimal
    return Array.from(array)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Obtiene o genera el token CSRF
   */
  getToken(): string {
    try {
      if (typeof window === "undefined") {
        return "";
      }

      let token = sessionStorage.getItem(this.tokenKey);

      if (!token) {
        token = this.generateToken();
        sessionStorage.setItem(this.tokenKey, token);
      }

      return token;
    } catch (e) {
      console.warn("Could not get CSRF token", e);
      return "";
    }
  }

  /**
   * Invalida el token actual (importante después de ciertos eventos como login)
   */
  invalidateToken(): void {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(this.tokenKey);
      }
    } catch (e) {
      console.warn("Could not invalidate CSRF token", e);
    }
  }

  /**
   * Valida que el token actual coincida con el proporcionado
   */
  validateToken(token: string): boolean {
    const currentToken = this.getToken();
    // Usar comparación de tiempo constante para evitar timing attacks
    return this.constantTimeCompare(currentToken, token);
  }

  /**
   * Comparación de tiempo constante para evitar timing attacks
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Configura el interceptor de API para añadir el token CSRF automáticamente
   */
  setupAPIInterceptor(): void {
    // El token se añadirá automáticamente a cada request
    // mediante el interceptor de apiClient
    apiClient.setCSRFToken(() => {
      const token = this.getToken();
      return {
        headerName: this.headerName,
        token,
      };
    });
  }

  /**
   * Valida headers de seguridad (Origin/Referer)
   * Esta función es principalmente para logging en el cliente
   * La verdadera validación ocurre en el servidor
   */
  validateOrigin(expectedOrigin: string): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    const currentOrigin = window.location.origin;
    return currentOrigin === expectedOrigin;
  }

  /**
   * Limpia todos los datos de CSRF (logout)
   */
  clear(): void {
    this.invalidateToken();
  }
}

export const csrfProtection = new CSRFProtectionService();
