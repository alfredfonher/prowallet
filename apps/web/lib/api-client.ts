// lib/api-client.ts

import { getCurrentApiUrl } from "./config/environment";

// Dinámicamente obtiene la URL basada en el entorno
export const API_BASE_URL = (() => {
  // En server-side, usar variable de entorno
  if (typeof window === "undefined") {
    return (
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_API_URL_CLOUD ||
      "https://servicioshilda.orioncaribe.com/api/v1"
    );
  }

  // En client-side, usar detección automática
  return getCurrentApiUrl();
})();

interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  extra?: Record<string, any>;
}

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  extra?: Record<string, any>;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

export class ApiClient {
  private baseUrl: string;
  private token: string | null;
  private csrfTokenProvider:
    | (() => { headerName: string; token: string })
    | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.token = this.getToken();
  }

  private getToken(): string | null {
    try {
      if (typeof window !== "undefined") {
        const token = sessionStorage.getItem("auth_token");
        const timestamp = new Date().toISOString().split("T")[1].slice(0, 12);
        console.log(
          `[${timestamp}] [API-CLIENT] getToken() => ${token ? token.substring(0, 20) + "..." : "null"}`,
        );
        if (!token) {
          console.warn(
            "[API-CLIENT] ⚠️ TOKEN IS NULL - sessionStorage keys:",
            Object.keys(sessionStorage),
          );
        }
        return token;
      }
    } catch (e) {
      console.error("[API-CLIENT] getToken() error:", e);
      return null;
    }
    return null;
  }

  setToken(token: string): void {
    this.token = token;
    console.debug(
      "[API-CLIENT] setToken() => ",
      token.substring(0, 20) + "...",
    );
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("auth_token", token);
        console.debug("[API-CLIENT] Token saved to sessionStorage");
      }
    } catch (e) {
      console.warn("Could not save token to sessionStorage", e);
    }
  }

  clearToken(): void {
    this.token = null;
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("auth_token");
      }
    } catch (e) {
      console.warn("Could not clear token from sessionStorage", e);
    }
  }

  setCSRFToken(provider: () => { headerName: string; token: string }): void {
    this.csrfTokenProvider = provider;
  }

  private getHeaders(additionalHeaders?: Record<string, string>) {
    const timestamp = new Date().toISOString().split("T")[1].slice(0, 12);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...additionalHeaders,
    };

    // 🔥 FIX: Obtener token dinámicamente en cada llamada, NO usar this.token cacheado
    const currentToken = this.getToken();
    if (currentToken) {
      headers["Authorization"] = `Bearer ${currentToken}`;
      console.log(`[${timestamp}] [API-CLIENT] ✓ Authorization header SET`);
    } else {
      console.warn(
        `[${timestamp}] [API-CLIENT] ❌ NO TOKEN AVAILABLE for Authorization header`,
      );
    }

    // Añadir token CSRF si está configurado
    if (this.csrfTokenProvider) {
      try {
        const { headerName, token } = this.csrfTokenProvider();
        if (token) {
          headers[headerName] = token;
        }
      } catch (e) {
        console.warn("Could not add CSRF token to headers", e);
      }
    }

    return headers;
  }

  async request<T = any>(
    endpoint: string,
    options: RequestInit & {
      retry?: number;
      timeout?: number;
      retryDelay?: number;
      retryCondition?: (error: Error) => boolean;
    } = {},
  ): Promise<T> {
    const {
      retry = 3,
      timeout = 10000,
      retryDelay = 1000,
      retryCondition = (error: Error) => {
        // Retry on network errors and 5xx errors
        // For 429, only retry if it's not from our global rate limiter
        return (
          error.message.includes("fetch") ||
          error.message.includes("timeout") ||
          error.message.includes("HTTP 5")
        );
      },
      ...fetchOptions
    } = options;

    const url = `${this.baseUrl}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retry; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
          headers: this.getHeaders(
            fetchOptions.headers as Record<string, string>,
          ),
        });

        clearTimeout(timeoutId);

        // Handle 401 - Token expired
        if (response.status === 401) {
          this.clearToken();
          throw new Error("Unauthorized - Please login again");
        }

        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // Response is not JSON, try to get text
            const text = await response.text();
            console.warn(
              `Non-JSON error response from ${endpoint}:`,
              text.substring(0, 200),
            );
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();

        // Normalizar la respuesta para asegurar un contrato consistente
        let normalized: any;

        if (data && typeof data === "object") {
          if (Object.prototype.hasOwnProperty.call(data, "success")) {
            normalized = {
              ...data,
              extra: data.extra ?? data.data ?? {},
            };
          } else {
            normalized = {
              success: true,
              extra: data,
            };
          }
        } else {
          normalized = {
            success: true,
            extra: { value: data },
          };
        }

        console.log(
          `✓ ${options.method || "GET"} ${endpoint} (attempt ${attempt + 1})`,
          normalized,
        );
        return normalized as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if it's an abort error (timeout)
        if (lastError.name === "AbortError") {
          lastError = new Error(`Request timeout (${timeout}ms)`);
        }

        const isRateLimited = lastError.message.includes("429");
        const isRetryable = retryCondition(lastError);

        if (isRateLimited) {
          console.warn(
            `⚠️  Rate limited at ${endpoint}. This usually means the server is experiencing heavy load.`,
          );
        } else {
          console.warn(
            `✗ Request attempt ${attempt + 1}/${retry} to ${endpoint}:`,
            lastError.message,
          );
        }

        // Check if we should retry this error
        if (!isRetryable || attempt === retry - 1) {
          throw lastError;
        }

        // Exponential backoff with jitter - but more aggressive for rate limits
        const baseDelay = isRateLimited
          ? retryDelay * Math.pow(2, attempt + 2) // Larger backoff for 429
          : retryDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 0.1 * baseDelay;
        const delayMs = baseDelay + jitter;

        console.log(
          `⏳ Waiting ${Math.round(delayMs)}ms before retry ${attempt + 2}/${retry}...`,
        );

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw lastError || new Error("Request failed");
  }

  async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  // ============================================================================
  // PURCHASE API ENDPOINTS
  // ============================================================================

  async getPurchasePrice(amount: number): Promise<any> {
    const response = await this.get(`/purchase/price?amount=${amount}`);
    return response.extra || response.data || {};
  }

  async getPaymentMethods(): Promise<any[]> {
    const response = await this.get("/purchase/payment-methods");
    return response.extra || response.data || [];
  }

  async initiatePurchase(params: {
    walletAddress: string;
    tokenAmount: number;
    paymentMethod: string;
    maxSlippage?: number;
  }): Promise<any> {
    const response = await this.post("/purchase/initiate", params);
    return response.extra || response.data || {};
  }

  async confirmPurchase(
    transactionId: string,
    signature: string,
    blockSlot?: number,
  ): Promise<any> {
    const response = await this.post(`/purchase/confirm/${transactionId}`, {
      signature,
      blockSlot,
    });
    return response.extra || response.data || {};
  }

  async getPurchaseStatus(transactionId: string): Promise<any> {
    const response = await this.get(`/purchase/status/${transactionId}`);
    return response.extra || response.data || {};
  }

  async getPurchaseHistory(
    walletAddress: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: string;
      paymentMethod?: string;
      sort?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<any> {
    const params = new URLSearchParams();
    if (options?.limit) params.append("limit", String(options.limit));
    if (options?.offset) params.append("offset", String(options.offset));
    if (options?.status) params.append("status", options.status);
    if (options?.paymentMethod)
      params.append("paymentMethod", options.paymentMethod);
    if (options?.sort) params.append("sort", options.sort);
    if (options?.startDate) params.append("startDate", options.startDate);
    if (options?.endDate) params.append("endDate", options.endDate);

    const queryString = params.toString() ? `?${params.toString()}` : "";
    const response = await this.get(
      `/purchase/history/${walletAddress}${queryString}`,
    );
    return response.extra || response.data || { transactions: [], total: 0 };
  }

  async getMarketStats(): Promise<any> {
    const response = await this.get("/purchase/market-stats");
    return response.extra || response.data || {};
  }

  async getTopCryptos(limit: number = 10): Promise<any[]> {
    const response = await this.get(`/purchase/top-10?limit=${limit}`);
    return response.extra || response.data || [];
  }

  async getPriceHistory(
    timeframe: "1h" | "1d" | "7d" | "30d" | "1y",
  ): Promise<any[]> {
    const response = await this.get(`/purchase/price-history/${timeframe}`);
    return response.extra || response.data || [];
  }

  // ============================================================================
  // WALLET & BALANCE ENDPOINTS
  // ============================================================================

  async getTransactions(walletAddress: string): Promise<any[]> {
    const response = await this.get(`/transactions/${walletAddress}`);
    return response.extra || response.data || [];
  }

  async getWalletBalance(walletAddress: string): Promise<any> {
    const response = await this.get(`/wallet/balance/${walletAddress}`);
    return response.extra || response.data || {};
  }

  async getTokenBalance(
    walletAddress: string,
    tokenMint?: string,
  ): Promise<any> {
    const endpoint = tokenMint
      ? `/wallet/token-balance/${walletAddress}?mint=${tokenMint}`
      : `/wallet/token-balance/${walletAddress}`;
    const response = await this.get(endpoint);
    return response.extra || response.data || {};
  }

  // ============================================================================
  // EXCHANGE ENDPOINTS
  // ============================================================================

  async getExchangeRate(fromToken: string, toToken: string): Promise<any> {
    const response = await this.get(
      `/exchange/rate?from=${fromToken}&to=${toToken}`,
    );
    return response.extra || response.data || {};
  }

  async createExchangeOrder(params: {
    fromToken: string;
    toToken: string;
    amount: number;
    walletAddress: string;
    slippage?: number;
  }): Promise<any> {
    const response = await this.post("/exchange/create", params);
    return response.extra || response.data || {};
  }

  async getExchangeStatus(orderId: string): Promise<any> {
    const response = await this.get(`/exchange/status/${orderId}`);
    return response.extra || response.data || {};
  }
}

export const apiClient = new ApiClient();
