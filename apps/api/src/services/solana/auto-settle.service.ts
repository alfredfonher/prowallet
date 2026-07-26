import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { solanaService } from "../solana.service";
import { buildMintTransaction } from "./mint-transaction.service";
import { PROWALLET_CONFIG } from "../../config";
import { loadPayerKeypair } from "./load-payer";
import { confirm_transaction_with_retries } from "./confirm-transaction.service";

export async function autoSettlePurchase(
  buyer: string,
  tokenAmount: number,
  paymentSignature: string,
): Promise<{ success: boolean; signature?: string }> {
  const connection: Connection = solanaService.getConnection();

  // 1) Verificar que la transacción de pago existe y fue confirmada
  const onchain = await connection.getTransaction(paymentSignature, {
    maxSupportedTransactionVersion: 0,
  });
  if (!onchain) {
    throw new Error("Payment transaction not found on chain");
  }

  // 2) Construir y enviar transacción de mint con la autoridad
  const mintKey = new PublicKey(PROWALLET_CONFIG.token_mint as string);
  const buyerKey = new PublicKey(buyer);
  const authorityKeypair = await loadPayerKeypair();

  const latest = await connection.getLatestBlockhash();
  const mintTx: Transaction = await buildMintTransaction({
    buyerKey,
    mintKey,
    authorityKey: authorityKeypair.publicKey,
    tokenAmount,
    blockhash: latest.blockhash,
    connection,
  });

  mintTx.feePayer = authorityKeypair.publicKey;

  // Send signed transaction with authority keypair
  const signature = await connection.sendTransaction(mintTx, [
    authorityKeypair,
  ]);

  // Usar confirmación mejorada con reintentos
  const confirmed = await confirm_transaction_with_retries(
    connection,
    signature,
    {
      maxRetries: 15,
      timeout: 120000, // 2 minutos
    },
  );

  if (!confirmed) {
    throw new Error(`Transacción no confirmada: ${signature}`);
  }

  return { success: true, signature };
}

export default autoSettlePurchase;
