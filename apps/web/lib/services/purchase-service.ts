/**
 * Purchase Service - Orquesta el flujo completo de compra de tokens
 *
 * PRINCIPIOS APLICADOS:
 * - SOLID: Cada función tiene una única responsabilidad
 * - Early returns: Validaciones al inicio para reducir nesting
 * - Funciones pequeñas: Máx 40 líneas, reutilizables
 * - Tipos estrictos: TypeScript con tipos explícitos
 * - Manejo robusto: Try-catch con contexto
 */

import { apiClient } from "@/lib/api-client";
import {
  Connection,
  PublicKey,
  VersionedTransaction,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

// ==================== CONSTANTES ====================

const PRICE_FETCH_TIMEOUT_MS = 30000 as const;
const CONFIRMATION_TIMEOUT_MS = 60000 as const;
const BALANCE_BUFFER_SOL = 0.00001 as const;
const GAS_FEE_SOL = 0.000005 as const;
const PLATFORM_FEE_SOL = 0.000005 as const;

// ==================== TIPOS ====================

export interface PriceData {
  readonly tokenPriceUsd: number;
  readonly solPriceUsd: number;
}

export interface PurchaseInitiation {
  readonly transactionId: string;
  readonly txBase64: string;
  readonly testMode: boolean;
  readonly totalCost: number;
}

export interface WalletProvider {
  readonly publicKey?: { toString(): string };
  readonly connect?: () => Promise<void>;
  readonly signTransaction: (
    tx: VersionedTransaction | Transaction,
  ) => Promise<VersionedTransaction | Transaction>;
}

export interface SendTransactionRequest {
  readonly signedTransaction: string;
  readonly transactionType: "payment" | "token";
  readonly skipPreflight?: boolean;
  readonly maxRetries?: number;
}

export interface SendTransactionResponse {
  readonly signature: string;
  readonly status: "pending" | "confirmed";
  readonly timestamp: string;
  readonly transactionType: string;
}

export interface WalletBalance {
  readonly balance: number;
  readonly source: "API" | "RPC";
}

export interface BuyTokensResult {
  readonly transactionId: string;
  readonly signature: string;
  readonly tokenAmount: number;
}

// ==================== ERRORES PERSONALIZADOS ====================

export class PurchaseError extends Error {
  constructor(
    message: string,
    public readonly code: string = "UNKNOWN_ERROR",
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PurchaseError";
    Object.setPrototypeOf(this, PurchaseError.prototype);
  }
}

// ==================== VALIDADORES ====================

/**
 * Valida que el usuario esté autenticado
 * @throws {PurchaseError} Si no está autenticado
 */
export function validateAuthentication(
  isAuthenticated: boolean,
  user: unknown,
): void {
  if (!isAuthenticated || !user) {
    throw new PurchaseError(
      "Debes estar autenticado para comprar tokens. Conecta tu wallet.",
      "NOT_AUTHENTICATED",
    );
  }
}

/**
 * Valida que la dirección de wallet sea válida
 * @throws {PurchaseError} Si la dirección no es válida
 */
export function validateWalletAddress(address: string): void {
  if (!address?.trim()) {
    throw new PurchaseError(
      "Se requiere una dirección de wallet válida",
      "INVALID_WALLET",
    );
  }

  try {
    new PublicKey(address);
  } catch {
    throw new PurchaseError(
      "La dirección de wallet no es válida",
      "INVALID_WALLET_FORMAT",
    );
  }
}

/**
 * Valida que la cantidad de tokens sea válida
 * @throws {PurchaseError} Si la cantidad no es válida
 */
export function validateTokenAmount(amount: number): void {
  if (amount <= 0) {
    throw new PurchaseError("El monto debe ser mayor a 0", "INVALID_AMOUNT");
  }

  if (!isFinite(amount)) {
    throw new PurchaseError("El monto no es válido", "INVALID_AMOUNT");
  }
}

/**
 * Valida que los precios sean números válidos y positivos
 * @throws {PurchaseError} Si los precios no son válidos
 */
export function validatePrices(
  tokenPriceUsd: number,
  solPriceUsd: number,
): void {
  if (!isFinite(tokenPriceUsd) || tokenPriceUsd <= 0) {
    throw new PurchaseError(
      "Precio del token no válido",
      "INVALID_TOKEN_PRICE",
      { received: tokenPriceUsd },
    );
  }

  if (!isFinite(solPriceUsd) || solPriceUsd <= 0) {
    throw new PurchaseError("Precio de SOL no válido", "INVALID_SOL_PRICE", {
      received: solPriceUsd,
    });
  }
}

// ==================== CÁLCULOS DE PRECIOS ====================

export interface PriceCalculation {
  readonly tokenPriceInSol: number;
  readonly totalTokenCostInSol: number;
  readonly gasFee: number;
  readonly platformFee: number;
  readonly totalFees: number;
  readonly totalCostInSol: number;
}

/**
 * Convierte precio USD a SOL y calcula el costo total con fees
 * GAPC siempre cuesta $0.01 USD, se convierte a SOL al momento de pagar
 *
 * @param tokenAmount - Cantidad de tokens a comprar
 * @param tokenPriceUsd - Precio del token en USD
 * @param solPriceUsd - Precio de SOL en USD
 * @param isTestMode - Si es modo test, el costo del token es 0
 * @returns Desglose completo de precios en SOL
 * @throws {PurchaseError} Si los precios no son válidos
 */
export function calculatePrices(
  tokenAmount: number,
  tokenPriceUsd: number,
  solPriceUsd: number,
  isTestMode: boolean,
): PriceCalculation {
  validatePrices(tokenPriceUsd, solPriceUsd);

  // Convertir precio USD a SOL para el cálculo de pago
  const tokenPriceInSol = tokenPriceUsd / solPriceUsd;
  const totalTokenCostInSol = isTestMode ? 0 : tokenAmount * tokenPriceInSol;
  const totalFees = GAS_FEE_SOL + PLATFORM_FEE_SOL;
  const totalCostInSol = totalTokenCostInSol + totalFees;

  return {
    tokenPriceInSol,
    totalTokenCostInSol,
    gasFee: GAS_FEE_SOL,
    platformFee: PLATFORM_FEE_SOL,
    totalFees,
    totalCostInSol,
  };
}

// ==================== OBTENCIÓN DE PRECIOS ====================

/**
 * Intenta obtener el precio de SOL desde el cliente (proveedor de precios)
 * @returns Precio en USD o null si falla
 */
async function fetchSolPriceFromClient(
  getSolPriceFromClient?: (opts: object) => Promise<unknown>,
): Promise<number | null> {
  if (!getSolPriceFromClient) {
    return null;
  }

  try {
    const response = await getSolPriceFromClient({
      ttlMs: PRICE_FETCH_TIMEOUT_MS,
    });
    const price = Number((response as any)?.price);

    if (isFinite(price) && price > 0) {
      return price;
    }

    return null;
  } catch (error) {
    console.warn("⚠️ Error fetching SOL price from client:", error);
    return null;
  }
}

/**
 * Intenta obtener el precio de SOL desde la API del servidor
 * @returns Precio en USD o null si falla
 */
async function fetchSolPriceFromApi(): Promise<number | null> {
  try {
    const response = await apiClient.get<unknown>("/exchange/solPrice");
    const price = Number(
      (response as any)?.extra?.solPriceUsd || (response as any)?.solPriceUsd,
    );

    if (isFinite(price) && price > 0) {
      return price;
    }

    return null;
  } catch (error) {
    console.warn("⚠️ Error fetching SOL price from API:", error);
    return null;
  }
}

/**
 * Obtiene el precio de SOL con fallback a múltiples fuentes
 * @throws {PurchaseError} Si no se puede obtener el precio
 */
async function obtainSolPrice(
  getSolPriceFromClient?: (opts: object) => Promise<unknown>,
): Promise<number> {
  // Intentar cliente primero
  const clientPrice = await fetchSolPriceFromClient(getSolPriceFromClient);
  if (clientPrice !== null) {
    return clientPrice;
  }

  // Fallback a API
  const apiPrice = await fetchSolPriceFromApi();
  if (apiPrice !== null) {
    return apiPrice;
  }

  // Si ambas fallan, error
  throw new PurchaseError(
    "No se pudo obtener el precio de SOL",
    "PRICE_FETCH_ERROR",
  );
}

/**
 * Obtiene el precio del token GAPC desde la API
 * @returns Precio en USD o precio por defecto en modo test
 * @throws {PurchaseError} Si no se puede obtener y no estamos en test mode
 */
async function obtainTokenPrice(): Promise<number> {
  try {
    const response = await apiClient.get<unknown>("/exchange/getPrice");
    const price = Number(
      (response as any)?.extra?.priceUSD ||
        (response as any)?.priceUSD ||
        (response as any)?.price,
    );

    if (isFinite(price) && price > 0) {
      return price;
    }
  } catch (error) {
    console.warn("⚠️ Error fetching token price from API:", error);
  }

  // Usar precio por defecto en test mode
  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE_FREE_TOKEN === "true";
  if (isTestMode) {
    return 0.01;
  }

  throw new PurchaseError(
    "No se pudo obtener el precio del token",
    "PRICE_FETCH_ERROR",
  );
}

/**
 * Obtiene los precios de SOL y GAPC con manejo robusto de errores
 * @returns Precios en USD (tokenPriceUsd, solPriceUsd)
 * @throws {PurchaseError} Si no se pueden obtener ambos precios
 */
async function fetchPrices(
  getSolPriceFromClient?: (opts: object) => Promise<unknown>,
): Promise<PriceData> {
  try {
    const [solPriceUsd, tokenPriceUsd] = await Promise.all([
      obtainSolPrice(getSolPriceFromClient),
      obtainTokenPrice(),
    ]);

    validatePrices(tokenPriceUsd, solPriceUsd);

    return { tokenPriceUsd, solPriceUsd };
  } catch (error) {
    if (error instanceof PurchaseError) {
      throw error;
    }

    throw new PurchaseError(
      `Error obteniendo precios: ${error instanceof Error ? error.message : String(error)}`,
      "PRICE_FETCH_ERROR",
      { originalError: error },
    );
  }
}

// ==================== INICIACIÓN DE COMPRA ====================

/**
 * Extrae el payload de una respuesta API (normaliza estructura)
 */
function extractPurchasePayload(response: unknown): Record<string, unknown> {
  if (!response || typeof response !== "object") {
    return {};
  }

  const responseObj = response as Record<string, unknown>;
  return (responseObj.extra as Record<string, unknown>) || responseObj || {};
}

/**
 * Extrae y valida los campos requeridos de la respuesta de compra
 * @throws {PurchaseError} Si faltan campos requeridos
 */
function validatePurchaseResponse(payload: Record<string, unknown>): {
  transactionId: string;
  txBase64: string;
  testMode: boolean;
  totalCost: number;
} {
  const transactionId = String(payload.transactionId || payload.id || "");
  const txBase64 = String(payload.txBase64 || payload.tx || "");
  const testMode = Boolean(payload.testMode || payload.test || false);
  const totalCost = Number(payload.totalCost || payload.fees || 0);

  if (!transactionId) {
    throw new PurchaseError(
      "Servidor no retornó transactionId",
      "INVALID_RESPONSE",
    );
  }

  if (!txBase64) {
    throw new PurchaseError(
      "Servidor no retornó transacción",
      "INVALID_RESPONSE",
    );
  }

  return { transactionId, txBase64, testMode, totalCost };
}

/**
 * Intenta iniciar compra con tRPC primero, fallback a endpoint legacy
 * @throws {PurchaseError} Si ambos endpoints fallan
 */
async function initiatePurchase(
  walletAddress: string,
  tokenAmount: number,
): Promise<PurchaseInitiation> {
  try {
    // Intentar tRPC primero (endpoint moderno)
    const trpcResponse = await apiClient
      .post<unknown>("/trpc/purchase/start", {
        walletAddress,
        tokenAmount,
      })
      .catch(() => null);

    if (trpcResponse) {
      const payload = extractPurchasePayload(trpcResponse);
      const validated = validatePurchaseResponse(payload);
      return validated;
    }

    // Fallback a endpoint legacy
    const legacyResponse = await apiClient.post<unknown>("/purchase/initiate", {
      walletAddress,
      tokenAmount,
      paymentMethod: "SOL",
    });

    const payload = extractPurchasePayload(legacyResponse);
    const validated = validatePurchaseResponse(payload);
    return validated;
  } catch (error) {
    if (error instanceof PurchaseError) {
      throw error;
    }

    throw new PurchaseError(
      `Error iniciando compra: ${error instanceof Error ? error.message : String(error)}`,
      "INITIATE_ERROR",
      { originalError: error },
    );
  }
}

// ==================== VERIFICACIÓN DE BALANCE ====================

/**
 * Obtiene balance desde la API del servidor
 * @returns Balance en SOL o null si falla
 */
async function fetchBalanceFromApi(
  walletAddress: string,
): Promise<number | null> {
  try {
    const baseUrl = (apiClient as any).baseUrl || "";
    const response = await fetch(
      `${baseUrl}/exchange/getBalance/${walletAddress}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as Record<string, unknown>;
    const balance = (data.extra as Record<string, unknown>)?.balance;

    if (balance !== undefined && balance !== null) {
      return Number(balance);
    }

    return null;
  } catch (error) {
    console.warn("⚠️ Error fetching balance from API:", error);
    return null;
  }
}

/**
 * Obtiene balance desde el RPC de Solana
 * @throws {PurchaseError} Si el RPC falla
 */
async function fetchBalanceFromRpc(
  walletAddress: string,
  rpcUrl: string,
): Promise<number> {
  try {
    const walletPubkey = new PublicKey(walletAddress);
    const connection = new Connection(rpcUrl, "confirmed");
    const balanceLamports = await connection.getBalance(walletPubkey);
    return balanceLamports / LAMPORTS_PER_SOL;
  } catch (error) {
    throw new PurchaseError(
      "No se pudo obtener balance desde RPC",
      "RPC_ERROR",
      { originalError: error },
    );
  }
}

/**
 * Obtiene balance con fallback: API primero, luego RPC
 * @throws {PurchaseError} Si ambos fallan
 */
async function obtainWalletBalance(
  walletAddress: string,
  rpcUrl: string,
): Promise<WalletBalance> {
  // Intentar API primero
  const apiBalance = await fetchBalanceFromApi(walletAddress);
  if (apiBalance !== null) {
    return { balance: apiBalance, source: "API" };
  }

  // Fallback a RPC
  const rpcBalance = await fetchBalanceFromRpc(walletAddress, rpcUrl);
  return { balance: rpcBalance, source: "RPC" };
}

/**
 * Verifica que el wallet tenga suficiente SOL para la compra
 * @throws {PurchaseError} Si el balance es insuficiente
 */
async function verifyBalance(
  walletAddress: string,
  requiredSolAmount: number,
  rpcUrl: string,
): Promise<WalletBalance> {
  const walletBalance = await obtainWalletBalance(walletAddress, rpcUrl);
  const requiredWithBuffer = requiredSolAmount + BALANCE_BUFFER_SOL;

  if (walletBalance.balance < requiredWithBuffer) {
    throw new PurchaseError(
      `Balance insuficiente. Tienes ${walletBalance.balance.toFixed(6)} SOL pero necesitas ${requiredWithBuffer.toFixed(6)} SOL`,
      "INSUFFICIENT_BALANCE",
      {
        available: walletBalance.balance,
        required: requiredWithBuffer,
      },
    );
  }

  return walletBalance;
}

// ==================== DETECCIÓN Y MANEJO DE WALLET ====================

/**
 * Lista de proveedores de wallet soportados (en orden de preferencia)
 */
function getSupportedWalletProviders(): WalletProvider[] {
  const window_ = typeof window !== "undefined" ? window : ({} as any);

  return [
    window_.solana,
    window_.phantom?.solana,
    window_.solflare,
    window_.magicEden?.solana,
    window_.brave?.solana,
    window_.slope,
    window_.coin98?.solana,
    window_.ledger?.solana,
  ].filter((provider): provider is WalletProvider => Boolean(provider));
}

/**
 * Obtiene el proveedor de wallet disponible (conectado o el primero disponible)
 * @throws {PurchaseError} Si no hay wallet instalada
 */
function getWalletProvider(): WalletProvider {
  const availableProviders = getSupportedWalletProviders();

  if (availableProviders.length === 0) {
    throw new PurchaseError(
      "No se encontró proveedor de wallet. Instala Phantom, Solflare u otra wallet de Solana.",
      "NO_WALLET",
    );
  }

  // Preferir wallet ya conectada
  const connectedWallet = availableProviders.find((w) => w.publicKey);
  if (connectedWallet) {
    return connectedWallet;
  }

  // Si no, devolver la primera disponible
  return availableProviders[0];
}

/**
 * Conecta la wallet si no está conectada
 * @throws {PurchaseError} Si la conexión falla
 */
async function connectWalletIfNeeded(wallet: WalletProvider): Promise<void> {
  const isAlreadyConnected = Boolean(wallet.publicKey);
  if (isAlreadyConnected) {
    return;
  }

  const supportsConnect = typeof wallet.connect === "function";
  if (!supportsConnect) {
    throw new PurchaseError(
      "La wallet no soporta la función connect()",
      "WALLET_CONNECT_NOT_SUPPORTED",
    );
  }

  try {
    await wallet.connect();
  } catch (error) {
    throw new PurchaseError(
      `No se pudo conectar la wallet. ${error instanceof Error ? error.message : String(error)}`,
      "WALLET_CONNECT_ERROR",
      { originalError: error },
    );
  }
}

/**
 * Obtiene la dirección pública de la wallet conectada
 * @throws {PurchaseError} Si la wallet no está conectada
 */
function getConnectedWalletAddress(wallet: WalletProvider): string {
  const address = wallet.publicKey?.toString?.();

  if (!address) {
    throw new PurchaseError(
      "La wallet no está conectada",
      "WALLET_NOT_CONNECTED",
    );
  }

  return address;
}

/**
 * Asegura que la wallet esté conectada y retorna su dirección
 * @throws {PurchaseError} Si hay problemas de conexión
 */
async function ensureWalletConnected(wallet: WalletProvider): Promise<string> {
  await connectWalletIfNeeded(wallet);
  return getConnectedWalletAddress(wallet);
}

// ==================== MANEJO DE TRANSACCIONES ====================

/**
 * Deserializa una transacción desde su representación en base64
 * Intenta VersionedTransaction primero, fallback a Transaction legacy
 * @throws {PurchaseError} Si la deserialización falla
 */
async function deserializeTransaction(
  txBase64: string,
): Promise<VersionedTransaction | Transaction> {
  const buffer = Buffer.from(txBase64, "base64");

  try {
    // Intentar formato moderno primero
    return VersionedTransaction.deserialize(buffer);
  } catch {
    try {
      // Fallback a formato legacy
      return Transaction.from(buffer);
    } catch (error) {
      throw new PurchaseError(
        `Error deserializando transacción: ${error instanceof Error ? error.message : String(error)}`,
        "DESERIALIZE_ERROR",
        { originalError: error },
      );
    }
  }
}

/**
 * Firma una transacción con la wallet del usuario
 * @throws {PurchaseError} Si la firma falla
 */
async function signTransaction(
  wallet: WalletProvider,
  transaction: VersionedTransaction | Transaction,
): Promise<VersionedTransaction | Transaction> {
  if (!wallet.signTransaction) {
    throw new PurchaseError(
      "La wallet no soporta signTransaction",
      "SIGN_NOT_SUPPORTED",
    );
  }

  try {
    return await wallet.signTransaction(transaction);
  } catch (error) {
    throw new PurchaseError(
      `Error al firmar la transacción: ${error instanceof Error ? error.message : String(error)}`,
      "SIGN_ERROR",
      { originalError: error },
    );
  }
}

/**
 * Serializa una transacción firmada a base64 para envío al backend
 */
function serializeTransaction(
  transaction: VersionedTransaction | Transaction,
): string {
  return Buffer.from(transaction.serialize()).toString("base64");
}

/**
 * Envía la transacción firmada al backend para procesamiento
 * @throws {PurchaseError} Si el envío falla
 */
async function sendSignedTransactionToBackend(
  signedTransaction: VersionedTransaction | Transaction,
  sendSignedTransaction: (
    req: SendTransactionRequest,
  ) => Promise<SendTransactionResponse>,
): Promise<string> {
  try {
    const txBase64 = serializeTransaction(signedTransaction);

    const result = await sendSignedTransaction({
      signedTransaction: txBase64,
      transactionType: "payment",
      skipPreflight: false,
      maxRetries: 3,
    });

    return result.signature;
  } catch (error) {
    throw new PurchaseError(
      `Error enviando transacción: ${error instanceof Error ? error.message : String(error)}`,
      "SEND_ERROR",
      { originalError: error },
    );
  }
}

/**
 * @deprecated Ya no se usa. El servidor confirma en background con reintentos.
 * Se mantiene por compatibilidad pero no se llama desde buyTokens()
 *
 * Espera a que una transacción sea confirmada en la blockchain
 * @throws {PurchaseError} Si la confirmación falla o vence el timeout
 */
async function confirmTransaction(
  signature: string,
  rpcUrl: string,
  timeoutMs: number = CONFIRMATION_TIMEOUT_MS,
): Promise<void> {
  const connection = new Connection(rpcUrl, "confirmed");

  const confirmationPromise = connection.confirmTransaction(
    signature,
    "confirmed",
  );

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new PurchaseError(
            "Timeout esperando confirmación de transacción",
            "CONFIRM_TIMEOUT",
          ),
        ),
      timeoutMs,
    ),
  );

  try {
    await Promise.race([confirmationPromise, timeoutPromise]);
  } catch (error) {
    throw new PurchaseError(
      `Error confirmando transacción: ${error instanceof Error ? error.message : String(error)}`,
      "CONFIRM_ERROR",
      { originalError: error },
    );
  }
}

/**
 * Confirmar compra en el servidor (llamar a confirmPurchase endpoint)
 * Esto marca la transacción como "completed" y ejecuta updateTokenBalance
 */
// ==================== CONFIRMACIÓN EN SERVIDOR ====================

/**
 * Notifica al servidor que la transacción fue confirmada en blockchain
 * Esto marca la compra como completada y actualiza el balance del usuario
 * @throws {PurchaseError} Si la confirmación en servidor falla
 */
async function confirmPurchaseOnServer(
  transactionId: string,
  signature: string,
  blockSlot: number = 0,
): Promise<void> {
  console.log("📨 Confirmando compra en servidor...", {
    transactionId,
    signature: signature.substring(0, 20) + "...",
  });

  try {
    const response = await apiClient.post<unknown>(
      `/purchase/confirm/${transactionId}`,
      { signature, blockSlot },
    );

    console.log("✅ Compra confirmada en servidor:", response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PurchaseError(
      `Servidor no pudo confirmar la compra: ${message}`,
      "SERVER_CONFIRM_ERROR",
      { originalError: error },
    );
  }
}

// ==================== ORQUESTADOR PRINCIPAL ====================

export interface BuyTokensParams {
  readonly walletAddress: string;
  readonly tokenAmount: number;
  readonly isAuthenticated: boolean;
  readonly user: unknown;
  readonly rpcUrl: string;
  readonly getSolPriceFromClient?: (opts: object) => Promise<unknown>;
  readonly sendSignedTransaction: (
    req: SendTransactionRequest,
  ) => Promise<SendTransactionResponse>;
  readonly onTransactionIdReceived?: (txId: string) => void;
  readonly onTransactionSigned?: (signature: string) => void;
}

/**
 * Orquesta el flujo completo de compra de tokens:
 * 1. Valida autenticación y entradas
 * 2. Obtiene precios y calcula costos
 * 3. Verifica balance del usuario
 * 4. Inicia compra en servidor
 * 5. Obtiene y conecta wallet
 * 6. Deserializa, firma y envía transacción
 * 7. Espera confirmación en blockchain
 * 8. Notifica confirmación al servidor
 *
 * @returns Detalles de la compra completada
 * @throws {PurchaseError} En cualquier paso del proceso
 */
export async function buyTokens(
  params: BuyTokensParams,
): Promise<BuyTokensResult> {
  console.log("🚀 Iniciando flujo de compra...");

  const {
    walletAddress,
    tokenAmount,
    isAuthenticated,
    user,
    rpcUrl,
    getSolPriceFromClient,
    sendSignedTransaction,
    onTransactionIdReceived,
    onTransactionSigned,
  } = params;

  // ========== VALIDACIONES INICIALES ==========
  validateAuthentication(isAuthenticated, user);
  validateWalletAddress(walletAddress);
  validateTokenAmount(tokenAmount);

  // ========== OBTENER Y VALIDAR PRECIOS ==========
  console.log("💰 Obteniendo precios...");
  const prices = await fetchPrices(getSolPriceFromClient);

  // ========== CALCULAR COSTOS ==========
  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE_FREE_TOKEN === "true";
  const priceCalculation = calculatePrices(
    tokenAmount,
    prices.tokenPriceUsd,
    prices.solPriceUsd,
    isTestMode,
  );

  console.log("💵 Resumen de pago:", {
    tokenAmount,
    pricePerToken: prices.tokenPriceUsd,
    totalCostInSol: priceCalculation.totalCostInSol.toFixed(9),
    fees: priceCalculation.totalFees.toFixed(9),
    testMode: isTestMode,
  });

  // ========== VERIFICAR BALANCE ==========
  console.log("🔍 Verificando balance...");
  const balanceInfo = await verifyBalance(
    walletAddress,
    priceCalculation.totalCostInSol,
    rpcUrl,
  );
  console.log(
    `✅ Balance verificado: ${balanceInfo.balance.toFixed(6)} SOL (origen: ${balanceInfo.source})`,
  );

  // ========== INICIAR COMPRA EN SERVIDOR ==========
  console.log("📝 Iniciando compra en servidor...");
  const purchase = await initiatePurchase(walletAddress, tokenAmount);
  onTransactionIdReceived?.(purchase.transactionId);

  // ========== OBTENER Y VALIDAR WALLET ==========
  console.log("📱 Obteniendo proveedor de wallet...");
  const wallet = getWalletProvider();
  const connectedAddress = await ensureWalletConnected(wallet);

  if (connectedAddress !== walletAddress) {
    throw new PurchaseError(
      `Wallet mismatch: conectado ${connectedAddress} pero esperado ${walletAddress}`,
      "WALLET_MISMATCH",
      { expected: walletAddress, received: connectedAddress },
    );
  }

  // ========== DESERIALIZAR TRANSACCIÓN ==========
  console.log("🔐 Deserializando transacción...");
  const transaction = await deserializeTransaction(purchase.txBase64);

  // ========== FIRMA DE TRANSACCIÓN ==========
  console.log("✍️ Pidiendo firma a la wallet...");
  const signedTransaction = await signTransaction(wallet, transaction);

  // ========== ENVIAR TRANSACCIÓN AL BACKEND ==========
  console.log("📤 Enviando transacción al backend...");
  const signature = await sendSignedTransactionToBackend(
    signedTransaction,
    sendSignedTransaction,
  );
  onTransactionSigned?.(signature);

  // ========== NOTIFICAR SERVIDOR INMEDIATAMENTE ==========
  // El backend confirmará en background con reintentos exponenciales
  // No esperamos aquí para que el usuario reciba feedback rápidamente
  console.log("📝 Notificando al servidor sobre la transacción enviada...");
  await confirmPurchaseOnServer(purchase.transactionId, signature);
  console.log("✅ Servidor notificado y confirmará en background");

  return {
    transactionId: purchase.transactionId,
    signature,
    tokenAmount,
  };
}
