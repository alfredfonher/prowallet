import Stripe from "stripe";
import {
  PaymentProcessor,
  PaymentMethod,
  PaymentStatus,
  CreatePaymentParams,
  PaymentResponse,
  PaymentVerificationResult,
  WebhookResult,
} from "../payment.interface";
import { loggerService } from "../../logging/logger.service";

export class StripeProcessor implements PaymentProcessor {
  name = "Stripe";
  supportedCurrencies = ["USD", "EUR", "GBP", "CAD", "AUD"];
  supportedPaymentMethods = [
    PaymentMethod.CREDIT_CARD,
    PaymentMethod.DEBIT_CARD,
  ];

  private stripe: Stripe;
  private webhookSecret: string;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResponse> {
    try {
      // Crear cliente si se proporciona email
      let customer;
      if (params.customerEmail) {
        customer = await this.stripe.customers.create({
          email: params.customerEmail,
          metadata: {
            walletAddress: params.customerWallet || "",
            tokenAmount: params.tokenAmount.toString(),
          },
        });
      }

      // Crear sesión de pago
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        customer: customer?.id,
        line_items: [
          {
            price_data: {
              currency: params.currency.toLowerCase(),
              product_data: {
                name: `${params.tokenAmount} TKRC Tokens`,
                description: params.description,
                metadata: {
                  tokenAmount: params.tokenAmount.toString(),
                  walletAddress: params.customerWallet || "",
                },
              },
              unit_amount: Math.round(params.amount * 100), // Stripe usa centavos
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url:
          params.successUrl ||
          `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:
          params.cancelUrl || `${process.env.FRONTEND_URL}/payment/cancel`,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutos
        metadata: {
          ...params.metadata,
          tokenAmount: params.tokenAmount.toString(),
          walletAddress: params.customerWallet || "",
          processor: "stripe",
        },
      });

      return {
        paymentId: session.id,
        paymentUrl: session.url || "",
        expiresAt: new Date(session.expires_at * 1000),
        status: PaymentStatus.PENDING,
        metadata: {
          sessionId: session.id,
          customerId: customer?.id,
        },
      };
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "StripeProcessor.createPayment",
      });
      throw new Error(
        `Failed to create Stripe payment: ${(error as Error).message}`,
      );
    }
  }

  async verifyPayment(paymentId: string): Promise<PaymentVerificationResult> {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(paymentId, {
        expand: ["payment_intent"],
      });

      const paymentIntent = session.payment_intent as Stripe.PaymentIntent;

      return {
        isValid: session.payment_status === "paid",
        status: this.mapStripeStatus(session.payment_status),
        amount: session.amount_total ? session.amount_total / 100 : 0,
        currency: session.currency?.toUpperCase(),
        transactionHash: paymentIntent?.id,
        paidAt: paymentIntent?.created
          ? new Date(paymentIntent.created * 1000)
          : undefined,
        metadata: {
          sessionId: session.id,
          customerId: session.customer,
          paymentIntentId: paymentIntent?.id,
        },
      };
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "StripeProcessor.verifyPayment",
      });
      return {
        isValid: false,
        status: PaymentStatus.FAILED,
      };
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(paymentId);
      return this.mapStripeStatus(session.payment_status);
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "StripeProcessor.getPaymentStatus",
      });
      return PaymentStatus.FAILED;
    }
  }

  async handleWebhook(
    payload: any,
    signature?: string,
  ): Promise<WebhookResult> {
    try {
      if (!signature) {
        throw new Error("Webhook signature is required");
      }

      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret,
      );

      switch (event.type) {
        case "checkout.session.completed":
          const session = event.data.object as Stripe.Checkout.Session;
          return {
            processed: true,
            paymentId: session.id,
            status: PaymentStatus.CONFIRMED,
          };

        case "checkout.session.expired":
          const expiredSession = event.data.object as Stripe.Checkout.Session;
          return {
            processed: true,
            paymentId: expiredSession.id,
            status: PaymentStatus.EXPIRED,
          };

        case "payment_intent.payment_failed":
          const failedIntent = event.data.object as Stripe.PaymentIntent;
          return {
            processed: true,
            paymentId: failedIntent.id,
            status: PaymentStatus.FAILED,
          };

        default:
          return { processed: false };
      }
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "StripeProcessor.handleWebhook",
      });
      return {
        processed: false,
        error: (error as Error).message,
      };
    }
  }

  private mapStripeStatus(stripeStatus: string): PaymentStatus {
    switch (stripeStatus) {
      case "paid":
        return PaymentStatus.CONFIRMED;
      case "unpaid":
        return PaymentStatus.PENDING;
      case "no_payment_required":
        return PaymentStatus.CONFIRMED;
      default:
        return PaymentStatus.PENDING;
    }
  }
}
