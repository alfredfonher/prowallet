// Script: real-purchase.js
// Flujo automático de compra real con Solana y la API ProWallet
// Requiere: node, @solana/web3.js, dotenv, fetch (node >=18)
// Uso: node scripts/real-purchase.js <walletAddress> <tokenAmount>

const fs = require("fs");
const path = require("path");
const { Keypair, Connection, Transaction } = require("@solana/web3.js");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const fetch = global.fetch || require("node-fetch");

const API = "https://servicioshilda.orioncaribe.com/api/v1/purchase";
const SOLANA_RPC =
    process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const KEYPAIR_PATH = process.env.PROVIDER_WALLET || process.env.KEYPAIR_PATH;

if (!KEYPAIR_PATH || !fs.existsSync(KEYPAIR_PATH)) {
    console.error("No se encontró el archivo de keypair en", KEYPAIR_PATH);
    process.exit(1);
}

const keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(KEYPAIR_PATH)))
);

async function main() {
    const [walletAddress, tokenAmount] = process.argv.slice(2);
    if (!walletAddress || !tokenAmount) {
        console.log(
            "Uso: node scripts/real-purchase.js <walletAddress> <tokenAmount>"
        );
        process.exit(1);
    }
    console.log(
        "Iniciando compra para",
        walletAddress,
        "por",
        tokenAmount,
        "tokens"
    );

    // 0. Validar saldo de SOL antes de iniciar la compra
    const connection = new Connection(SOLANA_RPC, "confirmed");
    const pubkey = keypair.publicKey;
    const balanceLamports = await connection.getBalance(pubkey);
    const balanceSOL = balanceLamports / 1e9;
    console.log(
        `Saldo actual de la wallet (${pubkey.toBase58()}): ${balanceSOL} SOL`
    );

    // Consultar precio estimado de la compra
    const priceResp = await fetch(
        `${API.replace("/purchase", "/purchase/price")}?amount=${tokenAmount}`
    );
    const priceData = await priceResp.json();
    let totalCost = 0.01; // fallback
    if (priceData && priceData.data && priceData.data.totalCost) {
        totalCost = Number(priceData.data.totalCost) + 0.001; // sumar fee de red
    }
    console.log(`Costo estimado de la compra: ${totalCost} SOL (incluye fee)`);

    if (balanceSOL < totalCost) {
        console.error(
            `Saldo insuficiente. Necesitas al menos ${totalCost} SOL para esta compra.`
        );
        process.exit(1);
    }

    // 1. Iniciar compra
    const resp = await fetch(`${API}/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            walletAddress,
            tokenAmount: Number(tokenAmount),
            paymentMethod: "SOL",
            maxSlippage: 5,
        }),
    });
    const data = await resp.json();
    if (!data.success || !data.data || !data.data.txBase64) {
        console.error("Error al iniciar compra:", data);
        process.exit(1);
    }
    const { transactionId, txBase64 } = data.data;
    console.log("Transacción iniciada. ID:", transactionId);

    // 2. Decodificar y firmar la transacción
    const txBuffer = Buffer.from(txBase64, "base64");
    let transaction = Transaction.from(txBuffer);

    // 3. Actualizar blockhash (por seguridad)
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    // 4. Firmar con el keypair del usuario
    transaction.partialSign(keypair);
    const signedTx = transaction.serialize();

    // 5. Enviar la transacción a la red
    let signature;
    try {
        signature = await connection.sendRawTransaction(signedTx, {
            skipPreflight: false,
        });
        console.log("Transacción enviada. Signature:", signature);
    } catch (e) {
        console.error("Error al enviar la transacción:", e.message);
        process.exit(1);
    }

    // 6. Confirmar la compra en la API
    const confirmResp = await fetch(`${API}/confirm/${transactionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature }),
    });
    const confirmData = await confirmResp.json();
    if (confirmData.success) {
        console.log("Compra confirmada en la API:", confirmData.data);
    } else {
        console.error("Error al confirmar en la API:", confirmData);
    }
}

main().catch((e) => {
    console.error("Error general:", e);
    process.exit(1);
});
