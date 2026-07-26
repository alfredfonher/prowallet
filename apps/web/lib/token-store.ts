export interface TokenInfo {
  name: string;
  symbol: string;
  price?: number; // Precio del token en USD
  solPriceUsd?: number; // Precio del SOL en USD (para mostrar conversión)
  totalSupply: number;
  circulatingSupply: number;
  holders: Record<string, number>;
  // Metadata de caché
  lastUpdated?: number; // timestamp ms
  isStale?: boolean;
}

export interface Transaction {
  id: string;
  type: "BUY" | "SELL" | "TRANSFER";
  holder: string;
  holderTo?: string;
  tokenAmount: number;
  fiatAmount?: number;
  timestamp: Date;
}

export const initialTokenInfo: TokenInfo = {
  name: "",
  symbol: "",
  // No establecer valores numéricos por defecto aquí para evitar mostrar
  // información engañosa. La UI debe mostrar un estado de carga cuando
  // estos valores aún no estén disponibles.
  totalSupply: 0,
  circulatingSupply: 0,
  holders: {},
};

export const initialTransactions: Transaction[] = [];

export function generateId(): string {
  return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatNumber(num: number, decimals?: number): string {
  // Por defecto, mostrar 9 decimales para tokens (GAPC tiene 9 decimales)
  const decimalPlaces = decimals ?? 9;

  return new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimalPlaces,
  }).format(num);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
