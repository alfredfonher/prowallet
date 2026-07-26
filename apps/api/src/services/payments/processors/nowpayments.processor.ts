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

export class NOWPaymentsProcessor implements PaymentProcessor {
  name = "NOWPayments";
  supportedCurrencies: string[] = [];
  supportedPaymentMethods = [PaymentMethod.CRYPTO];

  private baseUrl = "https://api.nowpayments.io/v1";
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.NOWPAYMENTS_API_KEY!;
    this.initializeSupportedCurrencies();
  }

  private async initializeSupportedCurrencies() {
    try {
      const currencies = await this.fetchSupportedCurrencies();
      this.supportedCurrencies = currencies.map((c) => c.symbol);
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "NOWPaymentsProcessor.initializeSupportedCurrencies",
      });
      // Fallback con las más populares
      this.supportedCurrencies = [
        "BTC",
        "ETH",
        "SOL",
        "USDT",
        "USDC",
        "LTC",
        "XRP",
        "ADA",
        "DOT",
        "MATIC",
        "AVAX",
        "LINK",
        "UNI",
        "ATOM",
        "XLM",
        "FTM",
        "ALGO",
        "TRX",
        "NEAR",
        "ICP",
      ];
    }
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResponse> {
    try {
      // Primero crear la orden
      const orderPayload = {
        price_amount: params.amount,
        price_currency: "USD", // Precio fijo en USD
        pay_currency: params.currency,
        order_id: `tkrc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        order_description: params.description,
        ipn_callback_url: `${process.env.API_BASE_URL}/api/v1/payments/webhook/nowpayments`,
        success_url:
          params.successUrl || `${process.env.FRONTEND_URL}/payment/success`,
        cancel_url:
          params.cancelUrl || `${process.env.FRONTEND_URL}/payment/cancel`,
        customer_email: params.customerEmail || undefined,
        custom_data: JSON.stringify({
          walletAddress: params.customerWallet,
          tokenAmount: params.tokenAmount,
          processor: "nowpayments",
          ...params.metadata,
        }),
      };

      const response = await axios.post(
        `${this.baseUrl}/payment`,
        orderPayload,
        {
          headers: {
            "x-api-key": this.apiKey,
            "Content-Type": "application/json",
          },
        },
      );

      const payment = response.data;

      return {
        paymentId: payment.payment_id,
        paymentUrl:
          payment.invoice_url ||
          `${process.env.FRONTEND_URL}/payment/crypto/${payment.payment_id}`,
        walletAddress: payment.pay_address,
        qrCode: payment.qr_code_url,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
        status: this.mapNOWPaymentsStatus(payment.payment_status),
        metadata: {
          paymentId: payment.payment_id,
          orderId: payment.order_id,
          payAddress: payment.pay_address,
          payAmount: payment.pay_amount,
          payCurrency: payment.pay_currency,
          networkFee: payment.network_fee,
          amountReceived: payment.amount_received,
        },
      };
    } catch (error: any) {
      loggerService.logError(error, {
        context: "NOWPaymentsProcessor.createPayment",
      });
      throw new Error(
        `Failed to create NOWPayments payment: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async verifyPayment(paymentId: string): Promise<PaymentVerificationResult> {
    try {
      const response = await axios.get(`${this.baseUrl}/payment/${paymentId}`, {
        headers: {
          "x-api-key": this.apiKey,
        },
      });

      const payment = response.data;
      const customData = payment.custom_data
        ? JSON.parse(payment.custom_data)
        : {};

      return {
        isValid: payment.payment_status === "finished",
        status: this.mapNOWPaymentsStatus(payment.payment_status),
        amount: payment.price_amount,
        currency: payment.price_currency,
        transactionHash: payment.outcome_hash || payment.payment_id,
        paidAt: payment.updated_at ? new Date(payment.updated_at) : undefined,
        metadata: {
          paymentId: payment.payment_id,
          orderId: payment.order_id,
          payAmount: payment.pay_amount,
          payCurrency: payment.pay_currency,
          actuallyPaid: payment.actually_paid,
          outcomeAmount: payment.outcome_amount,
          outcomeCurrency: payment.outcome_currency,
          ...customData,
        },
      };
    } catch (error: any) {
      loggerService.logError(error, {
        context: "NOWPaymentsProcessor.verifyPayment",
      });
      return {
        isValid: false,
        status: PaymentStatus.FAILED,
      };
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    try {
      const response = await axios.get(`${this.baseUrl}/payment/${paymentId}`, {
        headers: {
          "x-api-key": this.apiKey,
        },
      });

      return this.mapNOWPaymentsStatus(response.data.payment_status);
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "NOWPaymentsProcessor.getPaymentStatus",
      });
      return PaymentStatus.FAILED;
    }
  }

  async handleWebhook(payload: any): Promise<WebhookResult> {
    try {
      // NOWPayments envía datos del pago en el webhook
      const paymentId = payload.payment_id;
      const status = payload.payment_status;

      return {
        processed: true,
        paymentId: paymentId,
        status: this.mapNOWPaymentsStatus(status),
      };
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "NOWPaymentsProcessor.handleWebhook",
      });
      return {
        processed: false,
        error: (error as Error).message,
      };
    }
  }

  async fetchSupportedCurrencies(): Promise<SupportedCryptoCurrency[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/currencies`, {
        headers: {
          "x-api-key": this.apiKey,
        },
      });

      return response.data.currencies.map((currency: any) => ({
        symbol: currency.code.toUpperCase(),
        name: currency.name,
        network: currency.network || undefined,
        decimals: currency.precision || 8,
        minAmount: currency.min_amount || 0.001,
        maxAmount: currency.max_amount || 1000000,
      }));
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "NOWPaymentsProcessor.fetchSupportedCurrencies",
      });

      // Fallback con monedas populares
      return [
        { symbol: "BTC", name: "Bitcoin", decimals: 8, minAmount: 0.00001 },
        { symbol: "ETH", name: "Ethereum", decimals: 18, minAmount: 0.001 },
        { symbol: "SOL", name: "Solana", decimals: 9, minAmount: 0.01 },
        {
          symbol: "USDT",
          name: "Tether USD",
          network: "ERC-20",
          decimals: 6,
          minAmount: 1,
        },
        {
          symbol: "USDC",
          name: "USD Coin",
          network: "ERC-20",
          decimals: 6,
          minAmount: 1,
        },
        { symbol: "LTC", name: "Litecoin", decimals: 8, minAmount: 0.001 },
        { symbol: "XRP", name: "Ripple", decimals: 6, minAmount: 1 },
        { symbol: "ADA", name: "Cardano", decimals: 6, minAmount: 1 },
        { symbol: "DOT", name: "Polkadot", decimals: 10, minAmount: 0.1 },
        { symbol: "MATIC", name: "Polygon", decimals: 18, minAmount: 1 },
        { symbol: "AVAX", name: "Avalanche", decimals: 18, minAmount: 0.01 },
        { symbol: "LINK", name: "Chainlink", decimals: 18, minAmount: 0.1 },
        { symbol: "UNI", name: "Uniswap", decimals: 18, minAmount: 0.1 },
        { symbol: "ATOM", name: "Cosmos", decimals: 6, minAmount: 0.1 },
        { symbol: "XLM", name: "Stellar", decimals: 7, minAmount: 1 },
        { symbol: "TRX", name: "Tron", decimals: 6, minAmount: 1 },
        { symbol: "ALGO", name: "Algorand", decimals: 6, minAmount: 1 },
        { symbol: "FTM", name: "Fantom", decimals: 18, minAmount: 1 },
        { symbol: "NEAR", name: "NEAR Protocol", decimals: 24, minAmount: 0.1 },
        {
          symbol: "ICP",
          name: "Internet Computer",
          decimals: 8,
          minAmount: 0.01,
        },
      ];
    }
  }

  async getEstimate(
    amount: number,
    fromCurrency: string,
    toCurrency: string = "USD",
  ): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/estimate`, {
        params: {
          amount: amount,
          currency_from: fromCurrency,
          currency_to: toCurrency,
        },
        headers: {
          "x-api-key": this.apiKey,
        },
      });

      return response.data;
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "NOWPaymentsProcessor.getEstimate",
      });
      throw error;
    }
  }

  private mapNOWPaymentsStatus(nowPaymentsStatus: string): PaymentStatus {
    switch (nowPaymentsStatus) {
      case "waiting":
      case "confirming":
        return PaymentStatus.PENDING;
      case "confirmed":
      case "sending":
      case "finished":
        return PaymentStatus.CONFIRMED;
      case "failed":
      case "refunded":
        return PaymentStatus.FAILED;
      case "expired":
        return PaymentStatus.EXPIRED;
      default:
        return PaymentStatus.PENDING;
    }
  }
}
