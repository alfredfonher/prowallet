// lib/auth-service.ts

import { apiClient, ApiResponse } from "./api-client";
import { disconnectAllWalletsAndClearCache } from "./wallet-cache";

// Helper function to extract token from API response (backend uses different field names)
function extractToken(data: any): string {
  return data?.token || data?.access_token || "";
}

// Helper function to extract error message from API response
function getErrorMessage(response: ApiResponse<any>): string {
  if (response.success === false && "error" in response) {
    return (response as any).error;
  }
  if (response.success === true && "message" in response) {
    return (response as any).message;
  }
  return "Unknown error occurred";
}

export interface AuthUser {
  id: number;
  username: string;
  email?: string;
  isAdmin: boolean;
  createdAt: string;
  walletAddress?: string;
}

export interface AuthResponse {
  token: string;
  expiresIn: string;
  user: AuthUser;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  password: string;
  email?: string;
}

export interface VerifyResponse {
  valid: boolean;
  user: AuthUser;
}

export class AuthService {
  private tokenKey = "auth_token";
  private userKey = "auth_user";
  private walletKey = "walletAddress";
  private lastActivityKey = "lastActivity";
  private SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 1 hora

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<ApiResponse<AuthResponse>>(
        "/auth/register",
        credentials,
      );

      if (!response.success) {
        throw new Error(
          (response as any).error ||
            (response as any).message ||
            "Registration failed",
        );
      }

      const tokenValue = extractToken(
        (response as any).extra || (response as any).data,
      );
      const user = ((response as any).extra || (response as any).data)?.user;
      if (!user) throw new Error("No user data in response");
      this.setToken(tokenValue);
      this.setUser(user);
      this.updateLastActivity();

      return { token: tokenValue, user, expiresIn: "" };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Registration failed",
      );
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<ApiResponse<AuthResponse>>(
        "/auth/login",
        credentials,
      );

      if (!response.success) {
        throw new Error(getErrorMessage(response));
      }

      const tokenValue = extractToken(
        (response as any).extra || (response as any).data,
      );
      const user = ((response as any).extra || (response as any).data)?.user;
      this.setToken(tokenValue);
      this.setUser(user);
      this.updateLastActivity();

      return { token: tokenValue, user, expiresIn: "" };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Login failed");
    }
  }

  async loginWallet(publicKey: string): Promise<AuthResponse> {
    throw new Error(
      "Use the wallet challenge flow: call requestChallenge + completeWalletLogin",
    );
  }

  async requestChallenge(
    publicKey: string,
  ): Promise<{ message: string; expiresAt: number }> {
    try {
      const response = await apiClient.post<
        ApiResponse<{ message: string; expiresAt: number }>
      >("/auth/request-challenge", { publicKey });

      if (!response.success)
        throw new Error(
          getErrorMessage(response) || "Failed to request challenge",
        );
      return response.data;
    } catch (err) {
      throw new Error(
        err instanceof Error ? err.message : "Failed to request challenge",
      );
    }
  }

  async completeWalletLogin(
    publicKey: string,
    message: string,
    signature: string,
  ): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<ApiResponse<AuthResponse>>(
        "/auth/login-wallet",
        { publicKey, message, signature },
      );

      if (!response.success)
        throw new Error(getErrorMessage(response) || "Wallet login failed");

      const tokenValue = extractToken(
        (response as any).extra || (response as any).data,
      );
      const user = ((response as any).extra || (response as any).data)?.user;
      if (!user) throw new Error("No user in response");
      this.setToken(tokenValue);
      this.setUser(user);

      return { token: tokenValue, user, expiresIn: "" };
    } catch (err) {
      throw new Error(
        err instanceof Error ? err.message : "Wallet login failed",
      );
    }
  }

  /**
   * Vincula una wallet Solana a la cuenta del usuario autenticado
   * Requiere que el usuario firme un mensaje con su wallet
   */
  async linkWallet(
    publicKey: string,
    message: string,
    signature: string,
  ): Promise<AuthUser> {
    try {
      const response = await apiClient.post<ApiResponse<{ user: AuthUser }>>(
        "/auth/link-wallet",
        { solanaPublicKey: publicKey, message, signature },
      );

      if (!response.success)
        throw new Error(getErrorMessage(response) || "Failed to link wallet");

      const user = ((response as any).extra || (response as any).data)?.user;
      if (!user) throw new Error("No user in response");

      // Actualizar usuario en sesión
      this.setUser(user);
      // Guardar wallet address
      this.setWalletAddress(publicKey);

      return user;
    } catch (err) {
      throw new Error(
        err instanceof Error ? err.message : "Failed to link wallet",
      );
    }
  }

  async verify(): Promise<VerifyResponse> {
    try {
      const response =
        await apiClient.post<ApiResponse<{ valid: boolean; user: AuthUser }>>(
          "/auth/verify",
        );

      if (!response.success) {
        this.logout();
        throw new Error("Session expired");
      }

      return response.data;
    } catch (error) {
      this.logout();
      throw error;
    }
  }

  async getMe(): Promise<AuthUser> {
    try {
      const response = await apiClient.get<ApiResponse<AuthUser>>("/auth/me");

      if (!response.success)
        throw new Error(getErrorMessage(response) || "Failed to fetch user");

      const user = ((response as any).extra ||
        (response as any).data) as AuthUser;
      this.setUser(user);
      return user;
    } catch (err) {
      throw new Error(
        err instanceof Error ? err.message : "Failed to fetch user",
      );
    }
  }

  logout(): void {
    this.clearToken();
    this.clearUser();
    this.clearWalletAddress();
    this.clearLastActivity();
    this.clearStorageCache();
    // 🔥 NUEVO: Desconectar de todos los providers y limpiar caché
    disconnectAllWalletsAndClearCache().catch((err) =>
      console.warn("Error limpiando wallets en logout:", err),
    );
    apiClient.clearToken();
  }

  private clearStorageCache(): void {
    try {
      if (typeof window !== "undefined") {
        // Limpiar todos los valores de caché relacionados con tokens/wallets
        const keysToRemove = [
          "auth_token",
          "auth_user",
          "walletAddress",
          "lastActivity",
          "prowallet.tokenInfo.v1", // Caché del token
          "prowallet.tokenInfo.cache.timestamp", // Timestamp de caché
        ];

        keysToRemove.forEach((key) => {
          try {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
          } catch (e) {
            console.warn(`Could not clear ${key}`, e);
          }
        });

        // Limpiar cualquier clave que comience con "prowallet"
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith("prowallet")) {
            localStorage.removeItem(key);
          }
        }
      }
    } catch (e) {
      console.warn("Could not clear storage cache", e);
    }
  }

  private clearLastActivity(): void {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(this.lastActivityKey);
      }
    } catch (e) {
      console.warn("Could not clear last activity", e);
    }
  }

  private setToken(token: string): void {
    console.log(
      "[AUTH-SERVICE] setToken() called with token:",
      token.substring(0, 20) + "...",
    );
    apiClient.setToken(token);
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(this.tokenKey, token);
        console.log(
          "[AUTH-SERVICE] Token saved to sessionStorage and apiClient",
        );
      }
    } catch (e) {
      console.warn("Could not save token", e);
    }
  }

  private getToken(): string | null {
    try {
      if (typeof window !== "undefined") {
        return sessionStorage.getItem(this.tokenKey);
      }
    } catch {
      return null;
    }
    return null;
  }

  private clearToken(): void {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(this.tokenKey);
      }
    } catch (e) {
      console.warn("Could not clear token", e);
    }
  }

  private setUser(user: AuthUser): void {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(this.userKey, JSON.stringify(user));
      }
    } catch (e) {
      console.warn("Could not save user", e);
    }
  }

  getUser(): AuthUser | null {
    try {
      if (typeof window !== "undefined") {
        const user = sessionStorage.getItem(this.userKey);
        return user ? JSON.parse(user) : null;
      }
    } catch {
      return null;
    }
    return null;
  }

  private clearUser(): void {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(this.userKey);
      }
    } catch (e) {
      console.warn("Could not clear user", e);
    }
  }

  isAuthenticated(): boolean {
    // Verificar si el token existe
    if (this.getToken() === null) {
      return false;
    }

    // Verificar si la sesión ha expirado
    if (this.isSessionExpired()) {
      this.logout();
      return false;
    }

    return true;
  }

  private isSessionExpired(): boolean {
    try {
      if (typeof window === "undefined") return false;

      const lastActivity = sessionStorage.getItem(this.lastActivityKey);
      if (!lastActivity) return false;

      const lastActivityTime = parseInt(lastActivity, 10);
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityTime;

      return timeSinceLastActivity > this.SESSION_TIMEOUT_MS;
    } catch {
      return false;
    }
  }

  private updateLastActivity(): void {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(this.lastActivityKey, Date.now().toString());
      }
    } catch (e) {
      console.warn("Could not update last activity", e);
    }
  }

  public updateActivity(): void {
    // Llamar esta función en cada acción importante del usuario
    if (this.isAuthenticated()) {
      this.updateLastActivity();
    }
  }

  setWalletAddress(address: string): void {
    try {
      if (typeof window !== "undefined") {
        // Guardar solo la address sin prefijos
        sessionStorage.setItem(this.walletKey, address);
      }
    } catch (e) {
      console.warn("Could not save wallet address", e);
    }
  }

  getWalletAddress(): string | null {
    try {
      if (typeof window !== "undefined") {
        return sessionStorage.getItem(this.walletKey);
      }
    } catch {
      return null;
    }
    return null;
  }

  private clearWalletAddress(): void {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(this.walletKey);
      }
    } catch (e) {
      console.warn("Could not clear wallet address", e);
    }
  }

  /**
   * Desvincular wallet del usuario (mantiene sesión activa)
   * NO hace logout
   */
  async unlinkWallet(): Promise<AuthUser | null> {
    try {
      const response = await apiClient.delete<ApiResponse<{ user: AuthUser }>>(
        "/auth/unlink-wallet",
      );

      if (!response.success)
        throw new Error(
          getErrorMessage(response) || "Error al desvincular wallet",
        );

      const user = ((response as any).extra || (response as any).data)?.user;
      if (!user) throw new Error("No user in response");

      // Actualizar sessionStorage con el usuario actualizado
      if (typeof window !== "undefined") {
        sessionStorage.setItem(this.userKey, JSON.stringify(user));
      }

      // Limpiar la wallet del localStorage
      this.clearWalletAddress();

      return user;
    } catch (error) {
      console.error("Error unlinking wallet:", error);
      throw error;
    }
  }
}

export const authService = new AuthService();
