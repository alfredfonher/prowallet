import { Transaction, PublicKey, Connection } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";

type BuildParams = {
  connection?: Connection; // NOW required to check if ATAs exist
  mint_pubkey: string | PublicKey;
  from_pubkey: string | PublicKey;
  to_pubkey: string | PublicKey;
  amount_tokens: number;
  decimals: number;
  recent_blockhash: string;
};

type TransactionBuildResult = {
  transaction: Transaction;
  ataNeedsCreation: boolean;
  estimatedFees: {
    tokenTransferFee: number; // In SOL (~0.000005)
    ataCreationFee: number; // In SOL (~0.002) if needed
    totalFee: number; // Sum of both
  };
};

/**
 * Build a P2P token transfer transaction with automatic ATA creation
 *
 * IMPORTANT: This function now automatically creates the destination Associated Token Account (ATA)
 * if it doesn't exist. This prevents "invalid account data for instruction" errors when transferring
 * to wallets that haven't received this token before.
 *
 * How it works:
 * 1. Derive both source and destination ATAs for the given token mint
 * 2. Check if destination ATA exists on-chain
 * 3. If destination ATA is missing:
 *    - Add a createAssociatedTokenAccountInstruction to the transaction
 *    - Source wallet pays for ATA creation (~0.002 SOL)
 * 4. Add the transfer instruction
 * 5. Return the transaction for client signing
 *
 * Error cases:
 * - If source wallet doesn't have enough SOL for ATA creation + tx fees, the transaction will
 *   succeed creation but fail during blockchain execution
 * - If source wallet doesn't own tokens to transfer, transfer instruction will fail
 *
 * @param params Transfer parameters including source, destination, amount, and connection
 * @returns Transaction ready to be signed by source wallet
 */
export default async function build_p2p_token_transaction(
  params: BuildParams,
): Promise<TransactionBuildResult> {
  const {
    connection,
    mint_pubkey,
    from_pubkey,
    to_pubkey,
    amount_tokens,
    decimals,
    recent_blockhash,
  } = params;

  if (!connection) {
    throw new Error("Connection is required to build P2P transaction");
  }

  const mint =
    typeof mint_pubkey === "string" ? new PublicKey(mint_pubkey) : mint_pubkey;
  const from =
    typeof from_pubkey === "string" ? new PublicKey(from_pubkey) : from_pubkey;
  const to =
    typeof to_pubkey === "string" ? new PublicKey(to_pubkey) : to_pubkey;

  // Derive ATAs
  const fromAta = await getAssociatedTokenAddress(mint, from);
  const toAta = await getAssociatedTokenAddress(mint, to);

  // ✅ FIX: Check if destination ATA exists, create if needed
  // This prevents "invalid account data for instruction" error
  const toAtaInfo = await connection.getAccountInfo(toAta);
  const ataNeedsCreation = !toAtaInfo;

  console.log(`[TRANSFER-P2P] Destination ATA check:`, {
    address: toAta.toString(),
    exists: !!toAtaInfo,
    owner: toAtaInfo?.owner.toString(),
  });

  // Convert token amount to raw units
  const rawAmount = BigInt(Math.floor(amount_tokens * Math.pow(10, decimals)));

  const tx = new Transaction();

  // ✅ If destination ATA doesn't exist, create it
  // The source wallet pays for the ATA creation (payer = from)
  if (ataNeedsCreation) {
    console.log(
      `[TRANSFER-P2P] Creating ATA for destination: ${toAta.toString()}`,
    );
    tx.add(
      createAssociatedTokenAccountInstruction(
        from, // payer (from wallet pays to create the ATA)
        toAta, // new ATA to create
        to, // owner of the ATA
        mint, // token mint
      ),
    );
  }

  // Add transfer instruction
  const transferIx = createTransferInstruction(fromAta, toAta, from, rawAmount);
  tx.add(transferIx);

  tx.recentBlockhash = recent_blockhash;
  tx.feePayer = from;

  // Calculate fees
  // Network fees: ~0.000005 SOL for token transfer
  // ATA creation (if needed): ~0.002 SOL
  const tokenTransferFee = 0.000005;
  const ataCreationFee = ataNeedsCreation ? 0.002 : 0;
  const totalFee = tokenTransferFee + ataCreationFee;

  console.log(`[TRANSFER-P2P] Transaction built:`, {
    fromAta: fromAta.toString(),
    toAta: toAta.toString(),
    rawAmount: rawAmount.toString(),
    instructions: tx.instructions.length,
    ataNeedsCreation,
    estimatedFees: {
      tokenTransferFee,
      ataCreationFee,
      totalFee,
    },
  });

  return {
    transaction: tx,
    ataNeedsCreation,
    estimatedFees: {
      tokenTransferFee,
      ataCreationFee,
      totalFee,
    },
  };
}
