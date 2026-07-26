export interface PaymentProcessor {
  name: string;
  supportedCurrencies: string[];
  supportedPaymentMethods: PaymentMethod[];

  createPayment(params: CreatePaymentParams): Promise<PaymentResponse>;
  verifyPayment(paymentId: string): Promise<PaymentVerificationResult>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
  handleWebhook(payload: any, signature?: string): Promise<WebhookResult>;
  supportsCardPayments?(): boolean;
  supportsCryptoPayments?(): boolean;
  getSupportedCryptoCurrencies?(): Promise<SupportedCryptoCurrency[]>;
}

export enum PaymentMethod {
  CRYPTO = "crypto",
  CREDIT_CARD = "credit_card",
  DEBIT_CARD = "debit_card",
  BANK_TRANSFER = "bank_transfer",
  MOBILE_PAYMENT = "mobile_payment",
}

export enum PaymentStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  FAILED = "failed",
  EXPIRED = "expired",
  CANCELLED = "cancelled",
}

export interface CreatePaymentParams {
  amount: number;
  currency: string;
  description: string;
  customerEmail?: string;
  customerWallet?: string;
  tokenAmount: number;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, any>;
  paymentMethod?: PaymentMethod; // ✅ Agregado
  requestId?: string; // ✅ Agregado
}

export interface PaymentResponse {
  paymentId: string;
  paymentUrl?: string;
  qrCode?: string;
  walletAddress?: string;
  expiresAt: Date;
  status: PaymentStatus;
  metadata?: Record<string, any>;
}

export interface PaymentVerificationResult {
  isValid: boolean;
  status: PaymentStatus;
  amount?: number;
  currency?: string;
  transactionHash?: string;
  paidAt?: Date;
  metadata?: Record<string, any>;
}

export interface WebhookResult {
  processed: boolean;
  paymentId?: string;
  status?: PaymentStatus;
  error?: string;
}

export interface SupportedCryptoCurrency {
  symbol: string;
  name: string;
  network?: string;
  contractAddress?: string;
  decimals: number;
  minAmount?: number;
  maxAmount?: number;
  fees?: {
    network: number;
    service: number;
  };
}

export interface ExchangeRates {
  [currency: string]: number;
}

export interface PaymentStatusResult {
  status: PaymentStatus;
  paymentStatus?: string | PaymentStatus;
  processor?: string;
  processorPaymentId?: string;
  completedAt?: Date | null;
  verification?: PaymentVerificationResult | null;
}
