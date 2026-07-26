import axios from "axios";
import {
  PaymentProcessor,
  PaymentMethod,
  PaymentStatus,
  CreatePaymentParams,
  PaymentResponse,
  PaymentVerificationResult,
  WebhookResult,
  SupportedCryptoCurrency,
} from "../payment.interface";
import { loggerService } from "../../logging/logger.service";

export class CoinGateProcessor implements PaymentProcessor {
  name = "CoinGate";
  supportedCurrencies = [
    // Principales criptomonedas
    "BTC",
    "ETH",
    "LTC",
    "BCH",
    "XRP",
    "ADA",
    "DOT",
    "LINK",
    "UNI",
    "USDT",
    "USDC",
    "DAI",
    "BUSD",
    // Solana ecosystem
    "SOL",
    "SRM",
    "RAY",
    "ORCA",
    // DeFi tokens
    "SUSHI",
    "AAVE",
    "COMP",
    "MKR",
    "SNX",
    // Otras altcoins populares
    "MATIC",
    "AVAX",
    "FTM",
    "ALGO",
    "ATOM",
    "XLM",
    "TRX",
    // Fiat currencies
    "USD",
    "EUR",
    "GBP",
  ];
  supportedPaymentMethods = [PaymentMethod.CRYPTO];

  private baseUrl = "https://api.coingate.com/v2";
  private apiToken: string;

  constructor() {
    this.apiToken = process.env.COINGATE_API_TOKEN!;
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResponse> {
    try {
      const payload = {
        order_id: `tkrc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        price_amount: params.amount,
        price_currency: params.currency,
        receive_currency: "USD", // Recibir en USD para conversión estable
        title: `${params.tokenAmount} TKRC Tokens`,
        description: params.description,
        callback_url: `${process.env.API_BASE_URL}/api/v1/payments/webhook/coingate`,
        success_url:
          params.successUrl || `${process.env.FRONTEND_URL}/payment/success`,
        cancel_url:
          params.cancelUrl || `${process.env.FRONTEND_URL}/payment/cancel`,
        token: this.apiToken,
        buyer_email: params.customerEmail || undefined,
        custom: JSON.stringify({
          walletAddress: params.customerWallet,
          tokenAmount: params.tokenAmount,
          processor: "coingate",
          ...params.metadata,
        }),
      };

      const response = await axios.post(`${this.baseUrl}/orders`, payload, {
        headers: {
          Authorization: `Token ${this.apiToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const order = response.data;

      return {
        paymentId: order.id.toString(),
        paymentUrl: order.payment_url,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutos
        status: this.mapCoinGateStatus(order.status),
        metadata: {
          orderId: order.id,
          lightningNetwork: order.lightning_network,
          btcAddress: order.btc_address,
          btcAmount: order.btc_amount,
        },
      };
    } catch (error: any) {
      loggerService.logError(error, {
        context: "CoinGateProcessor.createPayment",
      });
      throw new Error(
        `Failed to create CoinGate payment: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async verifyPayment(paymentId: string): Promise<PaymentVerificationResult> {
    try {
      const response = await axios.get(`${this.baseUrl}/orders/${paymentId}`, {
        headers: {
          Authorization: `Token ${this.apiToken}`,
        },
      });

      const order = response.data;
      const customData = order.custom ? JSON.parse(order.custom) : {};

      return {
        isValid: order.status === "paid",
        status: this.mapCoinGateStatus(order.status),
        amount: order.price_amount,
        currency: order.price_currency,
        transactionHash: order.payment_hash || order.id.toString(),
        paidAt: order.paid_at ? new Date(order.paid_at) : undefined,
        metadata: {
          orderId: order.id,
          receiveCurrency: order.receive_currency,
          receiveAmount: order.receive_amount,
          paymentCurrency: order.pay_currency,
          paymentAmount: order.pay_amount,
          ...customData,
        },
      };
    } catch (error: any) {
      loggerService.logError(error, {
        context: "CoinGateProcessor.verifyPayment",
      });
      return {
        isValid: false,
        status: PaymentStatus.FAILED,
      };
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    try {
      const response = await axios.get(`${this.baseUrl}/orders/${paymentId}`, {
        headers: {
          Authorization: `Token ${this.apiToken}`,
        },
      });

      return this.mapCoinGateStatus(response.data.status);
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "CoinGateProcessor.getPaymentStatus",
      });
      return PaymentStatus.FAILED;
    }
  }

  async handleWebhook(payload: any): Promise<WebhookResult> {
    try {
      // CoinGate envía los datos directamente en el payload
      const orderId = payload.id;
      const status = payload.status;

      return {
        processed: true,
        paymentId: orderId.toString(),
        status: this.mapCoinGateStatus(status),
      };
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "CoinGateProcessor.handleWebhook",
      });
      return {
        processed: false,
        error: (error as Error).message,
      };
    }
  }

  async getSupportedCurrencies(): Promise<SupportedCryptoCurrency[]> {
    try {
      // Lista estática de las criptomonedas más populares soportadas por CoinGate
      return [
        {
          symbol: "BTC",
          name: "Bitcoin",
          decimals: 8,
          minAmount: 0.00001,
          maxAmount: 10,
        },
        {
          symbol: "ETH",
          name: "Ethereum",
          decimals: 18,
          minAmount: 0.001,
          maxAmount: 100,
        },
        {
          symbol: "SOL",
          name: "Solana",
          decimals: 9,
          minAmount: 0.01,
          maxAmount: 1000,
        },
        {
          symbol: "USDT",
          name: "Tether USD",
          network: "ERC-20",
          decimals: 6,
          minAmount: 1,
          maxAmount: 50000,
        },
        {
          symbol: "USDC",
          name: "USD Coin",
          network: "ERC-20",
          decimals: 6,
          minAmount: 1,
          maxAmount: 50000,
        },
        {
          symbol: "LTC",
          name: "Litecoin",
          decimals: 8,
          minAmount: 0.001,
          maxAmount: 500,
        },
        {
          symbol: "XRP",
          name: "Ripple",
          decimals: 6,
          minAmount: 1,
          maxAmount: 100000,
        },
        {
          symbol: "ADA",
          name: "Cardano",
          decimals: 6,
          minAmount: 1,
          maxAmount: 50000,
        },
        {
          symbol: "DOT",
          name: "Polkadot",
          decimals: 10,
          minAmount: 0.1,
          maxAmount: 5000,
        },
        {
          symbol: "MATIC",
          name: "Polygon",
          decimals: 18,
          minAmount: 1,
          maxAmount: 100000,
        },
      ];
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "CoinGateProcessor.getSupportedCurrencies",
      });
      return [];
    }
  }

  private mapCoinGateStatus(coinGateStatus: string): PaymentStatus {
    switch (coinGateStatus) {
      case "new":
      case "pending":
        return PaymentStatus.PENDING;
      case "confirming":
        return PaymentStatus.PENDING;
      case "paid":
        return PaymentStatus.CONFIRMED;
      case "invalid":
      case "canceled":
        return PaymentStatus.CANCELLED;
      case "expired":
        return PaymentStatus.EXPIRED;
      case "refunded":
        return PaymentStatus.FAILED;
      default:
        return PaymentStatus.PENDING;
    }
  }
}
