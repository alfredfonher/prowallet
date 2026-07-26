export interface PaymentMethod {
  name: string;
  displayName: string;
  type: "crypto" | "card" | "native";
  icon?: string;
  status: "active" | "disabled" | "maintenance";
  processingTime?: string;
  limits?: {
    min: number;
    max: number;
    currency: string;
  };
  processor: string;
  currencies: string[];
}

export interface SupportedCryptoCurrency {
  symbol: string;
  name: string;
  decimals: number;
  minAmount: number;
  maxAmount: number;
  network?: string;
  icon?: string;
  processingTime?: string;
  exchangeRate?: number;
}

export interface PaymentMethodsResponse {
  card: {
    available: boolean;
    processors: string[];
    currencies: string[];
  };
  crypto: {
    available: boolean;
    processors: string[];
    currencies: SupportedCryptoCurrency[];
    allCurrencies: number;
  };
  native: {
    solana: {
      available: boolean;
      currencies: string[];
    };
  };
}
