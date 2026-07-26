import { Transaction, PublicKey } from "@solana/web3.js";
import { PurchaseTransactions } from "./types";
import { PROWALLET_CONFIG } from "../../config";
import { solanaService } from "../solana.service";
import { buildSolTransaction } from "./sol-transaction.service";
import { buildMintTransaction } from "./mint-transaction.service";

/**
 * Construye dos transacciones separadas:
 * 1. Transferencia de SOL (programa estándar Solana)
 * 2. Mint de tokens + creación de ATA si es necesario (programa SPL Token)
 */
export async function buildPurchaseTransactions(
  buyerAddress: string,
  tokenAmount: number,
  totalCost: number,
): Promise<PurchaseTransactions> {
  try {
    // Validar direcciones
    if (!buyerAddress) {
      throw new Error("Buyer address is required");
    }
    if (!PROWALLET_CONFIG.treasury_wallet) {
      throw new Error("Treasury wallet is not configured");
    }
    if (!PROWALLET_CONFIG.token_mint) {
      throw new Error("Token mint address is not configured");
    }
    if (!process.env.AUTHORITY_WALLET) {
      throw new Error("Mint authority wallet is not configured");
    }

    // Validar los montos
    if (tokenAmount <= 0) {
      throw new Error("Token amount must be greater than 0");
    }
    if (totalCost <= 0) {
      throw new Error("Total cost must be greater than 0");
    }

    // Convertir direcciones a PublicKey
    const buyerKey = new PublicKey(buyerAddress);
    const treasuryKey = new PublicKey(PROWALLET_CONFIG.treasury_wallet);
    const mintKey = new PublicKey(PROWALLET_CONFIG.token_mint);
    const authorityKey = new PublicKey(process.env.AUTHORITY_WALLET);

    if (!PublicKey.isOnCurve(buyerKey.toBuffer())) {
      throw new Error("Invalid buyer address");
    }

    // Obtener el recentBlockhash
    const connection = solanaService.getConnection();
    const { blockhash } = await connection.getLatestBlockhash();

    // 1. Construir transacción de SOL (usuario firma esto)
    const solTransaction = await buildSolTransaction({
      buyerKey,
      treasuryKey,
      totalCost,
      blockhash,
    });

    // 2. Construir transacción de mint (backend firma esto)
    const mintTransaction = await buildMintTransaction({
      buyerKey,
      mintKey,
      authorityKey,
      tokenAmount,
      blockhash,
      connection,
    });

    return {
      solTransaction,
      mintTransaction,
    };
  } catch (error) {
    throw new Error(
      `Failed to build purchase transactions: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}
