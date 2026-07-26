import axios from "axios";
import { loggerService } from "../logging/logger.service";
import {
  CreatePaymentParams,
  ExchangeRates,
  PaymentMethod,
  PaymentProcessor,
  PaymentResponse,
  PaymentStatus,
  PaymentVerificationResult,
  SupportedCryptoCurrency,
  WebhookResult,
} from "./payment.interface";
import { CoinGateProcessor } from "./processors/coingate.processor";
import { NOWPaymentsProcessor } from "./processors/nowpayments.processor";
import { SolanaProcessor } from "./processors/solana.processor";
import { StripeProcessor } from "./processors/stripe.processor";

export class PaymentService {
  private processors: Map<string, PaymentProcessor> = new Map();
  private exchangeRates: ExchangeRates = {};
  private ratesLastUpdated: Date | null = null;

  // Estructura para métodos de pago disponibles
  private availablePaymentMethods = {
    card: {
      available: false,
      processors: [] as string[],
      currencies: ["USD", "EUR"],
    },
    crypto: {
      available: false,
      processors: [] as string[],
      currencies: [] as Array<{
        symbol: string;
        name: string;
        decimals: number;
        minAmount: number;
        maxAmount: number;
      }>,
      allCurrencies: 0,
    },
    native: {
      solana: {
        available: true,
        currencies: ["SOL", "USDC"],
      },
    },
  };

  // Métodos de pago disponibles por defecto
  private defaultPaymentMethods = {
    card: {
      available: false,
      processors: [] as string[],
      currencies: ["USD", "EUR"],
    },
    crypto: {
      available: false,
      processors: [] as string[],
      currencies: [] as Array<{
        symbol: string;
        name: string;
        decimals: number;
        minAmount: number;
        maxAmount: number;
      }>,
      allCurrencies: 0,
    },
    native: {
      solana: {
        available: true,
        currencies: ["SOL", "USDC"],
      },
    },
  };

  constructor() {
    this.initializeProcessors();
    this.updateExchangeRates();

    // Actualizar tasas de cambio cada 5 minutos
    setInterval(
      () => {
        this.updateExchangeRates();
      },
      5 * 60 * 1000,
    );
  }

  private initializeProcessors() {
    try {
      // Inicializar procesador real de Solana (lazy - no contactar al iniciar)
      try {
        this.processors.set("solana", new SolanaProcessor());
        loggerService.logInfo("Solana processor initialized");
      } catch (solanaError) {
        loggerService.logInfo(
          "Solana processor failed to initialize: " +
            (solanaError as Error).message,
          {
            context: "PaymentService.initializeProcessors.solana",
          },
        );
        // Continuar sin Solana, no bloquear el servidor
      }

      // Inicializar procesadores reales si están configurados
      if (
        process.env.STRIPE_SECRET_KEY &&
        process.env.STRIPE_WEBHOOK_SECRET &&
        process.env.STRIPE_SECRET_KEY !== "sk_test_51234567890abcdef"
      ) {
        this.processors.set("stripe", new StripeProcessor());
        loggerService.logInfo("Stripe processor initialized");
      }

      if (
        process.env.COINGATE_API_TOKEN &&
        process.env.COINGATE_API_TOKEN !== "YOUR_REAL_TOKEN_HERE"
      ) {
        this.processors.set("coingate", new CoinGateProcessor());
        loggerService.logInfo("CoinGate processor initialized");
      }

      if (
        process.env.NOWPAYMENTS_API_KEY &&
        process.env.NOWPAYMENTS_API_KEY !== "YOUR_REAL_KEY_HERE"
      ) {
        this.processors.set("nowpayments", new NOWPaymentsProcessor());
        loggerService.logInfo("NOWPayments processor initialized");
      }

      if (this.processors.size === 1) {
        loggerService.logInfo(
          "Only demo processor active. Configure real API keys to enable other payment methods.",
        );
      }
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "PaymentService.initializeProcessors",
      });
    }
  }

  async createPayment(
    processorName: string,
    params: CreatePaymentParams,
  ): Promise<PaymentResponse> {
    const processor = this.processors.get(processorName);
    if (!processor) {
      throw new Error(
        `Payment processor '${processorName}' not found or not configured`,
      );
    }

    // Validar moneda soportada
    if (!processor.supportedCurrencies.includes(params.currency)) {
      throw new Error(
        `Currency '${params.currency}' not supported by ${processorName}`,
      );
    }

    try {
      return await processor.createPayment(params);
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "PaymentService.createPayment",
        processorName,
        currency: params.currency,
      });
      throw error;
    }
  }

  async verifyPayment(
    processorName: string,
    paymentId: string,
  ): Promise<PaymentVerificationResult> {
    const processor = this.processors.get(processorName);
    if (!processor) {
      throw new Error(`Payment processor '${processorName}' not found`);
    }

    try {
      return await processor.verifyPayment(paymentId);
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "PaymentService.verifyPayment",
        processorName,
        paymentId,
      });
      throw error;
    }
  }

  async getPaymentStatus(
    processorName: string,
    paymentId: string,
  ): Promise<PaymentStatus> {
    const processor = this.processors.get(processorName);
    if (!processor) {
      throw new Error(`Payment processor '${processorName}' not found`);
    }

    try {
      return await processor.getPaymentStatus(paymentId);
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "PaymentService.getPaymentStatus",
        processorName,
        paymentId,
      });
      return PaymentStatus.FAILED;
    }
  }

  async handleWebhook(
    processorName: string,
    payload: any,
    signature?: string,
  ): Promise<WebhookResult> {
    const processor = this.processors.get(processorName);
    if (!processor) {
      throw new Error(`Payment processor '${processorName}' not found`);
    }

    try {
      return await processor.handleWebhook(payload, signature);
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "PaymentService.handleWebhook",
      });
      throw error;
    }
  }

  // Obtener métodos de pago disponibles
  async getAvailablePaymentMethods(): Promise<{
    card: {
      available: boolean;
      processors: string[];
      currencies: string[];
    };
    crypto: {
      available: boolean;
      processors: string[];
      currencies: Array<{
        symbol: string;
        name: string;
        decimals: number;
        minAmount: number;
        maxAmount: number;
      }>;
      allCurrencies: number;
    };
    native: {
      solana: {
        available: boolean;
        currencies: string[];
      };
    };
  }> {
    const methods: {
      card: {
        available: boolean;
        processors: string[];
        currencies: string[];
      };
      crypto: {
        available: boolean;
        processors: string[];
        currencies: Array<{
          symbol: string;
          name: string;
          decimals: number;
          minAmount: number;
          maxAmount: number;
        }>;
        allCurrencies: number;
      };
      native: { solana: { available: boolean; currencies: string[] } };
    } = {
      card: {
        available: false,
        processors: [],
        currencies: ["USD", "EUR"],
      },
      crypto: {
        available: false,
        processors: [],
        currencies: [],
        allCurrencies: 0,
      },
      native: {
        solana: {
          available: true,
          currencies: ["SOL", "USDC"],
        },
      },
    };

    // Verificar procesadores disponibles
    for (const [name, processor] of this.processors.entries()) {
      if (
        typeof processor.supportsCardPayments === "function" &&
        processor.supportsCardPayments()
      ) {
        methods.card.available = true;
        methods.card.processors.push(name as string);
      }

      if (
        typeof processor.supportsCryptoPayments === "function" &&
        processor.supportsCryptoPayments()
      ) {
        methods.crypto.available = true;
        methods.crypto.processors.push(name as string);

        // Obtener criptomonedas soportadas
        if (typeof processor.getSupportedCryptoCurrencies === "function") {
          try {
            const currencies = await processor.getSupportedCryptoCurrencies();
            if (Array.isArray(currencies) && currencies.length > 0) {
              methods.crypto.currencies.push(...(currencies as any));
              methods.crypto.allCurrencies = methods.crypto.currencies.length;
            }
          } catch (error) {
            loggerService.logError(error as Error, {
              context: "getAvailablePaymentMethods",
              processor: name,
            });
          }
        }
      }
    }

    return methods;
  }

  getAvailableProcessors(): Array<{
    name: string;
    methods: PaymentMethod[];
    currencies: string[];
  }> {
    return Array.from(this.processors.values()).map((processor) => ({
      name: processor.name,
      methods: processor.supportedPaymentMethods,
      currencies: processor.supportedCurrencies,
    }));
  }

  async getSupportedCryptoCurrencies(): Promise<SupportedCryptoCurrency[]> {
    const allCurrencies: SupportedCryptoCurrency[] = [];

    for (const [name, processor] of this.processors) {
      if (processor.supportedPaymentMethods.includes(PaymentMethod.CRYPTO)) {
        try {
          if (typeof processor.getSupportedCryptoCurrencies === "function") {
            const currencies = await processor.getSupportedCryptoCurrencies();
            if (Array.isArray(currencies) && currencies.length > 0) {
              allCurrencies.push(...currencies);
            }
          }
        } catch (error) {
          loggerService.logError(error as Error, {
            context: "PaymentService.getSupportedCryptoCurrencies",
            processor: name,
          });
        }
      }
    }

    // Eliminar duplicados por símbolo
    const uniqueCurrencies = allCurrencies.reduce((acc, curr) => {
      const existing = acc.find((c) => c.symbol === curr.symbol);
      if (!existing) {
        acc.push(curr);
      }
      return acc;
    }, [] as SupportedCryptoCurrency[]);

    return uniqueCurrencies.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  async updateExchangeRates(): Promise<void> {
    try {
      // Usar CoinGecko API para obtener tasas de cambio
      const response = await axios.get(
        "https://api.coingecko.com/api/v3/simple/price",
        {
          params: {
            ids: "bitcoin,ethereum,solana,cardano,polkadot,chainlink,uniswap,litecoin,ripple,polygon",
            vs_currencies: "usd,eur,gbp",
          },
        },
      );

      // Mapear respuesta a formato estándar
      const rates: ExchangeRates = {
        BTC: response.data.bitcoin?.usd || 0,
        ETH: response.data.ethereum?.usd || 0,
        SOL: response.data.solana?.usd || 0,
        ADA: response.data.cardano?.usd || 0,
        DOT: response.data.polkadot?.usd || 0,
        LINK: response.data.chainlink?.usd || 0,
        UNI: response.data.uniswap?.usd || 0,
        LTC: response.data.litecoin?.usd || 0,
        XRP: response.data.ripple?.usd || 0,
        MATIC: response.data.polygon?.usd || 0,
        USD: 1,
        EUR: response.data.bitcoin?.eur
          ? response.data.bitcoin.eur / response.data.bitcoin.usd
          : 0.85,
        GBP: response.data.bitcoin?.gbp
          ? response.data.bitcoin.gbp / response.data.bitcoin.usd
          : 0.73,
      };

      this.exchangeRates = rates;
      this.ratesLastUpdated = new Date();

      loggerService.logInfo("Exchange rates updated successfully");
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "PaymentService.updateExchangeRates",
      });

      // Fallback rates si falla la actualización
      if (Object.keys(this.exchangeRates).length === 0) {
        this.exchangeRates = {
          BTC: 43000,
          ETH: 2300,
          SOL: 60,
          USD: 1,
          EUR: 0.85,
          GBP: 0.73,
        };
      }
    }
  }

  getExchangeRate(currency: string): number {
    return this.exchangeRates[currency.toUpperCase()] || 0;
  }

  getAllExchangeRates(): ExchangeRates {
    return { ...this.exchangeRates };
  }

  convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): number {
    const fromRate = this.getExchangeRate(fromCurrency);
    const toRate = this.getExchangeRate(toCurrency);

    if (fromRate === 0 || toRate === 0) {
      throw new Error(
        `Exchange rate not available for ${fromCurrency} or ${toCurrency}`,
      );
    }

    // Convertir a USD primero, luego a la moneda destino
    const usdAmount = amount / fromRate;
    return usdAmount * toRate;
  }

  getRecommendedProcessor(
    currency: string,
    paymentMethod: PaymentMethod,
    amount?: number,
  ): string | null {
    const availableProcessors = Array.from(this.processors.entries()).filter(
      ([_, processor]) =>
        processor.supportedCurrencies.includes(currency) &&
        processor.supportedPaymentMethods.includes(paymentMethod),
    );

    if (availableProcessors.length === 0) {
      return null;
    }

    // Lógica de recomendación
    if (
      paymentMethod === PaymentMethod.CREDIT_CARD ||
      paymentMethod === PaymentMethod.DEBIT_CARD
    ) {
      // Preferir Stripe para tarjetas
      const stripe = availableProcessors.find(([name]) => name === "stripe");
      return stripe ? stripe[0] : availableProcessors[0][0];
    }

    if (paymentMethod === PaymentMethod.CRYPTO) {
      // Para cripto, preferir NOWPayments por la variedad, luego CoinGate
      const nowpayments = availableProcessors.find(
        ([name]) => name === "nowpayments",
      );
      if (nowpayments) return nowpayments[0];

      const coingate = availableProcessors.find(
        ([name]) => name === "coingate",
      );
      if (coingate) return coingate[0];
    }

    return availableProcessors[0][0];
  }

  getServiceStatus() {
    return {
      processorsAvailable: this.processors.size,
      processors: Array.from(this.processors.keys()),
      exchangeRatesLastUpdated: this.ratesLastUpdated,
      totalSupportedCurrencies: new Set([
        ...Array.from(this.processors.values()).flatMap(
          (p) => p.supportedCurrencies,
        ),
      ]).size,
    };
  }
}

// Singleton instance
export const paymentService = new PaymentService();
