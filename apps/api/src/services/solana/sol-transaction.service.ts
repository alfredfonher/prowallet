import { Transaction, PublicKey, SystemProgram } from "@solana/web3.js";

interface BuildSolTransactionParams {
  buyerKey: PublicKey;
  treasuryKey: PublicKey;
  totalCost: number;
  blockhash: string;
}

export async function buildSolTransaction({
  buyerKey,
  treasuryKey,
  totalCost,
  blockhash,
}: BuildSolTransactionParams): Promise<Transaction> {
  const transaction = new Transaction({
    recentBlockhash: blockhash,
    feePayer: buyerKey,
  });

  // ✅ Transferencia de SOL al treasury (programa estándar Solana)
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: buyerKey,
      toPubkey: treasuryKey,
      lamports: Math.round(totalCost * 1e9),
    }),
  );

  return transaction;
}
