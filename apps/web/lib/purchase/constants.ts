/**
 * Constantes de tarifas para operaciones de compra/venta
 * DEBEN COINCIDIR con el backend en apps/api/src/services/purchase-service.ts
 */

/** Tarifa de gas en SOL - ÚNICA FEE, sin comisión de plataforma */
export const GAS_FEE_SOL = 0.000005;

/** Tarifa de plataforma en SOL - ELIMINADA (0) */
export const PLATFORM_FEE_SOL = 0;

/** Tarifa total (solo gas, sin plataforma) en SOL */
export const TOTAL_FEES_SOL = GAS_FEE_SOL + PLATFORM_FEE_SOL;

/** Buffer de seguridad para volatilidad de red en SOL */
export const BALANCE_BUFFER_SOL = 0.00001;

/** Precio fijo del token GAPC en USD - AHORA 0 */
export const TOKEN_PRICE_USD = 0;

/** Solana RPC endpoint (fallback) */
export const SOLANA_RPC_ENDPOINT = "https://api.devnet.solana.com";

/** Confirmación mínima de transacciones */
export const MIN_TRANSACTION_CONFIRMS = "confirmed" as const;
