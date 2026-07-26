const { Keypair, Transaction } = require("@solana/web3.js");
const fs = require("fs");

(async () => {
    try {
        const keyBytes = JSON.parse(
            fs.readFileSync("../prowallet-wallet-file/myKeypair.json", "utf8")
        );
        const keypair = Keypair.fromSecretKey(new Uint8Array(keyBytes));
        const pubkey = keypair.publicKey.toString();
        console.log("Using wallet:", pubkey);

        // 1) initiate purchase
        const initiateRes = await fetch(
            "https://servicioshilda.orioncaribe.com/api/v1/purchase/initiate",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    walletAddress: pubkey,
                    tokenAmount: 10,
                    paymentMethod: "SOL",
                }),
            }
        );

        const initiateJson = await initiateRes.json();
        console.log("Initiate response:", initiateJson);

        if (!initiateJson.success) {
            console.error("Initiate failed");
            process.exit(1);
        }

        const txBase64 = initiateJson.data.txBase64;
        const raw = Buffer.from(txBase64, "base64");
        const tx = Transaction.from(raw);

        // Sign locally
        tx.partialSign(keypair);
        const signed = tx.serialize({ requireAllSignatures: false });
        const signedBase64 = Buffer.from(signed).toString("base64");

        // Confirm
        const confirmRes = await fetch(
            "https://servicioshilda.orioncaribe.com/api/v1/purchase/confirm",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    signedTransaction: signedBase64,
                    fromWallet: pubkey,
                }),
            }
        );

        const confirmJson = await confirmRes.json();
        console.log("Confirm response:", confirmJson);
    } catch (e) {
        console.error("Error in test script", e);
        process.exit(1);
    }
})();
