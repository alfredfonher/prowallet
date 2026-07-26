/**
 * Configuración centralizada de la aplicación
 * Define todos los parámetros que varían entre devnet y mainnet
 */

type SolanaNetwork = "devnet" | "testnet" | "mainnet-beta";

interface SolanaConfig {
  network: SolanaNetwork;
  rpcUrl: string;
  fallbackRpcUrl?: string;
  programId: string;
  tokenMint: string;
  gasEstimate?: number;
}

interface TokenConfig {
  name: string;
  symbol: string;
  decimals: number;
  minPurchase: number;
  maxPurchase: number;
  price?: number;
}

interface ApiConfig {
  baseUrl: string;
  timeout: number;
  endpoints: {
    priceQuote: string;
    purchaseInitiate: string;
    purchaseSettle: string;
    paymentMethods: string;
    transactionHistory: string;
  };
}

interface FeatureConfig {
  freeModeEnabled: boolean;
  testModeEnabled: boolean;
}

interface AppConfig {
  api: ApiConfig;
  solana: SolanaConfig;
  token: TokenConfig;
  features: FeatureConfig;
  apiBaseUrl?: string;
}

// Determinar si estamos en devnet o mainnet
const _SOLANA_NETWORK =
  (process.env.NEXT_PUBLIC_SOLANA_NETWORK as SolanaNetwork) || "devnet";

const IS_DEVNET = _SOLANA_NETWORK === "devnet";

/**
 * Configuración centralizada
 * Cambia automáticamente basado en NEXT_PUBLIC_SOLANA_NETWORK
 */
export const APP_CONFIG: AppConfig = {
  api: {
    baseUrl:
      process.env.NEXT_PUBLIC_API_URL ||
      "https://servicioshilda.orioncaribe.com/api/v1",
    timeout: 30000,
    endpoints: {
      priceQuote: "/purchase/price",
      purchaseInitiate: "/purchase/initiate",
      purchaseSettle: "/purchase/settle",
      paymentMethods: "/purchase/payment-methods",
      transactionHistory: "/purchase/history",
    },
  },

  solana: {
    network: _SOLANA_NETWORK,
    rpcUrl:
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      (IS_DEVNET
        ? "https://api.devnet.solana.com"
        : "https://api.mainnet-beta.solana.com"),
    fallbackRpcUrl: process.env.NEXT_PUBLIC_FALLBACK_SOLANA_RPC_URL,
    programId:
      process.env.NEXT_PUBLIC_PROWALLET_PROGRAM_ID ||
      (IS_DEVNET
        ? "7sa2XazRU4R6DcsNLGMWcX4nabCzWwjj3Awfh1gxhtem"
        : "7sa2XazRU4R6DcsNLGMWcX4nabCzWwjj3Awfh1gxhtem"),
    tokenMint:
      process.env.NEXT_PUBLIC_TOKEN_MINT ||
      (IS_DEVNET
        ? "BBZ8JF3SwhKVjpUMDe1ycFxLSCpXZPWErPWNpRduYjpH"
        : "D8TwbwGGmyucrxPB9uscait27caVgeqYHPpyN3XXjUX3"),
  },

  token: {
    name:
      process.env.NEXT_PUBLIC_TOKEN_NAME ||
      (IS_DEVNET ? "ProWallet-Dev" : "ProWallet"),
    symbol:
      process.env.NEXT_PUBLIC_TOKEN_SYMBOL ||
      (IS_DEVNET ? "GAPC-TEST" : "GAPC"),
    decimals: 9,
    minPurchase: 100,
    maxPurchase: 1000000,
  },

  features: {
    freeModeEnabled: false,
    testModeEnabled: process.env.NEXT_PUBLIC_TEST_MODE_FREE_TOKEN === "true",
  },
};

/**
 * Mensajes de configuración para debugging
 */
export const getConfigStatus = (): string => {
  const status = `
═══════════════════════════════════════════════════════════════
⚙️  CONFIGURACIÓN DE PROWALLET - ${APP_CONFIG.solana.network.toUpperCase()}
═══════════════════════════════════════════════════════════════

🌐 Solana Network
  Network: ${APP_CONFIG.solana.network}
  RPC URL: ${APP_CONFIG.solana.rpcUrl}
  Token Mint: ${APP_CONFIG.solana.tokenMint}

💎 Token
  Name: ${APP_CONFIG.token.name}
  Symbol: ${APP_CONFIG.token.symbol}
  Decimals: ${APP_CONFIG.token.decimals}

🔌 API
  Base URL: ${APP_CONFIG.api.baseUrl}
  Timeout: ${APP_CONFIG.api.timeout}ms

⚡ Features
  Test Mode: ${APP_CONFIG.features.testModeEnabled ? "✅" : "❌"}
  Free Mode: ${APP_CONFIG.features.freeModeEnabled ? "✅" : "❌"}

═══════════════════════════════════════════════════════════════
  `;
  return status;
};

// Log configuración en desarrollo
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.log(getConfigStatus());
}

// Exportar constantes comúnmente usadas
export const TOKEN_MINT_ADDRESS = APP_CONFIG.solana.tokenMint;
export const TOKEN_DECIMALS = APP_CONFIG.token.decimals;
export const TOKEN_SYMBOL = APP_CONFIG.token.symbol;
export const SOLANA_NETWORK = APP_CONFIG.solana.network;
export const API_BASE_URL = APP_CONFIG.api.baseUrl;

export default APP_CONFIG;
