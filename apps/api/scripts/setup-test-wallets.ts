/**
 * Setup Test Wallets - Creates Associated Token Accounts (ATAs) for test wallets
 *
 * This script creates token accounts for test wallets so they can receive transfers
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// Configuration
const NETWORK = "mainnet-beta";
const RPC_URL = "https://api.mainnet-beta.solana.com";
const TOKEN_MINT = new PublicKey(
  "D8TwbwGGmyucrxPB9uscait27caVgeqYHPpyN3XXjUX3",
);

// Test wallets that need ATA setup
const TEST_WALLETS = [
  {
    name: "Wallet 1 (Source)",
    address: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
  },
  {
    name: "Wallet 2 (Dest)",
    address: "HEuSx6DRcQm7mbvdrstMpJaCQBdA2tK6gH1M6RnWHjbw",
  },
];

// Keypair for funding/signing (this should be your admin wallet)
// For safety, we'll read this from a file or environment
const PAYER_KEYPAIR_PATH = path.join(__dirname, "../../../comprador1.json");

async function main() {
  console.log(`\n🔐 Setup Test Wallets ATAs`);
  console.log(`Network: ${NETWORK}`);
  console.log(`Token Mint: ${TOKEN_MINT.toString()}\n`);

  // Connect to Solana
  const connection = new Connection(RPC_URL, "confirmed");

  // Load payer keypair
  if (!fs.existsSync(PAYER_KEYPAIR_PATH)) {
    console.error(`❌ Payer keypair not found at ${PAYER_KEYPAIR_PATH}`);
    console.log(`📝 You need to provide a keypair file to fund ATA creation`);
    return;
  }

  const payerSecretKey = JSON.parse(
    fs.readFileSync(PAYER_KEYPAIR_PATH, "utf-8"),
  );
  const payer = Keypair.fromSecretKey(new Uint8Array(payerSecretKey));

  console.log(`👤 Payer: ${payer.publicKey.toString()}`);
  console.log(`💰 Checking balance...`);

  const balance = await connection.getBalance(payer.publicKey);
  const solBalance = balance / 1e9;
  console.log(`   Balance: ${solBalance} SOL\n`);

  if (solBalance < 0.01) {
    console.error(
      `❌ Insufficient balance to create ATAs (need at least 0.01 SOL)`,
    );
    return;
  }

  // For each test wallet, create ATA if needed
  for (const wallet of TEST_WALLETS) {
    console.log(`\n📝 Processing ${wallet.name}`);
    console.log(`   Address: ${wallet.address}`);

    const walletPubkey = new PublicKey(wallet.address);

    // Get ATA address
    const ata = await getAssociatedTokenAddress(TOKEN_MINT, walletPubkey);
    console.log(`   ATA: ${ata.toString()}`);

    // Check if ATA exists
    const ataInfo = await connection.getAccountInfo(ata);

    if (ataInfo) {
      console.log(`   ✓ ATA already exists`);
    } else {
      console.log(`   ⚠️  ATA does not exist, creating...`);

      // Build transaction to create ATA
      const tx = new Transaction();

      tx.add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey, // payer
          ata, // associated token account to create
          walletPubkey, // owner
          TOKEN_MINT, // mint
        ),
      );

      tx.feePayer = payer.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      try {
        const signature = await sendAndConfirmTransaction(connection, tx, [
          payer,
        ]);

        console.log(`   ✅ ATA created! Tx: ${signature.substring(0, 8)}...`);
      } catch (error) {
        console.error(
          `   ❌ Failed to create ATA: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  console.log(`\n✅ Setup complete!\n`);
}

main().catch(console.error);
