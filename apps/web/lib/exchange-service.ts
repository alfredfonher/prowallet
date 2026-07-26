// lib/exchange-service.ts

import { apiClient, type ApiResponse } from "./api-client";

export interface PriceInfo {
  priceUSD: number;
  currencyCode: string;
  lastUpdated: string;
}

export interface TokenInfoResponse {
  name: string;
  symbol: string;
  totalSupply: number;
  circulatingSupply: number;
  price: number;
  marketCap: number;
  holders: number;
}

export interface BalanceInfo {
  username: string;
  tokenBalance: string;
  usdValue: number;
  totalSpent: number;
  lastUpdated: string;
}

export interface BuyTokensRequest {
  username: string;
  amount: number;
  totalPriceUSD?: number;
  publicKey?: string;
  signature?: string; // Firma de Phantom
  signedMessage?: string; // Mensaje firmado
}

export interface BuyTokensResponse {
  username: string;
  tokensPurchased: string;
  usdSpent: number;
  totalBalance: string;
  totalSpent: number;
  solanaPublicKey?: string;
  timestamp: string;
  transactionId: string;
}

export interface SellTokensRequest {
  username: string;
  tokenAmount: number;
  signature?: string; // Firma de Phantom
  signedMessage?: string; // Mensaje firmado
}

export interface SellTokensResponse {
  username: string;
  tokensSold: string;
  usdReceived: number;
  totalBalance: string;
  timestamp: string;
  transactionId: string;
}

export interface TransferTokensRequest {
  fromUsername: string;
  toUsername: string;
  tokenAmount: number;
  signature?: string; // Firma de Phantom
  signedMessage?: string; // Mensaje firmado
}

export interface TransferTokensResponse {
  from: string;
  to: string;
  tokenAmount: string;
  timestamp: string;
  transactionId: string;
}

export class ExchangeService {
  async getPrice(): Promise<PriceInfo> {
    try {
      const response = await apiClient.get<any>("/exchange/getPrice");

      if (!response.success) {
        throw new Error(response.message || "Failed to fetch price");
      }

      return {
        priceUSD: response.priceUSD,
        currencyCode: response.currencyCode || "USD",
        lastUpdated: response.lastUpdated,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Failed to fetch price",
      );
    }
  }

  async getTokenInfo(): Promise<TokenInfoResponse> {
    try {
      const response = await apiClient.get<any>("/exchange/tokenInfo");

      if (!response.success) {
        throw new Error(response.message || "Failed to fetch token info");
      }

      return {
        name: response.name,
        symbol: response.symbol,
        totalSupply: response.totalSupply,
        circulatingSupply: response.circulatingSupply,
        price: response.price,
        marketCap: response.marketCap,
        holders: response.holders,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Failed to fetch token info",
      );
    }
  }

  async buy(data: BuyTokensRequest): Promise<BuyTokensResponse> {
    try {
      const response = await apiClient.post<any>("/exchange/buyTokens", {
        amount: data.amount,
        totalPrice: data.totalPriceUSD || data.amount,
        holder: data.username,
        signature: data.signature,
        signedMessage: data.signedMessage,
      });

      console.log("📊 Respuesta del backend (buy):", response);

      if (!response.success) {
        throw new Error(response.message || "Purchase failed");
      }

      // Compatibilidad con ambas estructuras:
      // Nueva estructura: response.extra.transaction
      // Vieja estructura: response.transaction
      const transaction = response.extra?.transaction || response.transaction;

      console.log("💳 Transacción extraída:", transaction);

      if (!transaction) {
        throw new Error("No transaction data returned from server");
      }

      const result = {
        username: data.username,
        tokensPurchased: String(transaction.tokenAmount || 0),
        usdSpent: transaction.paymentAmount || 0,
        totalBalance: String(transaction.tokenAmount || 0),
        totalSpent: transaction.paymentAmount || 0,
        timestamp: transaction.createdAt || new Date().toISOString(),
        transactionId: transaction.transactionId || "",
      };

      console.log("✅ Resultado final:", result);
      return result;
    } catch (error) {
      console.error("❌ Error en buy:", error);
      throw new Error(
        error instanceof Error ? error.message : "Purchase failed",
      );
    }
  }

  async sell(data: SellTokensRequest): Promise<SellTokensResponse> {
    try {
      const response = await apiClient.post<any>("/exchange/sellTokens", {
        amount: data.tokenAmount,
        totalPrice: data.tokenAmount * 0, // Price is 0
        holder: data.username,
        signature: data.signature,
        signedMessage: data.signedMessage,
      });

      if (!response.success) {
        throw new Error(response.message || "Sale failed");
      }

      // Compatibilidad con ambas estructuras
      const transaction = response.extra?.transaction || response.transaction;

      if (!transaction) {
        throw new Error("No transaction data returned from server");
      }

      return {
        username: data.username,
        tokensSold: String(transaction.tokenAmount || 0),
        usdReceived: transaction.paymentAmount || 0,
        totalBalance: "0",
        timestamp: transaction.createdAt || new Date().toISOString(),
        transactionId: transaction.transactionId || "",
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Sale failed");
    }
  }

  async transfer(data: TransferTokensRequest): Promise<TransferTokensResponse> {
    try {
      const response = await apiClient.post<any>("/exchange/transferTokens", {
        to: data.toUsername,
        amount: data.tokenAmount,
        signature: data.signature,
        signedMessage: data.signedMessage,
      });

      if (!response.success) {
        throw new Error(response.message || "Transfer failed");
      }

      // Obtener la transacción de la respuesta
      const transaction = response.transaction;

      if (!transaction) {
        throw new Error("No transaction data returned from server");
      }

      return {
        from: data.fromUsername,
        to: data.toUsername,
        tokenAmount: String(transaction.tokenAmount || data.tokenAmount),
        timestamp: transaction.createdAt || new Date().toISOString(),
        transactionId: transaction.transactionId || "",
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Transfer failed",
      );
    }
  }

  async getBalance(username: string): Promise<BalanceInfo> {
    try {
      const response =
        await apiClient.get<ApiResponse<BalanceInfo>>(`/exchange/getBalance`);

      if (!response.success) {
        throw new Error((response as any).error || "Failed to fetch balance");
      }

      return response.data;
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Failed to fetch balance",
      );
    }
  }

  async getHistory(username: string): Promise<any[]> {
    try {
      const response =
        await apiClient.get<ApiResponse<any[]>>(`/exchange/history`);

      if (!response.success) {
        throw new Error((response as any).error || "Failed to fetch history");
      }

      // El backend devuelve transactions en response.extra.transactions
      const transactions =
        (response as any).extra?.transactions || response.data || [];

      console.log("📜 Historial cargado del backend:", {
        total: transactions.length,
        transactions: transactions.slice(0, 3), // Mostrar solo los primeros 3
      });

      return transactions;
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to fetch transaction history",
      );
    }
  }
}

export const exchangeService = new ExchangeService();
