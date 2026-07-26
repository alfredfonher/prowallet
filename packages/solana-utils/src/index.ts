import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  transfer,
  getAccount,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export async function createMintToken(
  connection: Connection,
  payer: Keypair,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null,
  decimals = 9,
) {
  const mint = await createMint(
    connection,
    payer,
    mintAuthority,
    freezeAuthority,
    decimals,
  );
  return mint;
}

export async function ensureAssociatedTokenAccount(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey,
) {
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    owner,
  );
  return ata;
}

export async function mintToAccount(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  destination: PublicKey,
  authority: Keypair,
  amount: number,
) {
  const sig = await mintTo(
    connection,
    payer,
    mint,
    destination,
    authority,
    BigInt(amount),
  );
  return sig;
}

export async function transferTokens(
  connection: Connection,
  payer: Keypair,
  source: PublicKey,
  dest: PublicKey,
  owner: Keypair,
  amount: number,
) {
  const sig = await transfer(
    connection,
    payer,
    source,
    dest,
    owner,
    BigInt(amount),
  );
  return sig;
}

export async function getTokenAccountInfo(
  connection: Connection,
  tokenAccount: PublicKey,
) {
  const info = await getAccount(connection, tokenAccount);
  return info;
}

export async function executeWithdrawDirect(
  connection: Connection,
  relayerKeypair: Keypair,
  escrowTokenAccount: string,
  destTokenAccount: string,
  amount: number,
) {
  const escrow = new PublicKey(escrowTokenAccount);
  const dest = new PublicKey(destTokenAccount);

  const transferIx = createTransferInstruction(
    escrow,
    dest,
    relayerKeypair.publicKey,
    BigInt(amount),
    [],
    TOKEN_PROGRAM_ID,
  );

  const tx = new Transaction().add(transferIx);
  const sig = await sendAndConfirmTransaction(connection, tx, [relayerKeypair]);
  return { sig };
}

export default {
  createMintToken,
  ensureAssociatedTokenAccount,
  mintToAccount,
  transferTokens,
  getTokenAccountInfo,
  executeWithdrawDirect,
};
