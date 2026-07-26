import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { useState, useCallback } from "react";
import Swal from "sweetalert2";

interface SignerError {
  code: string;
  message: string;
}

interface WalletAdapter {
  signTransaction(
    transaction: Transaction | VersionedTransaction,
  ): Promise<Transaction | VersionedTransaction>;
  publicKey: { toString(): string };
}

interface UseWalletSignerReturn {
  is_signing: boolean;
  sign_transaction: (transaction_base64: string) => Promise<string | null>;
  error: string | null;
}

/**
 * Hook para firmar transacciones con Solana wallet (Phantom, Solflare, etc.)
 * Detecta automáticamente el wallet disponible en window.solana o window.soflare
 * Firma la transacción y retorna la firma en base64
 *
 * Soporta ambos formatos de transacción:
 * - VersionedTransaction (moderno, usado por Phantom/Solflare actualizados)
 * - Transaction legacy (compatibilidad)
 */
export function use_wallet_signer(): UseWalletSignerReturn {
  const [is_signing, set_is_signing] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  const sign_transaction = useCallback(
    async (transaction_base64: string): Promise<string | null> => {
      try {
        set_error(null);
        set_is_signing(true);

        const timestamp = new Date().toISOString().split("T")[1].slice(0, 12);
        console.log(
          `[${timestamp}] [WALLET-SIGNER] 🔐 Starting transaction signing...`,
        );

        // Detectar Phantom o Solflare wallet
        const wallet = (window as any).solana || (window as any).soflare;

        if (!wallet) {
          const error_msg =
            "Solana wallet not found. Please install Phantom or Solflare.";
          set_error(error_msg);

          console.error(`[${timestamp}] [WALLET-SIGNER] ❌ Wallet not found`);

          await Swal.fire({
            title: "Wallet no encontrado",
            text: error_msg,
            icon: "error",
            confirmButtonText: "Entendido",
          });

          return null;
        }

        console.log(
          `[${timestamp}] [WALLET-SIGNER] ✓ Wallet detected:`,
          wallet.publicKey?.toString().substring(0, 8) + "...",
        );

        // Verificar si está conectado
        if (!wallet.isConnected || !wallet.publicKey) {
          try {
            console.log(
              `[${timestamp}] [WALLET-SIGNER] 🔗 Attempting to connect wallet...`,
            );
            await wallet.connect();

            if (!wallet.publicKey) {
              throw new Error("Wallet connection failed. Please try again.");
            }

            console.log(`[${timestamp}] [WALLET-SIGNER] ✓ Wallet connected`);
          } catch (connect_err) {
            const error_msg =
              connect_err instanceof Error
                ? connect_err.message
                : "Error al conectar wallet";

            set_error(error_msg);

            console.error(
              `[${timestamp}] [WALLET-SIGNER] ❌ Connection failed:`,
              error_msg,
            );

            await Swal.fire({
              title: "Error al conectar",
              text: error_msg,
              icon: "error",
              confirmButtonText: "Entendido",
            });

            return null;
          }
        }

        // Decodificar transacción base64
        console.log(
          `[${timestamp}] [WALLET-SIGNER] 📦 Decoding transaction from base64...`,
        );
        const transaction_buffer = Buffer.from(transaction_base64, "base64");

        let transaction: Transaction | VersionedTransaction;
        try {
          // Intentar VersionedTransaction primero (moderno)
          transaction = VersionedTransaction.deserialize(transaction_buffer);
          console.log(
            `[${timestamp}] [WALLET-SIGNER] ✓ Decoded as VersionedTransaction`,
          );
        } catch {
          try {
            // Fallback a Transaction legacy
            transaction = Transaction.from(transaction_buffer);
            console.log(
              `[${timestamp}] [WALLET-SIGNER] ✓ Decoded as legacy Transaction`,
            );
          } catch (decode_err) {
            throw new Error(
              `Failed to decode transaction: ${decode_err instanceof Error ? decode_err.message : String(decode_err)}`,
            );
          }
        }

        console.log(
          `[${timestamp}] [WALLET-SIGNER] ✓ Transaction decoded, ready to sign`,
        );

        // Firmar transacción con wallet
        console.log(
          `[${timestamp}] [WALLET-SIGNER] 🖊️ Requesting wallet to sign transaction...`,
        );

        // Log transaction details safely for both types
        const isVersioned = transaction instanceof VersionedTransaction;
        const txDetails: Record<string, any> = {
          type: isVersioned ? "VersionedTransaction" : "Transaction",
          feePayer: (transaction as any).feePayer?.toString?.(),
        };

        if (!isVersioned) {
          const legacyTx = transaction as Transaction;
          txDetails.instructionsCount = legacyTx.instructions?.length || 0;
          txDetails.recentBlockhash = legacyTx.recentBlockhash;
        } else {
          const versionedTx = transaction as any;
          txDetails.instructionsCount =
            versionedTx.message?.instructions?.length || 0;
        }

        console.log(
          `[${timestamp}] [WALLET-SIGNER] 📋 Transaction details:`,
          txDetails,
        );

        let signed_transaction: Transaction | VersionedTransaction;
        try {
          signed_transaction = await wallet.signTransaction(transaction);
        } catch (sign_err) {
          const timestamp = new Date().toISOString().split("T")[1].slice(0, 12);
          console.error(
            `[${timestamp}] [WALLET-SIGNER] ❌ Wallet signTransaction failed:`,
            {
              message: (sign_err as Error)?.message || String(sign_err),
              code: (sign_err as any)?.code,
              name: (sign_err as any)?.name,
              stack: (sign_err as Error)?.stack,
            },
          );
          throw sign_err;
        }

        // ✅ FIX: Serialize the ENTIRE signed transaction, not just the signature
        console.log(
          `[${timestamp}] [WALLET-SIGNER] ✓ Transaction signed by wallet`,
        );
        console.log(
          `[${timestamp}] [WALLET-SIGNER] 📤 Serializing signed transaction...`,
        );

        // Serializar la transacción firmada completa
        const signed_transaction_serialized = Buffer.from(
          signed_transaction.serialize(),
        ).toString("base64");

        console.log(
          `[${timestamp}] [WALLET-SIGNER] ✓ Signed transaction serialized (${signed_transaction_serialized.length} bytes base64)`,
        );

        return signed_transaction_serialized;
      } catch (err) {
        const timestamp = new Date().toISOString().split("T")[1].slice(0, 12);
        const error_message =
          err instanceof Error
            ? err.message
            : "Unknown error signing transaction";
        const error_code = (err as any)?.code || "UNKNOWN";
        const error_name = (err as any)?.name || "Error";

        set_error(error_message);

        console.error(`[${timestamp}] [WALLET-SIGNER] ❌ Signing error:`, {
          message: error_message,
          code: error_code,
          name: error_name,
          stack: (err as Error)?.stack,
          fullError: err,
        });

        await Swal.fire({
          title: "Error al firmar",
          text: `${error_message} (${error_code})`,
          icon: "error",
          confirmButtonText: "Entendido",
        });

        return null;
      } finally {
        set_is_signing(false);
      }
    },
    [],
  );

  return {
    is_signing,
    sign_transaction,
    error,
  };
}
