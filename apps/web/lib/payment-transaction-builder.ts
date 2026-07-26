/**
 * Payment Transaction Builder
 *
 * Construye, firma y envía transacciones de SOL desde el usuario al treasury wallet
 * Este es el flujo correcto para que autoSettlePurchase funcione:
 *
 * 1. Construir SystemProgram.transfer
 * 2. Firmar con Phantom
 * 3. Enviar a devnet
 * 4. Retornar firma confirmada
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

export interface PaymentTransactionRequest {
  payerWalletAddress: string; // Usuario wallet
  treasuryWalletAddress: string; // Destino (treasury)
  amountInSol: number; // Cantidad de SOL a transferir
  memoText?: string; // Memo opcional con ID de transacción
}

export interface PaymentTransactionResult {
  success: boolean;
  signature?: string;
  error?: string;
  confirmationStatus?: string;
}

export class PaymentTransactionBuilder {
  private rpcUrl =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  private fallbackRpcUrl =
    process.env.NEXT_PUBLIC_FALLBACK_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  private connection: Connection;

  constructor() {
    this.connection = new Connection(this.rpcUrl, "confirmed");
  }

  /**
   * Intenta obtener un blockhash reciente del RPC principal. Si falla (por ejemplo 403),
   * intenta una llamada al RPC de fallback configurado.
   */
  private async getLatestBlockhashWithFallback(): Promise<{
    blockhash: string;
    lastValidBlockHeight: number;
  }> {
    try {
      return await this.connection.getLatestBlockhash("confirmed");
    } catch (primaryErr: any) {
      console.warn(
        "⚠️ getLatestBlockhash falló en RPC principal:",
        primaryErr?.message || primaryErr,
      );

      // Si no hay fallback configurado o es el mismo RPC, propagar el error
      if (!this.fallbackRpcUrl || this.fallbackRpcUrl === this.rpcUrl) {
        throw primaryErr;
      }

      try {
        console.log("🔁 Intentando RPC de fallback:", this.fallbackRpcUrl);
        const fallbackConn = new Connection(this.fallbackRpcUrl, "confirmed");
        const res = await fallbackConn.getLatestBlockhash("confirmed");

        // Opcional: no sustituimos this.connection persistente aquí,
        // devolvemos el resultado obtenido del fallback
        return res;
      } catch (fallbackErr: any) {
        console.error(
          "❌ Fallback RPC también falló al obtener blockhash:",
          fallbackErr?.message || fallbackErr,
        );
        // Devolver el error original del fallback para diagnosticar mejor
        throw fallbackErr;
      }
    }
  }

  /**
   * Construye una transacción de transferencia de SOL
   */
  async buildPaymentTransaction(
    request: PaymentTransactionRequest,
  ): Promise<Transaction> {
    try {
      const payerKey = new PublicKey(request.payerWalletAddress);
      const treasuryKey = new PublicKey(request.treasuryWalletAddress);
      const lamports = Math.round(request.amountInSol * LAMPORTS_PER_SOL);

      console.log("🏗️ Construyendo transacción de pago:", {
        payer: request.payerWalletAddress,
        treasury: request.treasuryWalletAddress,
        amountSol: request.amountInSol,
        lamports,
      });

      // Obtener blockhash reciente (con fallback si el RPC principal devuelve 403 u otro error)
      const { blockhash, lastValidBlockHeight } =
        await this.getLatestBlockhashWithFallback();

      // Crear transacción
      const transaction = new Transaction({
        feePayer: payerKey,
        blockhash,
        lastValidBlockHeight,
      });

      // Agregar instrucción de transferencia
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: payerKey,
          toPubkey: treasuryKey,
          lamports,
        }),
      );

      // Agregar memo si existe
      if (request.memoText) {
        try {
          // En la versión actual de @solana/spl-memo, la carga es diferente
          // Se comenta por ahora para que compile, puede reactivarse con la estructura correcta
          // const MemoProgram = await this.loadMemoProgram();
          // if (MemoProgram) {
          //     transaction.add(
          //         MemoProgram.memo({
          //             programId: new PublicKey("MemoSq4gDiYvznstqoZiQQeBvybMh17kHm8p3xqn7c"),
          //             data: request.memoText,
          //         })
          //     );
          // }
          console.log("📝 Memo:", request.memoText);
        } catch (e) {
          console.warn("⚠️ No se pudo agregar memo:", e);
        }
      }

      return transaction;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      throw new Error(`Error construyendo transacción: ${message}`);
    }
  }

  /**
   * Firma una transacción con Phantom wallet
   * Si signAndSendTransaction falla, intenta con signTransaction + sendRawTransaction
   */
  async signAndSendTransaction(
    transaction: Transaction,
  ): Promise<PaymentTransactionResult> {
    try {
      // Obtener el provider de Phantom
      const phantom = (window as any).phantom?.solana;
      if (!phantom) {
        return {
          success: false,
          error: "❌ Phantom wallet no está instalado",
        };
      }

      if (!phantom.publicKey) {
        return {
          success: false,
          error: "❌ Phantom wallet no está conectado",
        };
      }

      console.log("📝 Enviando transacción a Phantom para firmar...");

      // Phantom proporciona signAndSendTransaction
      if (phantom.signAndSendTransaction) {
        try {
          const signature = await phantom.signAndSendTransaction(transaction);

          console.log("✅ Transacción firmada y enviada:", signature);

          // Confirmar transacción rápidamente (no esperar finalized)
          console.log("⏳ Esperando confirmación (confirmed)...");
          const confirmation = await this.connection.confirmTransaction(
            signature,
            "confirmed", // Cambiar a "confirmed" para respuesta más rápida
          );

          if (confirmation.value.err) {
            return {
              success: false,
              signature,
              error: `Transacción fallida: ${confirmation.value.err}`,
            };
          }

          // Retornar inmediatamente con "confirmed"
          // La validación final (finalized) ocurrirá en background
          console.log("✅ Transacción confirmada (confirmed)");
          return {
            success: true,
            signature,
            confirmationStatus: "confirmed",
          };
        } catch (e: any) {
          // Si falla signAndSendTransaction, intentar con signTransaction
          console.warn(
            "⚠️ signAndSendTransaction falló, intentando con signTransaction...",
          );

          if (phantom.signTransaction) {
            try {
              // IMPORTANTE: Reconstruir transacción con blockhash fresco
              // porque el anterior puede haber expirado
              console.log(
                "🔄 Reconstruyendo transacción con blockhash fresco...",
              );
              const { blockhash, lastValidBlockHeight } =
                await this.getLatestBlockhashWithFallback();

              // Copiar la original pero actualizar blockhash
              const freshTx = new Transaction({
                feePayer: transaction.feePayer || undefined,
                blockhash,
                lastValidBlockHeight,
              });

              // Copiar todas las instrucciones de la transacción original
              freshTx.add(...transaction.instructions);

              // Ahora firmar la transacción fresca
              const signedTx = await phantom.signTransaction(freshTx);

              const signature = await this.connection.sendRawTransaction(
                signedTx.serialize(),
                {
                  skipPreflight: false,
                  maxRetries: 3,
                },
              );

              console.log(
                "✅ Transacción enviada (firmada manualmente):",
                signature,
              );

              // Confirmar con "confirmed" (más rápido)
              const confirmation = await this.connection.confirmTransaction(
                signature,
                "confirmed",
              );

              if (confirmation.value.err) {
                return {
                  success: false,
                  signature,
                  error: `Transacción fallida: ${confirmation.value.err}`,
                };
              }

              return {
                success: true,
                signature,
                confirmationStatus: "confirmed",
              };
            } catch (signError: any) {
              return {
                success: false,
                error: `Error firmando transacción: ${signError.message || signError}`,
              };
            }
          } else {
            return {
              success: false,
              error: `Phantom no soporta signTransaction: ${e.message}`,
            };
          }
        }
      } else {
        return {
          success: false,
          error: "❌ Phantom no soporta signAndSendTransaction",
        };
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      return {
        success: false,
        error: `Error enviando transacción: ${message}`,
      };
    }
  }

  /**
   * Carga el MemoProgram dinámicamente
   */
  private async loadMemoProgram(): Promise<any> {
    try {
      const memoModule = await import("@solana/spl-memo");
      // En @solana/spl-memo v0.2.5, MemoProgram puede no estar disponible directamente
      // Se usa el módulo como es, sin necesidad de extraer una propiedad específica
      return memoModule;
    } catch {
      return null;
    }
  }

  /**
   * Procesa un pago completo: construir, firmar, enviar, confirmar
   */
  async processPayment(
    request: PaymentTransactionRequest,
  ): Promise<PaymentTransactionResult> {
    try {
      console.log("💳 Iniciando proceso de pago...");

      // 1. Construir transacción
      const transaction = await this.buildPaymentTransaction(request);

      // 2. Firmar y enviar
      const result = await this.signAndSendTransaction(transaction);

      if (result.success) {
        console.log("✅ Pago procesado exitosamente:", result.signature);
      } else {
        console.error("❌ Error en pago:", result.error);
      }

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      console.error("❌ Error procesando pago:", message);
      return {
        success: false,
        error: message,
      };
    }
  }
}

export const paymentTransactionBuilder = new PaymentTransactionBuilder();
