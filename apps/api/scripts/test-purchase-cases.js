const {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
} = require("@solana/web3.js");
const fs = require("fs");

const BUYER_ADDRESS = "3deLF3EPKKSGFJPyESx7igyeXZgXjWe1z5JoE5ZqG2Uw";
const API_URL = "https://servicioshilda.orioncaribe.com/";

async function testPurchaseCases() {
    console.log("🧪 Iniciando pruebas de compra con wallet:", BUYER_ADDRESS);

    try {
        // Test Case 1: Validar monto mínimo
        console.log("\n📝 Test 1: Monto mínimo");
        const minTest = await fetch(`${API_URL}/api/v1/purchase/initiate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                walletAddress: BUYER_ADDRESS,
                tokenAmount: 1, // Debería fallar por ser menor al mínimo
                paymentMethod: "SOL",
            }),
        });
        console.log("Resultado:", await minTest.json());

        // Test Case 2: Validar monto máximo
        console.log("\n📝 Test 2: Monto máximo");
        const maxTest = await fetch(`${API_URL}/api/v1/purchase/initiate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                walletAddress: BUYER_ADDRESS,
                tokenAmount: 1000000, // Debería fallar por exceder máximo
                paymentMethod: "SOL",
            }),
        });
        console.log("Resultado:", await maxTest.json());

        // Test Case 3: Slippage excesivo
        console.log("\n📝 Test 3: Slippage alto");
        const slippageTest = await fetch(
            `${API_URL}/api/v1/purchase/initiate`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    walletAddress: BUYER_ADDRESS,
                    tokenAmount: 1000,
                    paymentMethod: "SOL",
                    maxSlippage: 0.1, // 0.1% max slippage
                }),
            }
        );
        console.log("Resultado:", await slippageTest.json());

        // Test Case 4: Compra válida
        console.log("\n📝 Test 4: Compra válida (100 tokens)");
        const validPurchase = await fetch(
            `${API_URL}/api/v1/purchase/initiate`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    walletAddress: BUYER_ADDRESS,
                    tokenAmount: 100,
                    paymentMethod: "SOL",
                }),
            }
        );
        const validResult = await validPurchase.json();
        console.log("Resultado initiate:", validResult);

        if (validResult.success && validResult.data.txBase64) {
            // Simular firma (en prod esto lo hace el wallet del usuario)
            const tx = Transaction.from(
                Buffer.from(validResult.data.txBase64, "base64")
            );

            // Test Case 5: Confirmar con transacción sin firmar (debería fallar)
            console.log("\n📝 Test 5: Confirmar sin firma");
            const invalidConfirm = await fetch(
                `${API_URL}/api/v1/purchase/confirm`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        signedTransaction: validResult.data.txBase64,
                        fromWallet: BUYER_ADDRESS,
                    }),
                }
            );
            console.log(
                "Resultado confirm sin firma:",
                await invalidConfirm.json()
            );
        }
    } catch (error) {
        console.error("❌ Error en las pruebas:", error);
    }
}

// Ejecutar las pruebas
testPurchaseCases().catch(console.error);
