import { databaseService } from "../services/database/database.service";
import { solanaService } from "../services/solana.service";
import { buildMintTransaction } from "../services/solana/mint-transaction.service";
import { loadPayerKeypair } from "../services/solana/load-payer";
import { confirm_transaction_with_retries } from "../services/solana/confirm-transaction.service";
import { PublicKey } from "@solana/web3.js";

const POLL_INTERVAL = parseInt(
  process.env.WITHDRAW_POLL_INTERVAL || "8000",
  10,
);
let intervalHandle: NodeJS.Timeout | null = null;

export const withdrawProcessorService = {
  start: () => {
    if (intervalHandle) return;
    intervalHandle = setInterval(async () => {
      try {
        const prisma = databaseService.getClient();
        // Buscar la siguiente transacción de retiro marcada como pendingOnChain
        const pending = await prisma.transaction.findFirst({
          where: {
            transactionType: "transfer",
            minted: false,
            minting: false,
          },
          orderBy: { createdAt: "asc" },
        });

        if (!pending) return;

        // Skip if already has minting flag
        if ((pending as any).minting) return;

        // Confirm the metadata has a target address
        const to = (pending.metadata && (pending.metadata as any).to) || null;
        if (!to) {
          await prisma.transaction.update({
            where: { id: pending.id },
            data: {
              status: "failed",
              error: "No recipient address in metadata",
            },
          });
          return;
        }

        // Mark as minting
        await prisma.transaction.update({
          where: { id: pending.id },
          data: { minting: true, mintStartedAt: new Date() },
        });

        const connection = solanaService.getConnection();
        const authorityKeypair = await loadPayerKeypair();
        const mintAddress = process.env.TOKEN_MINT;
        if (!mintAddress) throw new Error("TOKEN_MINT not configured");

        const buyerKey = new PublicKey(to);
        const mintKey = new PublicKey(mintAddress);

        const latest = await connection.getLatestBlockhash();
        const mintTx = await buildMintTransaction({
          buyerKey,
          mintKey,
          authorityKey: authorityKeypair.publicKey,
          tokenAmount: Math.abs(pending.tokenAmount),
          blockhash: latest.blockhash,
          connection,
        });

        // Fee payer should be authority
        mintTx.feePayer = authorityKeypair.publicKey;

        // Send and confirm
        const signature = await connection.sendTransaction(mintTx, [
          authorityKeypair,
        ]);
        const confirmed = await confirm_transaction_with_retries(
          connection,
          signature,
          { maxRetries: 15, timeout: 120000 },
        );

        if (!confirmed) {
          throw new Error(`Transacción no confirmada: ${signature}`);
        }

        // Get onchain info
        const onchain = await connection.getTransaction(signature);
        const slot = onchain ? onchain.slot : null;
        const feeLamports = onchain && onchain.meta ? onchain.meta.fee : null;
        const gasCost =
          feeLamports !== null && feeLamports !== undefined
            ? feeLamports / 1e9
            : null;

        // Update transaction
        await prisma.transaction.update({
          where: { id: pending.id },
          data: {
            mintSignature: signature,
            minted: true,
            minting: false,
            completedAt: new Date(),
            metadata: {
              ...(pending.metadata as any),
              onchainSignature: signature,
              onchainSlot: slot,
              onchainFee: gasCost,
              pendingOnChain: false,
            },
          },
        });

        // Done
      } catch (err) {
        console.error("Withdraw processor error:", err);
        try {
          if (intervalHandle == null) return;
          // Attempt to mark transaction failed when possible
        } catch (e) {
          console.error("Failed to update transaction after withdraw error", e);
        }
      }
    }, POLL_INTERVAL);
    console.log("Withdraw processor started, interval:", POLL_INTERVAL);
  },
  stop: () => {
    if (!intervalHandle) return;
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("Withdraw processor stopped");
  },
};

export default withdrawProcessorService;
