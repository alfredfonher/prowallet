import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { createTransferInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";

export function createConnection(rpcUrl: string) {
  return new Connection(rpcUrl);
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
