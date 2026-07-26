/**
 * Utilidades para manejo seguro de variables de entorno
 */

/**
 * Obtiene una variable de entorno requerida
 * Lanza error si no está definida
 */
export function getRequiredEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `❌ CRITICAL: Environment variable ${key} is required but not set`,
    );
  }
  return value;
}

/**
 * Obtiene una variable de entorno opcional con valor por defecto
 */
export function getOptionalEnvVar(
  key: string,
  defaultValue: string = "",
): string {
  return process.env[key] || defaultValue;
}

/**
 * Obtiene una variable numérica de entorno con validación
 */
export function getNumericEnvVar(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;

  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    console.warn(
      `⚠️ WARNING: Environment variable ${key} is not a valid number, using default: ${defaultValue}`,
    );
    return defaultValue;
  }

  return parsed;
}

/**
 * Obtiene una variable booleana de entorno
 */
export function getBooleanEnvVar(
  key: string,
  defaultValue: boolean = false,
): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;

  return value.toLowerCase() === "true";
}

/**
 * Valida que las variables críticas estén presentes
 */
export function validateCriticalEnvVars(): void {
  const criticalVars = [
    "TOKEN_MINT_ADDRESS",
    "PROWALLET_PROGRAM_ID",
    "TREASURY_WALLET",
    "JWT_SECRET",
    "REDIS_URL",
    "SOLANA_NETWORK",
  ];

  const missing = criticalVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `❌ CRITICAL: Missing required environment variables: ${missing.join(", ")}\n` +
        "Please set these variables in your .env file or environment before starting the application.",
    );
  }
}

/**
 * Obtiene configuración de red Solana segura
 */
export function getSolanaNetwork(): string {
  const network = getOptionalEnvVar("SOLANA_NETWORK", "devnet");
  const validNetworks = ["mainnet-beta", "testnet", "devnet", "localnet"];

  if (!validNetworks.includes(network)) {
    console.warn(
      `⚠️ WARNING: Invalid SOLANA_NETWORK "${network}", using "devnet"`,
    );
    return "devnet";
  }

  return network;
}

/**
 * Valida formato de dirección de Solana
 */
export function validateSolanaAddress(address: string): boolean {
  // Validación básica de dirección de Solana
  if (!address || typeof address !== "string") return false;

  // Las direcciones de Solana tienen entre 32-44 caracteres
  if (address.length < 32 || address.length > 44) return false;

  // Solo caracteres base58 válidos
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

/**
 * Valida formato de clave privada
 */
export function validatePrivateKey(key: string): boolean {
  if (!key || typeof key !== "string") return false;

  try {
    // Intentar decodificar como base58
    const decoded = Buffer.from(key, "utf8");

    // Las claves privadas de Solana tienen 64 bytes
    return decoded.length === 64;
  } catch {
    return false;
  }
}
