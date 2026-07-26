import { Transaction, PublicKey, Connection } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from "@solana/spl-token";
import { PROWALLET_CONFIG } from "../../config";

interface BuildMintTransactionParams {
  buyerKey: PublicKey;
  mintKey: PublicKey;
  authorityKey: PublicKey;
  tokenAmount: number;
  blockhash: string;
  connection: Connection;
}

export async function buildMintTransaction({
  buyerKey,
  mintKey,
  authorityKey,
  tokenAmount,
  blockhash,
  connection,
}: BuildMintTransactionParams): Promise<Transaction> {
  const transaction = new Transaction({
    recentBlockhash: blockhash,
    feePayer: authorityKey, // Authority pays fees AND must sign
  });

  // 1. Get/create ATA for buyer
  const buyerATA = await getAssociatedTokenAddress(mintKey, buyerKey);
  const buyerATAInfo = await connection.getAccountInfo(buyerATA);

  if (!buyerATAInfo) {
    console.log("Creating ATA for buyer:", buyerATA.toString());
    transaction.add(
      createAssociatedTokenAccountInstruction(
        authorityKey, // payer (authority must sign)
        buyerATA,
        buyerKey,
        mintKey,
      ),
    );
  }

  // 2. Get treasury ATA (where tokens are stored)
  const treasuryATA = await getAssociatedTokenAddress(mintKey, authorityKey);
  const treasuryATAInfo = await connection.getAccountInfo(treasuryATA);

  if (!treasuryATAInfo) {
    throw new Error(
      `Treasury ATA not found at ${treasuryATA.toString()}. Ensure treasury wallet has tokens.`,
    );
  }

  // 3. Create transfer instruction
  const transferAmount = Math.round(
    tokenAmount * Math.pow(10, PROWALLET_CONFIG.decimals || 9),
  );

  console.log("Transfer info:", {
    from: treasuryATA.toString(),
    to: buyerATA.toString(),
    amount: transferAmount,
    owner: authorityKey.toString(),
    note: "Authority is the owner/signer of treasuryATA",
  });

  // IMPORTANTE: createTransferInstruction requiere que owner sea un signer
  // Cuando connection.sendTransaction() se llama con [authorityKeypair],
  // la autoridad DEBE estar registrada como requerida en la transacción
  // Esto sucede automáticamente porque creamos la instrucción con authorityKey como owner
  transaction.add(
    createTransferInstruction(
      treasuryATA, // source token account
      buyerATA, // destination token account
      authorityKey, // owner of source (MUST BE A SIGNER)
      transferAmount, // amount to transfer
    ),
  );

  console.log("✅ Transaction built with:", {
    feePayer: transaction.feePayer?.toString(),
    instructions: transaction.instructions.length,
    message:
      "Authority is registered as required signer via feePayer and transfer instruction owner",
  });

  return transaction;
}
