/**
 * Environment Configuration
 *
 * ⭐ REFACTORED: Usa variable explícita NEXT_PUBLIC_ENVIRONMENT en lugar de auto-detección
 * Auto-detección causaba bugs donde localhost terminaba conectando a producción
 *
 * Preferencia de detección:
 * 1. NEXT_PUBLIC_ENVIRONMENT (explícito, recomendado)
 * 2. Hostname detection (fallback)
 * 3. Production (safe default)
 */

export type EnvironmentType = "local" | "production";

interface EnvironmentConfig {
  environment: EnvironmentType;
  apiUrl: string;
  isDevelopment: boolean;
  isProduction: boolean;
  solanaNetwork: "devnet" | "testnet" | "mainnet-beta";
  solanaRpcUrl: string;
  solanaFallbackRpcUrl: string;
  heliusApiKey: string;
  prowalletProgramId: string;
  tokenMint: string;
  tokenName: string;
  tokenSymbol: string;
  testModeFreeToken: boolean;
}

/**
 * Obtiene el tipo de entorno
 * Preferencia: variable explícita > hostname detection > production
 */
function getEnvironmentType(): EnvironmentType {
  // ✅ Opción 1: Variable explícita (RECOMENDADO)
  const envVar = process.env.NEXT_PUBLIC_ENVIRONMENT;
  if (envVar === "local" || envVar === "production") {
    console.log(
      `[API Config] Using explicit NEXT_PUBLIC_ENVIRONMENT="${envVar}"`,
    );
    return envVar;
  }

  // ✅ Opción 2: Hostname detection (fallback)
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;

    // Production domains
    if (
      hostname === "exchange.gapstation.net" ||
      hostname === "servicioshilda.orioncaribe.com"
    ) {
      console.log(
        `[API Config] Detected production environment by hostname: ${hostname}`,
      );
      return "production";
    }

    // Local domains
    const isLocalHost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.");

    if (isLocalHost) {
      console.log(
        `[API Config] Detected local environment by hostname: ${hostname}`,
      );
      return "local";
    }
  }

  // ✅ Opción 3: Default seguro a producción
  console.log(`[API Config] No environment detected, defaulting to production`);
  return "production";
}

/**
 * Obtiene la URL del API basada en el entorno
 */
function getApiUrl(environment: EnvironmentType): string {
  if (environment === "local") {
    const localUrl =
      process.env.NEXT_PUBLIC_API_URL_LOCAL || "http://localhost:3001/api/v1";
    console.log(`[API Config] Local API URL: ${localUrl}`);
    return localUrl;
  }

  // Production
  const productionUrl =
    process.env.NEXT_PUBLIC_API_URL_CLOUD ||
    "https://servicioshilda.orioncaribe.com/api/v1";
  console.log(`[API Config] Production API URL: ${productionUrl}`);
  return productionUrl;
}

/**
 * Crea la configuración del entorno
 */
function createEnvironmentConfig(): EnvironmentConfig {
  const environment = getEnvironmentType();
  const apiUrl = getApiUrl(environment);
  const isDevelopment = environment === "local";
  const isProduction = environment === "production";

  return {
    environment,
    apiUrl,
    isDevelopment,
    isProduction,
    solanaNetwork:
      (process.env.NEXT_PUBLIC_SOLANA_NETWORK as any) || "devnet",
    solanaRpcUrl:
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com",
    solanaFallbackRpcUrl:
      process.env.NEXT_PUBLIC_FALLBACK_SOLANA_RPC_URL || "https://api.devnet.solana.com",
    heliusApiKey: process.env.NEXT_PUBLIC_HELIUS_API_KEY || "",
    prowalletProgramId:
      process.env.NEXT_PUBLIC_PROWALLET_PROGRAM_ID ||
      "7sa2XazRU4R6DcsNLGMWcX4nabCzWwjj3Awfh1gxhtem",
    tokenMint:
      process.env.NEXT_PUBLIC_TOKEN_MINT ||
      "D8TwbwGGmyucrxPB9uscait27caVgeqYHPpyN3XXjUX3",
    tokenName: process.env.NEXT_PUBLIC_TOKEN_NAME || "ProWallet",
    tokenSymbol: process.env.NEXT_PUBLIC_TOKEN_SYMBOL || "GAPC",
    testModeFreeToken:
      process.env.NEXT_PUBLIC_TEST_MODE_FREE_TOKEN === "true" || isDevelopment,
  };
}

// Singleton de configuración
let configInstance: EnvironmentConfig | null = null;

/**
 * Obtiene la configuración del entorno
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  if (!configInstance) {
    configInstance = createEnvironmentConfig();
  }
  return configInstance;
}

/**
 * Obtiene la URL del API actual
 */
export function getCurrentApiUrl(): string {
  return getEnvironmentConfig().apiUrl;
}

/**
 * Hook React para usar la configuración del entorno
 */
export function useEnvironment() {
  const config = getEnvironmentConfig();
  return {
    environment: config.environment,
    apiUrl: config.apiUrl,
    isDevelopment: config.isDevelopment,
    isProduction: config.isProduction,
  };
}

/**
 * Log de configuración para debugging
 */
export function logEnvironmentConfig(): void {
  if (typeof window === "undefined") return;

  const config = getEnvironmentConfig();

  console.group("[API Config] Environment Details");
  console.log("Environment:", config.environment);
  console.log("API URL:", config.apiUrl);
  console.log("Is Development:", config.isDevelopment);
  console.log("Is Production:", config.isProduction);
  console.log("Solana Network:", config.solanaNetwork);
  console.groupEnd();
}

// Export la configuración por defecto
export const environmentConfig = getEnvironmentConfig();
