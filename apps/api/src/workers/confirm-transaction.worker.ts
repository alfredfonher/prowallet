/**
 * Background worker para confirmar transacciones
 * NO bloquea requests HTTP
 * Incluye el transfer de tokens después de confirmación
 */

import dotenv from "dotenv";
dotenv.config();
import { transactionRepository } from "../models/types";
import { loggerService } from "../services/logging/logger.service";
import { solanaService } from "../services/solana/solana.service";
import { PROWALLET_CONFIG } from "../config";
import { confirm_transaction_with_retries } from "../services/solana/confirm-transaction.service";
import { PublicKey, Transaction, Keypair } from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function confirm_transaction_in_background(
  transactionId: string,
  signature: string,
  walletAddress: string,
  tokenAmount: number,
  requestId: string,
): Promise<void> {
  loggerService.logInfo("🔄 Starting background confirmation", {
    requestId,
    transactionId,
    signature: signature.substring(0, 20) + "...",
  });

  const connection = solanaService.getConnection();
  let solTx = null;
  let lastError: any = null;

  // REINTENTA OBTENER LA TX DEL RPC (con backoff)
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      solTx = await connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (solTx) {
        loggerService.logInfo("✅ Transaction found on-chain", {
          requestId,
          transactionId,
          attempt: attempt + 1,
        });
        break;
      }
    } catch (error: any) {
      lastError = error;
      const errorMsg = error?.message || String(error);

      loggerService.logInfo("⚠️ RPC error, retrying...", {
        requestId,
        attempt: attempt + 1,
        maxRetries: MAX_RETRIES,
        error: errorMsg.substring(0, 100),
      });

      if (attempt < MAX_RETRIES - 1) {
        // Backoff exponencial
        const delay = Math.min(30000, RETRY_DELAY_MS * Math.pow(2, attempt));
        await sleep(delay);
      }
    }
  }

  // SI NO ENCONTRAMOS LA TX DESPUÉS DE REINTENTOS
  if (!solTx) {
    loggerService.logError(
      new Error("Transaction not found on-chain after retries"),
      {
        requestId,
        transactionId,
        lastError: lastError?.message,
      },
    );

    // ❌ NUNCA MINT SIN CONFIRMACIÓN
    await transactionRepository.update(
      { transactionId },
      {
        status: "failed",
        error: "Transaction not found on-chain after maximum retries",
        completedAt: new Date(),
      },
    );
    return;
  }

  // ✅ TRANSACCIÓN CONFIRMADA EN BLOCKCHAIN
  loggerService.logInfo("✅ Transaction confirmed on-chain", {
    requestId,
    transactionId,
    walletAddress,
    tokenAmount,
  });

  // 🎯 AHORA HACER EL TRANSFER DE TOKENS
  try {
    await transfer_tokens_to_buyer(walletAddress, tokenAmount, requestId);

    loggerService.logInfo("✅ Tokens transferred to buyer", {
      requestId,
      transactionId,
      walletAddress,
      tokenAmount,
    });
  } catch (transferError: any) {
    loggerService.logError(transferError, {
      requestId,
      transactionId,
      context: "token_transfer_failed",
      walletAddress,
      tokenAmount,
    });

    // Marcar como error en transfer
    await transactionRepository.update(
      { transactionId },
      {
        status: "transfer_failed",
        error: transferError.message || "Failed to transfer tokens",
        completedAt: new Date(),
      },
    );
    return;
  }

  // Marcar como completada exitosamente
  await transactionRepository.update(
    { transactionId },
    {
      status: "success",
      minted: true,
      completedAt: new Date(),
    },
  );

  loggerService.logInfo("✅ Transaction marked as completed", {
    requestId,
    transactionId,
  });
}

/**
 * Transfiere tokens del treasury al wallet del comprador
 */
async function transfer_tokens_to_buyer(
  wallet_address: string,
  token_amount: number,
  request_id: string,
): Promise<void> {
  loggerService.logInfo("🔄 Starting token transfer", {
    requestId: request_id,
    walletAddress: wallet_address,
    tokenAmount: token_amount,
  });

  const mint_address = process.env.TOKEN_MINT;
  if (!mint_address) {
    throw new Error("TOKEN_MINT not configured");
  }

  const treasury_address = PROWALLET_CONFIG.treasury_wallet;
  if (!treasury_address) {
    throw new Error("TREASURY_WALLET not configured");
  }

  // ✅ Cargar payer keypair directamente del .env
  let private_key_hex = process.env.TREASURY_PRIVATE_KEY;
  if (!private_key_hex) {
    throw new Error("TREASURY_PRIVATE_KEY not configured in .env");
  }

  // Limpiar espacios en blanco y saltos de línea
  private_key_hex = private_key_hex.replace(/\s/g, "");

  loggerService.logInfo("Debug: Keypair loading", {
    requestId: request_id,
    keyLength: private_key_hex.length,
    keyPreview: private_key_hex.substring(0, 20) + "...",
  });

  let payer: Keypair;
  try {
    // Convertir Base58 a buffer y crear Keypair
    const bs58 = require("bs58");
    const secret_key_buffer = Buffer.from(bs58.decode(private_key_hex));
    if (secret_key_buffer.length !== 64) {
      throw new Error(
        `Invalid secret key length: ${secret_key_buffer.length}, expected 64`,
      );
    }
    payer = Keypair.fromSecretKey(secret_key_buffer);
    loggerService.logInfo("✅ Keypair loaded successfully", {
      requestId: request_id,
      publicKey: payer.publicKey.toBase58(),
    });
  } catch (err) {
    loggerService.logError(err as Error, {
      requestId: request_id,
      context: "keypair_loading",
    });
    throw new Error(
      `Failed to load keypair: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }

  const connection = solanaService.getConnection();
  const mint = new PublicKey(mint_address);
  const user = new PublicKey(wallet_address);
  const treasury = new PublicKey(treasury_address);
  const decimals = PROWALLET_CONFIG.decimals;

  if (payer.publicKey.toBase58() !== treasury.toBase58()) {
    throw new Error(
      `Payer must be treasury. Got: ${payer.publicKey.toBase58()}`,
    );
  }

  // Obtener o crear ATA del usuario
  loggerService.logInfo("Getting user ATA", {
    requestId: request_id,
    user: user.toBase58(),
    mint: mint.toBase58(),
  });

  const user_ata = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    user,
  );

  // Obtener ATA del treasury (origen)
  const treasury_ata = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    treasury,
  );

  loggerService.logInfo("ATAs obtained", {
    requestId: request_id,
    userAta: user_ata.address.toBase58(),
    treasuryAta: treasury_ata.address.toBase58(),
    treasuryBalance: treasury_ata.amount.toString(),
  });

  // Validar saldo del treasury
  const amount_in_smallest_units = Math.round(
    token_amount * Math.pow(10, decimals),
  );

  if (treasury_ata.amount < BigInt(amount_in_smallest_units)) {
    throw new Error(
      `Insufficient treasury balance: ${treasury_ata.amount.toString()} < ${amount_in_smallest_units}`,
    );
  }

  // Crear instrucción de transfer
  const instruction = createTransferInstruction(
    treasury_ata.address,
    user_ata.address,
    treasury,
    BigInt(amount_in_smallest_units),
    [],
    TOKEN_PROGRAM_ID,
  );

  // Construir y enviar transacción
  const tx = new Transaction().add(instruction);
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  tx.sign(payer);

  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });

  loggerService.logInfo("✅ Token transfer TX sent", {
    requestId: request_id,
    signature: sig,
    walletAddress: wallet_address,
    tokenAmount: token_amount,
  });

  // Confirmar la transacción
  const confirmed = await confirm_transaction_with_retries(connection, sig, {
    maxRetries: 15,
    timeout: 120000,
  });

  if (!confirmed) {
    throw new Error(`Token transfer confirmation failed: ${sig}`);
  }

  loggerService.logInfo("✅ Token transfer confirmed", {
    requestId: request_id,
    signature: sig,
    walletAddress: wallet_address,
    tokenAmount: token_amount,
  });
}

export { confirm_transaction_in_background };
