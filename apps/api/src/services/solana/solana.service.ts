import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import { loggerService } from "../logging/logger.service";

/**
 * Servicio Solana - Interactúa con la blockchain Solana usando web3.js puro
 * Sin dependencias de Anchor
 */

const RPC_URL =
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const FALLBACK_RPC_URL =
  process.env.FALLBACK_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export class SolanaService {
  private connection: Connection;
  private fallbackConnection: Connection;
  private keypair: Keypair | null = null;
  private initialized: boolean = false;
  private currentRpcFailing: boolean = false;
  private primaryRpcFailureTime: number | null = null;
  private readonly RPC_RECOVERY_TIME_MS = 60000; // Reintentar RPC principal después de 60s

  constructor() {
    // Crear conexiones con configuración mejorada
    const httpHeaders = {
      "User-Agent": "prowallet-api/1.0.0 (+https://gapstation.net)",
    };
    this.connection = new Connection(RPC_URL, {
      commitment: "confirmed",
      httpHeaders,
    });
    this.fallbackConnection = new Connection(FALLBACK_RPC_URL, {
      commitment: "confirmed",
      httpHeaders,
    });
    // NO inicializar el keypair aquí - hacer lazy loading
  }

  /**
   * Inicializar keypair bajo demanda (lazy loading)
   */
  private ensureKeypairInitialized(): void {
    if (this.initialized) {
      return;
    }

    try {
      const keypairPath = path.join(__dirname, "../../idl/myKeypair.json");

      // Intentar cargar desde idl/myKeypair.json
      if (fs.existsSync(keypairPath)) {
        const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
        this.keypair = Keypair.fromSecretKey(Buffer.from(keypairData));
        this.initialized = true;
        loggerService.logInfo("Keypair cargado desde myKeypair.json", {
          context: "SolanaService",
          publicKey: this.keypair.publicKey.toString(),
        });
        return;
      }

      // Fallback: cargar desde prowallet.json en la raíz del proyecto
      const prowalletPath = path.join(__dirname, "../../../../prowallet.json");
      if (fs.existsSync(prowalletPath)) {
        const secretKey = JSON.parse(fs.readFileSync(prowalletPath, "utf-8"));
        this.keypair = Keypair.fromSecretKey(Buffer.from(secretKey));
        this.initialized = true;
        loggerService.logInfo("Keypair cargado desde prowallet.json", {
          context: "SolanaService",
          publicKey: this.keypair.publicKey.toString(),
        });
        return;
      }

      // Si no hay keypair, log como warning pero no fallar
      loggerService.logInfo(
        "Keypair no encontrado - Solana disponible en modo read-only",
        {
          context: "SolanaService",
        },
      );
      this.initialized = true;
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "SolanaService.ensureKeypairInitialized",
      });
      this.initialized = true; // Marcar como inicializado para no reintentar
    }
  }

  /**
   * Cargar keypair desde archivo
   */
  private initializeKeypair(): void {
    this.ensureKeypairInitialized();
  }

  /**
   * Obtener conexión a Solana con fallback automático
   * Incluye circuit breaker: recupera RPC principal después de RPC_RECOVERY_TIME_MS
   */
  getConnection(): Connection {
    // Si la RPC principal está fallando, verificar si ya se recuperó
    if (this.currentRpcFailing && this.primaryRpcFailureTime) {
      const timeSinceFailure = Date.now() - this.primaryRpcFailureTime;
      if (timeSinceFailure > this.RPC_RECOVERY_TIME_MS) {
        // Intentar recuperar la RPC principal
        loggerService.logInfo(
          "Circuit breaker: intentando recuperar RPC principal",
          {
            context: "SolanaService.getConnection",
            timeSinceFailure,
            primaryRpc: RPC_URL,
          },
        );
        this.currentRpcFailing = false;
        this.primaryRpcFailureTime = null;
      } else {
        loggerService.logInfo(
          "Usando RPC de fallback (circuit breaker activo)",
          {
            context: "SolanaService.getConnection",
            fallback: FALLBACK_RPC_URL,
            recoveryIn: this.RPC_RECOVERY_TIME_MS - timeSinceFailure,
          },
        );
        return this.fallbackConnection;
      }
    }
    return this.connection;
  }

  /**
   * Ejecutar operación RPC con retry inteligente, backoff exponencial y circuit breaker
   *
   * STRATEGY:
   * 1. Detecta 403/429 e identifica en qué RPC ocurrió
   * 2. Si es RPC principal → marca como fallida, cambia a fallback INMEDIATAMENTE
   * 3. Si es fallback → falla la operación (no hay más opciones)
   * 4. Implementa circuit breaker: recupera RPC principal después de 60s
   * 5. Backoff exponencial: 500ms → 1s → 2s (máx 5s)
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string = "RPC operation",
  ): Promise<T> {
    const MAX_RETRIES = 3;
    const INITIAL_DELAY_MS = 500; // 500ms inicial
    const MAX_DELAY_MS = 5000; // máximo 5 segundos

    let lastError: any = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Detección robusta de 403 y 429
        let isRateLimited = false;
        let isForbidden = false;

        try {
          const msg = String(error?.message || "");
          if (
            msg.includes("429") ||
            msg.toLowerCase().includes("too many requests") ||
            msg.toLowerCase().includes("rate limit")
          ) {
            isRateLimited = true;
          }

          if (
            msg.includes("403") ||
            msg.toLowerCase().includes("access forbidden") ||
            msg.toLowerCase().includes("forbidden")
          ) {
            isForbidden = true;
          }

          // Algunos errores vienen como JSON en message o en error.error
          const maybeJson = error?.message || error?.error || null;
          if (
            maybeJson &&
            typeof maybeJson === "string" &&
            maybeJson.trim().startsWith("{")
          ) {
            try {
              const parsed = JSON.parse(maybeJson);
              const code = parsed?.error?.code ?? parsed?.code ?? null;
              if (code === 429) isRateLimited = true;
              if (code === 403) isForbidden = true;
            } catch (e) {
              // ignore json parse errors
            }
          }

          // Chequear propiedades comunes en objetos de error
          const codeFromError = error?.error?.code ?? error?.code ?? null;
          if (codeFromError === 429) isRateLimited = true;
          if (codeFromError === 403) isForbidden = true;
        } catch (err) {
          // ignore
        }

        const isLastAttempt = attempt === MAX_RETRIES - 1;
        const usingFallback = this.currentRpcFailing;

        // ACCIÓN CRÍTICA: Si es 403/429 en RPC principal, cambiar inmediatamente
        if ((isForbidden || isRateLimited) && !usingFallback) {
          loggerService.logInfo(
            `🚨 RPC PRINCIPAL FALLO (${isForbidden ? "403" : "429"}). Cambiando a RPC fallback inmediatamente.`,
            {
              context: "SolanaService.executeWithRetry",
              operation: operationName,
              primaryRpc: RPC_URL,
              fallbackRpc: FALLBACK_RPC_URL,
              errorCode: isForbidden ? 403 : 429,
              rawError: String(error?.message || error),
            },
          );
          // Marcar RPC principal como fallida y guardar timestamp para circuit breaker
          this.currentRpcFailing = true;
          this.primaryRpcFailureTime = Date.now();

          // ✅ IMPORTANTE: El siguiente intento usará fallback (getConnection() lo retorna)
          if (!isLastAttempt) {
            const delay = Math.min(
              INITIAL_DELAY_MS * Math.pow(2, attempt),
              MAX_DELAY_MS,
            );
            loggerService.logInfo(
              `Reintentando con RPC de fallback en ${delay}ms`,
              {
                context: "SolanaService.executeWithRetry",
                attempt: attempt + 1,
                maxRetries: MAX_RETRIES,
              },
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
        }

        // Si es 403/429 en RPC de fallback (usingFallback = true), falla la operación
        if ((isForbidden || isRateLimited) && usingFallback) {
          loggerService.logInfo(
            "❌ AMBAS RPCs están bloqueadas o limitadas. No hay fallback disponible.",
            {
              context: "SolanaService.executeWithRetry",
              operation: operationName,
              primaryRpc: RPC_URL,
              fallbackRpc: FALLBACK_RPC_URL,
              rawError: String(error?.message || error),
            },
          );
          // No reintentar más, lanzar error
          throw error;
        }

        // Otros errores (no 403/429): reintentar con backoff
        if (!isLastAttempt) {
          const delay = Math.min(
            INITIAL_DELAY_MS * Math.pow(2, attempt),
            MAX_DELAY_MS,
          );
          loggerService.logInfo(
            `Error transitorio. Reintentando en ${delay}ms (intento ${attempt + 1}/${MAX_RETRIES})`,
            {
              context: "SolanaService.executeWithRetry",
              operation: operationName,
              attempt: attempt + 1,
              delay,
              error: String(error?.message || error).substring(0, 100),
            },
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // Último intento fallido
        loggerService.logInfo(
          `❌ Último intento fallido después de ${MAX_RETRIES} reintentos.`,
          {
            context: "SolanaService.executeWithRetry",
            operation: operationName,
            maxRetries: MAX_RETRIES,
            rawError: String(error?.message || error),
          },
        );
        throw error;
      }
    }

    // Fallback: debería ser inalcanzable pero por seguridad
    throw (
      lastError ||
      new Error(`${operationName} failed after ${MAX_RETRIES} attempts`)
    );
  }

  /**
   * Obtener keypair del payer
   */
  getKeypair(): Keypair | null {
    this.ensureKeypairInitialized();
    return this.keypair;
  }

  /**
   * Obtener dirección pública del payer
   */
  getPayerPublicKey(): PublicKey | null {
    this.ensureKeypairInitialized();
    return this.keypair?.publicKey || null;
  }

  /**
   * Obtener balance de SOL del payer
   */
  async getPayerBalance(): Promise<number> {
    try {
      this.ensureKeypairInitialized();
      if (!this.keypair) {
        throw new Error("Keypair no disponible");
      }

      return await this.executeWithRetry(async () => {
        const connection = this.getConnection();
        const balance = await connection.getBalance(this.keypair!.publicKey);
        return balance / 1e9; // Convertir a SOL
      }, "getPayerBalance");
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "SolanaService.getPayerBalance",
      });
      throw error;
    }
  }

  /**
   * Wrapper para getTokenSupply con retry
   */
  async getTokenSupply(mint: PublicKey): Promise<number> {
    return await this.executeWithRetry<number>(async () => {
      const conn = this.getConnection();
      const resp: any = await conn.getTokenSupply(mint);
      return resp?.value?.uiAmount ?? 0;
    }, "getTokenSupply");
  }

  /**
   * Wrapper para getBalance de un publicKey con retry
   */
  async getBalanceForPubkey(pubkey: PublicKey): Promise<number> {
    return await this.executeWithRetry<number>(async () => {
      const conn = this.getConnection();
      const balance = await conn.getBalance(pubkey);
      return balance / 1e9;
    }, "getBalanceForPubkey");
  }

  /**
   * Enviar una transacción a Solana
   */
  async sendTransaction(transaction: Transaction): Promise<string> {
    try {
      this.ensureKeypairInitialized();
      if (!this.keypair) {
        throw new Error("Keypair no disponible");
      }

      return await this.executeWithRetry(async () => {
        // Obtener blockhash reciente con retry
        const { blockhash } = await this.executeWithRetry(async () => {
          const connection = this.getConnection();
          return await connection.getLatestBlockhash("confirmed");
        }, "getLatestBlockhash");

        transaction.recentBlockhash = blockhash;
        transaction.feePayer = this.keypair!.publicKey;

        // Firmar y enviar
        const connection = this.getConnection();
        const txHash = await sendAndConfirmTransaction(
          connection,
          transaction,
          [this.keypair!],
        );

        return txHash;
      }, "sendTransaction");
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "SolanaService.sendTransaction",
      });
      throw error;
    }
  }

  /**
   * Enviar una transacción ya firmada con retry y failover automático
   * Esto es el endpoint que el frontend debe usar (en lugar de sendRawTransaction directo)
   */
  async sendSignedTransaction(
    transaction: Transaction,
    options: { skipPreflight?: boolean; maxRetries?: number } = {},
  ): Promise<string> {
    const { skipPreflight = false, maxRetries = 3 } = options;

    return this.executeWithRetry(async () => {
      const connection = this.getConnection(); // ← Usa fallback si primary falla
      const currentRpc = this.currentRpcFailing
        ? process.env.FALLBACK_SOLANA_RPC_URL
        : RPC_URL;

      loggerService.logInfo("Enviando transacción firmada a Solana", {
        context: "SolanaService.sendSignedTransaction",
        rpc: currentRpc,
        skipPreflight,
        maxRetries,
        feePayer: transaction.feePayer?.toString(),
      });

      const signature = await connection.sendRawTransaction(
        transaction.serialize(),
        { skipPreflight, maxRetries },
      );

      return signature;
    }, "sendSignedTransaction");
  }

  /**
   * Obtener URL de la RPC actual siendo usada
   * Útil para logging y debugging
   */
  getCurrentRpcUrl(): string {
    if (this.currentRpcFailing) {
      return FALLBACK_RPC_URL;
    }
    return RPC_URL;
  }

  /**
   * Verificar si la RPC principal está fallando
   */
  isPrimaryRpcFailing(): boolean {
    return this.currentRpcFailing;
  }

  /**
   * Obtener tiempo restante antes de reintentar la RPC principal (circuit breaker)
   * Retorna ms restantes o 0 si ya se recuperó
   */
  getRecoveryTimeRemaining(): number {
    if (!this.currentRpcFailing || !this.primaryRpcFailureTime) {
      return 0;
    }

    const elapsed = Date.now() - this.primaryRpcFailureTime;
    const remaining = Math.max(0, this.RPC_RECOVERY_TIME_MS - elapsed);

    return remaining;
  }

  /**
        source: PublicKey,
        destination: PublicKey,
        owner: PublicKey,
        amount: bigint
    ): Promise<Transaction> {
        try {
            const transferIx = createTransferInstruction(
                source,
                destination,
                owner,
                amount,
                [],
                TOKEN_PROGRAM_ID
            );

            const tx = new Transaction().add(transferIx);
            return tx;
        } catch (error) {
            loggerService.logError(error as Error, {
                context: "SolanaService.createTransferInstruction",
            });
            throw error;
        }
    }

    /**
     * Obtener ATA (Associated Token Account) para un token
     */
  async getAssociatedTokenAccount(
    mint: PublicKey,
    owner: PublicKey,
  ): Promise<PublicKey> {
    try {
      const ata = await getAssociatedTokenAddress(mint, owner);
      return ata;
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "SolanaService.getAssociatedTokenAccount",
      });
      throw error;
    }
  }

  /**
   * Verificar si una cuenta existe
   */
  async accountExists(publicKey: PublicKey): Promise<boolean> {
    try {
      const accountInfo = await this.connection.getAccountInfo(publicKey);
      return accountInfo !== null;
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "SolanaService.accountExists",
      });
      return false;
    }
  }

  /**
   * Obtener información de una transacción
   */
  async getTransactionInfo(txHash: string): Promise<any> {
    try {
      const tx = await this.connection.getTransaction(txHash);
      return tx;
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "SolanaService.getTransactionInfo",
      });
      return null;
    }
  }
}

export const solanaService = new SolanaService();
