const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

(async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error("No DATABASE_URL in env");
        process.exit(1);
    }

    const client = new Client({ connectionString });
    try {
        await client.connect();
        const res = await client.query(
            'SELECT id, "transactionId", "walletAddress", "tokenAmount", "paymentAmount", "transactionType", "createdAt" FROM transactions ORDER BY "createdAt" DESC LIMIT 10;'
        );
        console.log("Últimas transacciones:");
        console.table(res.rows);
    } catch (err) {
        console.error("Error querying DB:", err.message || err);
        process.exit(1);
    } finally {
        await client.end();
    }
})();
