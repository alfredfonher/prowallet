/* Script para crear una transacción 'fee-only' en la base de datos y devolver el transactionId
   Uso: node apps/api/scripts/create_fee_only_purchase.js <walletAddress> <tokenAmount>
*/
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
const { v4: uuidv4 } = require("uuid");
(async () => {
    try {
        const wallet = process.argv[2];
        const tokenAmount = parseFloat(process.argv[3]);
        if (!wallet || !tokenAmount) {
            console.error(
                "Usage: node create_fee_only_purchase.js <walletAddress> <tokenAmount>"
            );
            process.exit(2);
        }
        // Cargar repositorio compilado
        const types = require("../dist/models/types");
        const transactionRepository = types.transactionRepository;

        // Calcular comisiones desde .env o fallback
        const gas = parseFloat(process.env.GAS_ESTIMATE_SOL || "0.000005");
        const commission = parseFloat(
            process.env.PLATFORM_COMMISSION_SOL || "0.000005"
        );
        const totalFees = gas + commission;

        const txDoc = await transactionRepository.create({
            transactionId: uuidv4(),
            walletAddress: wallet,
            tokenAmount: tokenAmount,
            paymentAmount: totalFees,
            paymentToken: "SOL",
            tokenPrice: 0,
            status: "pending",
            transactionType: "purchase",
            metadata: { note: "fee-only test insertion" },
        });

        console.log(
            "Created transaction:",
            JSON.stringify(
                {
                    transactionId: txDoc.transactionId,
                    walletAddress: txDoc.walletAddress,
                    tokenAmount: txDoc.tokenAmount,
                    paymentAmount: txDoc.paymentAmount,
                },
                null,
                2
            )
        );
        process.exit(0);
    } catch (e) {
        console.error("Error:", e && e.message ? e.message : e);
        process.exit(1);
    }
})();
