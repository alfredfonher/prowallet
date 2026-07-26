import { transactionRepository, Transaction } from "../models/types";
import { solanaService } from "../services/solana.service";
import { confirm_transaction_with_retries } from "../services/solana/confirm-transaction.service";
import {
  PublicKey,
  LAMPORTS_PER_SOL,
  Keypair,
  Transaction as SolanaTransaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";

const TREASURY_WALLET = process.env.TREASURY_WALLET!;
const TOKEN_MINT = process.env.TOKEN_MINT!;
const AUTHORITY_KEYPAIR_PATH = process.env.AUTHORITY_KEYPAIR_PATH!;
const TOKEN_DECIMALS = parseInt(process.env.TOKEN_DECIMALS || "9");

const POLL_INTERVAL = 30000; // 30 segundos

function loadAuthorityKeypair() {
  const secret = JSON.parse(fs.readFileSync(AUTHORITY_KEYPAIR_PATH, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

async function findMatchingSolPayment(order: Transaction) {
  // Busca transacciones recientes hacia el treasury con el memo correcto
  const recentTxs = await solanaService.getRecentTransactions(
    TREASURY_WALLET,
    20,
  );
  for (const tx of recentTxs) {
    if (!tx.transaction) continue;
    const { transaction } = tx;
    const message = transaction.transaction.message;
    const compiledInstructions = message.compiledInstructions;
    // Soporte para mensajes legacy y v0
    let accountKeys;
    if (typeof message.getAccountKeys === "function") {
      // Mensaje v0
      const keys = message.getAccountKeys();
      accountKeys = keys.staticAccountKeys;
    } else if (
      message.version === undefined &&
      Array.isArray((message as any).accountKeys)
    ) {
      // Mensaje legacy
      accountKeys = (message as any).accountKeys;
    } else {
      throw new Error(
        "No se pudieron obtener las accountKeys del mensaje de la transacción",
      );
    }
    let foundTransfer = false;
    let foundMemo = false;
    let amountOk = false;
    for (const ix of compiledInstructions) {
      const programId = accountKeys[ix.programIdIndex]?.toString();
      // Transferencia de SOL
      if (programId === SystemProgram.programId.toString()) {
        // Busca destino y monto
        const toPubkey = accountKeys[ix.accountKeyIndexes[1]]?.toString();
        if (toPubkey === TREASURY_WALLET) {
          foundTransfer = true;
          // Monto
          const data = Buffer.from(ix.data);
          if (data.length === 8) {
            const lamports = data.readBigUInt64LE(0);
            const sol = Number(lamports) / LAMPORTS_PER_SOL;
            if (Math.abs(sol - (order.paymentAmount || 0)) < 0.0001)
              amountOk = true;
          }
        }
      }
      // Memo
      if (programId === "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr") {
        const memo = Buffer.from(ix.data).toString();
        if (memo === `GAPC-PURCHASE-${order.transactionId}`) foundMemo = true;
      }
    }
    if (foundTransfer && foundMemo && amountOk && !tx.err) {
      return tx;
    }
  }
  return null;
}

async function transfer_prowallet_to_user(order: Transaction) {
  const authority = loadAuthorityKeypair();
  const userWallet = new PublicKey(order.walletAddress);
  const mint = new PublicKey(TOKEN_MINT);
  const treasury = new PublicKey(TREASURY_WALLET);
  const userAta = await getAssociatedTokenAddress(mint, userWallet);
  const treasuryAta = await getAssociatedTokenAddress(mint, treasury);
  // Verifica que el usuario tenga ATA, si no, lo crea (opcional)
  // Prepara instrucción de transferencia SPL
  const amount = BigInt(
    Math.floor(order.tokenAmount * Math.pow(10, TOKEN_DECIMALS)),
  );
  const ix = createTransferInstruction(
    treasuryAta,
    userAta,
    authority.publicKey,
    amount,
    [],
    TOKEN_PROGRAM_ID,
  );
  const tx = new SolanaTransaction().add(ix);
  tx.feePayer = authority.publicKey;
  const blockhash = (await solanaService.getConnection().getLatestBlockhash())
    .blockhash;
  tx.recentBlockhash = blockhash;
  tx.sign(authority);
  const rawTx = tx.serialize();
  const sig = await solanaService.getConnection().sendRawTransaction(rawTx);
  // Confirmar con reintentos robustos
  const confirmed = await confirm_transaction_with_retries(
    solanaService.getConnection(),
    sig,
    { maxRetries: 15, timeout: 120000 },
  );
  if (!confirmed) {
    throw new Error(`Transacción no confirmada: ${sig}`);
  }
  return sig;
}

async function processPendingOrders() {
  const pendingOrders = await transactionRepository.find({
    status: "pending",
    paymentToken: "SOL",
  });
  for (const order of pendingOrders) {
    try {
      const paymentTx = await findMatchingSolPayment(order);
      if (!paymentTx) continue;
      // Ya pagó, transfiere tokens
      const sig = await transfer_prowallet_to_user(order);
      await transactionRepository.update(
        { transactionId: order.transactionId },
        {
          status: "success",
          signature: sig,
          completedAt: new Date(),
          minted: true,
          minting: false,
          mintSignature: sig,
        },
      );

      // Emitir notificación SSE para frontends suscritos
      try {
        const { notificationsService } =
          await import("../services/notifications.service");
        await notificationsService.broadcast("purchase.completed", {
          transactionId: order.transactionId,
          walletAddress: order.walletAddress,
          tokenAmount: order.tokenAmount,
          minted: true,
          mintSignature: sig,
        });
      } catch (e) {
        console.warn("Failed to broadcast purchase.completed from worker", e);
      }
      console.log(
        `✔️ Orden ${order.transactionId} liquidada. Signature: ${sig}`,
      );
    } catch (e) {
      await transactionRepository.update(
        { transactionId: order.transactionId },
        {
          status: "failed",
        },
      );
      console.error(`❌ Error liquidando orden ${order.transactionId}:`, e);
    }
  }
}

async function startSettlementWorker() {
  while (true) {
    await processPendingOrders();
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}

if (require.main === module) {
  startSettlementWorker();
}

export { startSettlementWorker };
