import {
  Keypair,
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getAccount,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import fs from "fs";

export interface TransferParams {
  connection: Connection;
  authorityKeypairPath: string;
  mintPubkey: PublicKey;
  destinationPubkey: PublicKey;
  amountTokens: number; // human tokens (not lamports)
  decimals: number;
}

function loadKeypairFromFile(fp: string): Keypair {
  const raw = fs.readFileSync(fp, "utf8");
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed))
    return Keypair.fromSecretKey(Uint8Array.from(parsed));
  if (parsed.secretKey && Array.isArray(parsed.secretKey))
    return Keypair.fromSecretKey(Uint8Array.from(parsed.secretKey));
  if (parsed._keypair && Array.isArray(parsed._keypair.secretKey))
    return Keypair.fromSecretKey(Uint8Array.from(parsed._keypair.secretKey));
  throw new Error("Invalid keypair file format");
}

export async function transferTokens(params: TransferParams): Promise<string> {
  const {
    connection,
    authorityKeypairPath,
    mintPubkey,
    destinationPubkey,
    amountTokens,
    decimals,
  } = params;
  const authority = loadKeypairFromFile(authorityKeypairPath);

  // Ensure authority's token account (sender) - typically provider/treasury token account
  // For safety, attempt to derive associated token account for authority
  const authorityTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    authority,
    mintPubkey,
    authority.publicKey,
  );

  // Ensure destination ATA exists (creates it with payer = authority)
  const destAta = await getOrCreateAssociatedTokenAccount(
    connection,
    authority,
    mintPubkey,
    destinationPubkey,
  );

  const amountRaw = BigInt(Math.round(amountTokens * Math.pow(10, decimals)));

  // Build transfer instruction
  const transferIx = createTransferInstruction(
    authorityTokenAccount.address,
    destAta.address,
    authority.publicKey,
    amountRaw,
  );

  const tx = new Transaction();
  tx.add(transferIx);

  const sig = await sendAndConfirmTransaction(connection, tx, [authority]);
  return sig;
}
