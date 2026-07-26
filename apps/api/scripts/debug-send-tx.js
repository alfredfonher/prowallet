const fs = require("fs");
const path = require("path");
const {
    Connection,
    Keypair,
    Transaction,
    SendTransactionError,
} = require("@solana/web3.js");
const fetch = global.fetch || require("node-fetch");

(async () => {
    try {
        const baseUrl =
            process.env.API_BASE || "https://servicioshilda.orioncaribe.com/";
        const rpcUrl =
            process.env.SOLANA_RPC || "https://api.devnet.solana.com";

        // Load keypair
        const kpPath = path.resolve(
            __dirname,
            "..",
            "..",
            "prowallet-wallet-file",
            "myKeypair.json"
        );
        if (!fs.existsSync(kpPath)) {
            console.error("Keypair file not found:", kpPath);
            process.exit(1);
        }
        const secret = JSON.parse(fs.readFileSync(kpPath, "utf8"));
        const keypair = Keypair.fromSecretKey(new Uint8Array(secret));
        console.log("Loaded keypair, publicKey=", keypair.publicKey.toString());

        const connection = new Connection(rpcUrl, "confirmed");

        // Initiate purchase
        const initiateResp = await fetch(
            `${baseUrl}/api/v1/purchase/initiate`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    walletAddress: keypair.publicKey.toString(),
                    tokenAmount: 10,
                }),
            }
        );

        const initiateJson = await initiateResp.json();
        console.log(
            "Initiate response status=",
            initiateResp.status,
            "body=",
            initiateJson
        );

        if (!initiateJson?.data?.txBase64) {
            console.error("No txBase64 in initiate response");
            process.exit(1);
        }

        const txBase64 = initiateJson.data.txBase64;
        const txBuffer = Buffer.from(txBase64, "base64");
        let tx = Transaction.from(txBuffer);

        // Ensure feePayer and set a fresh recentBlockhash just before signing
        tx.feePayer = keypair.publicKey;
        try {
            const latest = await connection.getLatestBlockhash("finalized");
            tx.recentBlockhash = latest.blockhash || latest;
            console.log("Set recentBlockhash from RPC:", tx.recentBlockhash);
        } catch (e) {
            console.warn(
                "Could not fetch latest blockhash, continuing with existing value",
                e
            );
        }

        // Sign with local keypair
        tx.partialSign(keypair);

        const raw = tx.serialize();

        try {
            console.log("Sending transaction...");
            const sig = await connection.sendRawTransaction(raw, {
                skipPreflight: false,
                preflightCommitment: "finalized",
            });
            console.log("Sent, signature=", sig);
            const conf = await connection.confirmTransaction(sig, "finalized");
            console.log("Confirm result:", conf);
        } catch (err) {
            console.error(
                "Send error:",
                err && err.message ? err.message : err
            );
            // Try to print logs if available
            if (err && typeof err === "object") {
                // @solana/web3.js SendTransactionError in Node may include logs or simulation
                if (Array.isArray(err.logs)) {
                    console.error("RPC logs:", err.logs);
                }
                if (typeof err.getLogs === "function") {
                    try {
                        const logs = await err.getLogs();
                        console.error("getLogs() =>", logs);
                    } catch (glErr) {
                        console.error("getLogs() failed:", glErr);
                    }
                }
            }
        }
    } catch (e) {
        console.error("Fatal error in debug script:", e);
        process.exit(1);
    }
})();
