/**
 * Tipos estrictos para el flujo de compra
 */

export interface WalletConnectionState {
  isConnected: boolean;
  publicKey: string | null;
  walletName: string | null;
}

export interface SolanaBalanceInfo {
  lamports: number;
  sol: number;
  isSufficient: boolean;
  requiredSol: number;
}

export interface PurchaseRequest {
  tokenAmount: number;
  paymentMethod: string;
  maxSlippage: number;
  walletAddress: string;
}

export interface PurchaseParams {
  tokenAmount: number;
  paymentMethod?: string;
  maxSlippage?: number;
}

export interface PurchaseInitiateResponse {
  success: boolean;
  data?: {
    transactionId: string;
    txBase64: string;
    estimatedFee: number;
    totalCost: number;
  };
  error?: string;
}

export interface PurchaseSettleResponse {
  success: boolean;
  data?: {
    confirmed: boolean;
    signature: string;
    blockSlot: number;
  };
  error?: string;
}

export interface TransactionConfirmation {
  signature: string;
  blockSlot?: number;
  confirmed: boolean;
  error?: string;
}

export interface PurchaseState {
  isLoading: boolean;
  error: string | null;
  success: boolean;
  transactionSignature: string | null;
  currentStep: PurchaseStep;
}

export enum PurchaseStep {
  IDLE = "idle",
  VALIDATING_WALLET = "validating_wallet",
  VALIDATING_BALANCE = "validating_balance",
  INITIATING_TRANSACTION = "initiating_transaction",
  SIGNING_TRANSACTION = "signing_transaction",
  SENDING_TRANSACTION = "sending_transaction",
  CONFIRMING_TRANSACTION = "confirming_transaction",
  SETTLING_PURCHASE = "settling_purchase",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface PriceQuoteRequest {
  tokenAmount: number;
  currency?: string;
}

export interface PriceQuoteResponse {
  success: boolean;
  data?: {
    price: number;
    solPrice: number;
    totalCost: number;
  };
  error?: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  enabled: boolean;
  fees?: number;
}

export interface TransactionHistoryItem {
  id: string;
  signature: string;
  amount: number;
  timestamp: number;
  status: "pending" | "confirmed" | "failed";
  type: "purchase" | "sale" | "transfer";
}

export interface PurchaseHistoryResponse {
  transactions: TransactionHistoryItem[];
  totalCount: number;
  hasMore: boolean;
}

// Error types
export class PurchaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly step?: PurchaseStep,
  ) {
    super(message);
    this.name = "PurchaseError";
  }
}

export class WalletError extends PurchaseError {
  constructor(message: string, code: string) {
    super(message, code, PurchaseStep.VALIDATING_WALLET);
    this.name = "WalletError";
  }
}

export class BalanceError extends PurchaseError {
  constructor(message: string, code: string) {
    super(message, code, PurchaseStep.VALIDATING_BALANCE);
    this.name = "BalanceError";
  }
}

export class TransactionError extends PurchaseError {
  constructor(message: string, code: string, step: PurchaseStep) {
    super(message, code, step);
    this.name = "TransactionError";
  }
}
