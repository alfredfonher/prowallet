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

export class DemoProcessor implements PaymentProcessor {
  name = "Demo Payment Processor";
  supportedCurrencies = [
    "USD",
    "EUR",
    "GBP",
    "CAD",
    "AUD",
    "BTC",
    "ETH",
    "LTC",
    "XRP",
    "ADA",
  ];
  supportedPaymentMethods = [
    PaymentMethod.CREDIT_CARD,
    PaymentMethod.DEBIT_CARD,
    PaymentMethod.CRYPTO,
  ];

  private payments = new Map<string, any>();

  async createPayment(params: CreatePaymentParams): Promise<PaymentResponse> {
    try {
      // Generar ID único para el pago
      const paymentId = `demo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

      // Simular URL de pago
      const paymentUrl = `https://servicioshilda.orioncaribe.com/demo-payment/${paymentId}`;

      // Almacenar pago en memoria (en producción sería en base de datos)
      this.payments.set(paymentId, {
        id: paymentId,
        amount: params.amount,
        currency: params.currency,
        status: PaymentStatus.PENDING,
        tokenAmount: params.tokenAmount,
        customerEmail: params.customerEmail,
        customerWallet: params.customerWallet,
        createdAt: new Date(),
        expiresAt,
        metadata: params.metadata,
      });

      loggerService.logInfo("Demo payment created", {
        paymentId,
        amount: params.amount,
        currency: params.currency,
        tokenAmount: params.tokenAmount,
      });

      return {
        paymentId,
        paymentUrl,
        expiresAt,
        status: PaymentStatus.PENDING,
        metadata: {
          processor: "demo",
          instructions:
            "This is a demo payment. In real mode, you would be redirected to the payment processor.",
        },
      };
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "DemoProcessor.createPayment",
      });
      throw new Error(
        `Failed to create demo payment: ${(error as Error).message}`,
      );
    }
  }

  async verifyPayment(paymentId: string): Promise<PaymentVerificationResult> {
    try {
      const payment = this.payments.get(paymentId);

      if (!payment) {
        return {
          isValid: false,
          status: PaymentStatus.FAILED,
        };
      }

      // En demo, simular que el pago se confirma después de 2 minutos
      const timeSinceCreation = Date.now() - payment.createdAt.getTime();
      const isConfirmed = timeSinceCreation > 120000; // 2 minutos

      if (isConfirmed && payment.status === PaymentStatus.PENDING) {
        payment.status = PaymentStatus.CONFIRMED;
        payment.confirmedAt = new Date();
        payment.transactionHash = `demo_tx_${Math.random().toString(36).substring(2, 15)}`;
      }

      return {
        isValid: payment.status === PaymentStatus.CONFIRMED,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        transactionHash: payment.transactionHash,
        paidAt: payment.confirmedAt,
        metadata: {
          processor: "demo",
          paymentId: payment.id,
        },
      };
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "DemoProcessor.verifyPayment",
      });
      return {
        isValid: false,
        status: PaymentStatus.FAILED,
      };
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    try {
      const payment = this.payments.get(paymentId);

      if (!payment) {
        return PaymentStatus.FAILED;
      }

      // Verificar si ha expirado
      if (new Date() > payment.expiresAt) {
        payment.status = PaymentStatus.EXPIRED;
        return PaymentStatus.EXPIRED;
      }

      // En demo, auto-confirmar después de 2 minutos
      const timeSinceCreation = Date.now() - payment.createdAt.getTime();
      if (
        timeSinceCreation > 120000 &&
        payment.status === PaymentStatus.PENDING
      ) {
        payment.status = PaymentStatus.CONFIRMED;
        payment.confirmedAt = new Date();
      }

      return payment.status;
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "DemoProcessor.getPaymentStatus",
      });
      return PaymentStatus.FAILED;
    }
  }

  async handleWebhook(
    payload: any,
    signature?: string,
  ): Promise<WebhookResult> {
    // En modo demo, simular webhook success
    return {
      processed: true,
      paymentId: payload.paymentId || "demo_payment",
      status: PaymentStatus.CONFIRMED,
    };
  }

  // Método específico para demo - simular confirmación manual
  async simulatePaymentConfirmation(paymentId: string): Promise<boolean> {
    const payment = this.payments.get(paymentId);

    if (!payment) {
      return false;
    }

    payment.status = PaymentStatus.CONFIRMED;
    payment.confirmedAt = new Date();
    payment.transactionHash = `demo_tx_${Math.random().toString(36).substring(2, 15)}`;

    loggerService.logInfo("Demo payment manually confirmed", {
      paymentId,
      transactionHash: payment.transactionHash,
    });

    return true;
  }

  // Obtener todos los pagos (para demo)
  getAllPayments() {
    return Array.from(this.payments.values());
  }

  // Método para devolver criptomonedas soportadas (específico para demo)
  async getSupportedCurrencies(): Promise<SupportedCryptoCurrency[]> {
    // Lista mock de criptomonedas para demostración
    return [
      {
        symbol: "BTC",
        name: "Bitcoin",
        decimals: 8,
        minAmount: 0.0001,
        maxAmount: 10,
        fees: { network: 0.0002, service: 0.5 },
      },
      {
        symbol: "ETH",
        name: "Ethereum",
        decimals: 18,
        minAmount: 0.001,
        maxAmount: 100,
        fees: { network: 0.002, service: 0.5 },
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        network: "TRC20",
        decimals: 6,
        minAmount: 1,
        maxAmount: 50000,
        fees: { network: 1, service: 0.5 },
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        network: "ERC20",
        decimals: 6,
        minAmount: 1,
        maxAmount: 50000,
        fees: { network: 5, service: 0.5 },
      },
      {
        symbol: "BNB",
        name: "Binance Coin",
        network: "BSC",
        decimals: 18,
        minAmount: 0.01,
        maxAmount: 500,
        fees: { network: 0.001, service: 0.5 },
      },
      {
        symbol: "ADA",
        name: "Cardano",
        decimals: 6,
        minAmount: 1,
        maxAmount: 10000,
        fees: { network: 0.17, service: 0.5 },
      },
      {
        symbol: "DOT",
        name: "Polkadot",
        decimals: 10,
        minAmount: 0.1,
        maxAmount: 1000,
        fees: { network: 0.01, service: 0.5 },
      },
      {
        symbol: "MATIC",
        name: "Polygon",
        network: "MATIC",
        decimals: 18,
        minAmount: 1,
        maxAmount: 10000,
        fees: { network: 0.001, service: 0.5 },
      },
      {
        symbol: "LTC",
        name: "Litecoin",
        decimals: 8,
        minAmount: 0.001,
        maxAmount: 100,
        fees: { network: 0.001, service: 0.5 },
      },
      {
        symbol: "LINK",
        name: "Chainlink",
        network: "ERC20",
        decimals: 18,
        minAmount: 0.1,
        maxAmount: 1000,
        fees: { network: 5, service: 0.5 },
      },
    ];
  }
}
