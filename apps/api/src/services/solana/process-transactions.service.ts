import { Transaction, PublicKey } from "@solana/web3.js";
import { solanaService } from "../solana.service";
import { PurchaseResult } from "./types";
import { PROWALLET_CONFIG } from "../../config";
import { confirm_transaction_with_retries } from "./confirm-transaction.service";

/**
 * Procesa una compra de tokens en dos pasos:
 * 1. Transferencia de SOL (firmada por buyer y treasury)
 * 2. Mint de tokens (firmada por buyer y authority)
 */
export async function processPurchase(
  _buyerAddress: string,
  _tokenAmount: number,
  _totalCost: number,
  buyerSignedSolTx: string,
  buyerSignedMintTx: string,
): Promise<PurchaseResult> {
  const connection = solanaService.getConnection();

  // 1. Procesar transferencia de SOL
  console.log("[Transaction] Processing SOL transfer...");
  const solTx = Transaction.from(Buffer.from(buyerSignedSolTx, "base64"));
  console.log("[Transaction] SOL transaction decoded successfully");

  // Verificar que el treasury firme la transacción SOL
  if (!PROWALLET_CONFIG.treasury_wallet) {
    throw new Error("Treasury wallet is not configured");
  }
  const treasuryKey = new PublicKey(PROWALLET_CONFIG.treasury_wallet);
  if (!solTx.verifySignatures()) {
    throw new Error("Invalid signatures on SOL transaction");
  }
  if (!solTx.signatures.some((sig) => sig.publicKey.equals(treasuryKey))) {
    throw new Error("Treasury signature required for SOL transaction");
  }

  const solTxId = await connection.sendRawTransaction(solTx.serialize());
  const sol_confirmed = await confirm_transaction_with_retries(
    connection,
    solTxId,
    {
      maxRetries: 15,
      timeout: 120000, // 2 minutos
    },
  );

  if (!sol_confirmed) {
    throw new Error(`SOL transfer no confirmada: ${solTxId}`);
  }

  console.log("[Transaction] SOL transfer confirmed:", solTxId);
  console.log("[Transaction] SOL transfer details:", {
    from: solTx.feePayer?.toString(),
    to: PROWALLET_CONFIG.treasury_wallet,
    txId: solTxId,
  });

  // 2. Procesar mint de tokens
  console.log("[Transaction] Processing token mint...");
  const mintTx = Transaction.from(Buffer.from(buyerSignedMintTx, "base64"));
  console.log("[Transaction] Mint transaction decoded successfully");

  // Verificar que la authority firme la transacción de mint
  if (!process.env.AUTHORITY_WALLET) {
    throw new Error("Authority wallet is not configured");
  }
  const authorityKey = new PublicKey(process.env.AUTHORITY_WALLET);
  if (!mintTx.verifySignatures()) {
    throw new Error("Invalid signatures on mint transaction");
  }
  if (!mintTx.signatures.some((sig) => sig.publicKey.equals(authorityKey))) {
    throw new Error("Authority signature required for mint transaction");
  }

  const mintTxId = await connection.sendRawTransaction(mintTx.serialize());
  const mint_confirmed = await confirm_transaction_with_retries(
    connection,
    mintTxId,
    {
      maxRetries: 15,
      timeout: 120000, // 2 minutos
    },
  );

  if (!mint_confirmed) {
    throw new Error(`Token mint no confirmada: ${mintTxId}`);
  }

  console.log("[Transaction] Token mint confirmed:", mintTxId);
  console.log("[Transaction] Mint details:", {
    authority: process.env.AUTHORITY_WALLET,
    txId: mintTxId,
  });

  return {
    solTxId,
    mintTxId,
  };
}
