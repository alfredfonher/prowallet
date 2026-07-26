import dotenv from "dotenv";
dotenv.config();

import { databaseService } from "../services/database/database.service";
import { loggerService } from "../services/logging/logger.service";
import { transactionRepository } from "../models/types";
import { v4 as uuidv4 } from "uuid";

// Datos de prueba para simular transacciones
const MOCK_TRANSACTIONS = [
  {
    transactionId: uuidv4(),
    signature:
      "3Bq8zR7hUJ5dY9xMz2p4qE6Fv8CgNLo9Xk1mW7jP5RtU4Sw6rN8bA2eD9hG3mKyL",
    blockSlot: 123456789,
    walletAddress: "GmYsHTNVhnJwpV5yiHa8NwLqnMpan3Qy8LsqA7L9yzH1",
    transactionType: "purchase" as const,
    tokenAmount: 1000,
    paymentAmount: 1.2,
    paymentToken: "SOL" as const,
    tokenPrice: 0.0012,
    status: "success" as const,
    gasCost: 0.0015,
    completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 días atrás
    metadata: {
      userAgent: "Mozilla/5.0 (Test Browser)",
      ipAddress: "127.0.0.1",
      priceImpact: 2.5,
      slippage: 2.1,
      currentSupply: 49000,
    },
  },
  {
    transactionId: uuidv4(),
    signature:
      "4Cq9zR8hUK6dY0xNz3p5qF7Gv9DhOLp0Yl2nX8kQ6RuV5Tx7sO9cB3fE0iH4nLyM",
    blockSlot: 123456790,
    walletAddress: "HsYsHTNVhnJwpV5yiHa8NwLqnMpan3Qy8LsqA7L9yzH2",
    transactionType: "purchase" as const,
    tokenAmount: 500,
    paymentAmount: 0.65,
    paymentToken: "SOL" as const,
    tokenPrice: 0.0013,
    status: "success" as const,
    gasCost: 0.0015,
    completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 día atrás
    metadata: {
      userAgent: "Mozilla/5.0 (Test Browser)",
      ipAddress: "127.0.0.1",
      priceImpact: 1.8,
      slippage: 1.5,
      currentSupply: 50000,
    },
  },
  {
    transactionId: uuidv4(),
    signature:
      "5Dr0zS9hVL7eZ1yOz4q6rG8Hw0EiPMq1Zm3oY9lR7SvW6Uy8tP0dC4gF1jI5oMzN",
    blockSlot: 123456791,
    walletAddress: "JsZsTUOWioKxqW6ziIb9OwMroPbo4Qy9MtrB8M0qA8I4",
    transactionType: "purchase" as const,
    tokenAmount: 250,
    paymentAmount: 0.35,
    paymentToken: "SOL" as const,
    tokenPrice: 0.0014,
    status: "success" as const,
    gasCost: 0.0015,
    completedAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 horas atrás
    metadata: {
      userAgent: "Mozilla/5.0 (Test Browser)",
      ipAddress: "192.168.1.100",
      priceImpact: 1.2,
      slippage: 1.0,
      currentSupply: 50500,
    },
  },
  {
    transactionId: uuidv4(),
    signature:
      "6Es1zT0hWM8fA2zPz5r7sH9Ix1FjQNr2Ao4pZ0mS8TwX7Vz9uQ1eD5hG2kJ6pN0O",
    blockSlot: 123456792,
    walletAddress: "JtAtTVPXjpLxrX7zjJc0PxNsqQcp5RzANusC9N1rB9J4",
    transactionType: "purchase" as const,
    tokenAmount: 150,
    paymentAmount: 0.22,
    paymentToken: "SOL" as const,
    tokenPrice: 0.00146,
    status: "success" as const,
    gasCost: 0.0015,
    completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 horas atrás
    metadata: {
      userAgent: "Mozilla/5.0 (Mobile Test)",
      ipAddress: "10.0.0.50",
      priceImpact: 0.8,
      slippage: 0.6,
      currentSupply: 50750,
    },
  },
  {
    transactionId: uuidv4(),
    signature:
      "7Ft2zU1hXN9gB3AQz6s8tI0Jy2GkROs3Bp5qA1nT9UxY8Wz0vR2fE6iH3lK7qO1P",
    blockSlot: 123456793,
    walletAddress: "KuBuTWQYkqMysY8zkKd1QyOtrRdqsS0BMvtD0O2sC0K5",
    transactionType: "purchase" as const,
    tokenAmount: 75,
    paymentAmount: 0.12,
    paymentToken: "SOL" as const,
    tokenPrice: 0.0016,
    status: "success" as const,
    gasCost: 0.0015,
    completedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min atrás
    metadata: {
      userAgent: "Mozilla/5.0 (Desktop Test)",
      ipAddress: "172.16.0.25",
      priceImpact: 0.4,
      slippage: 0.3,
      currentSupply: 50900,
    },
  },
];

async function seedDatabase() {
  console.log("🌱 Starting database seeding...");

  try {
    // Conectar a la base de datos
    await databaseService.connect();
    console.log("✅ Connected to PostgreSQL");

    // Limpiar transacciones existentes (opcional)
    const existingCount = await transactionRepository.count({});
    if (existingCount > 0) {
      console.log(`📊 Found ${existingCount} existing transactions`);
      const shouldClear = process.argv.includes("--clear");

      if (shouldClear) {
        // Para Prisma, necesitaríamos implementar deleteAll en el repository
        // Por ahora, solo advertir
        console.log("⚠️  To clear existing data, run: prisma db push --reset");
      }
    }

    // Insertar datos de prueba
    console.log("📝 Inserting test transactions...");
    const insertedTransactions = await Promise.all(
      MOCK_TRANSACTIONS.map((tx) => transactionRepository.create(tx as any)),
    );
    console.log(`✅ Inserted ${insertedTransactions.length} test transactions`);

    // Verificar datos insertados
    const totalTransactions = await transactionRepository.count({});
    const successfulPurchases = await transactionRepository.count({
      status: "success",
      transactionType: "purchase",
    });

    console.log("📈 Database Statistics:");
    console.log(`   Total transactions: ${totalTransactions}`);
    console.log(`   Successful purchases: ${successfulPurchases}`);

    // Calcular estadísticas de volume
    const volumeStats = await transactionRepository.find({
      status: "success",
      transactionType: "purchase",
    });

    if (volumeStats.length > 0) {
      const totalVolume = volumeStats.reduce(
        (sum, t) => sum + (t.paymentAmount || 0),
        0,
      );
      const totalTokens = volumeStats.reduce(
        (sum, t) => sum + t.tokenAmount,
        0,
      );
      const avgPrice =
        volumeStats.length > 0
          ? volumeStats.reduce((sum, t) => sum + (t.tokenPrice || 0), 0) /
            volumeStats.length
          : 0;

      console.log("💰 Volume Statistics:");
      console.log(`   Total volume: ${totalVolume.toFixed(4)} SOL`);
      console.log(`   Total tokens sold: ${totalTokens.toLocaleString()}`);
      console.log(`   Average price: ${avgPrice.toFixed(6)} SOL`);
    }

    // Mostrar holders únicos
    const allTransactions = await transactionRepository.find({
      status: "success",
      transactionType: "purchase",
    });

    const uniqueWallets = [
      ...new Set(allTransactions.map((t) => t.walletAddress)),
    ];

    console.log(`👥 Unique holders: ${uniqueWallets.length}`);
    console.log("   Holder addresses:");
    uniqueWallets.slice(0, 5).forEach((address, index) => {
      console.log(
        `     ${index + 1}. ${address.slice(0, 8)}...${address.slice(-8)}`,
      );
    });

    console.log("\n🎉 Database seeding completed successfully!");
    console.log("\n🚀 You can now test the API endpoints:");
    console.log("   - GET /api/v1/purchase/market-stats");
    console.log("   - GET /api/v1/purchase/price?amount=100");
    if (uniqueWallets.length > 0) {
      console.log(`   - GET /api/v1/purchase/history/${uniqueWallets[0]}`);
    }
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    loggerService.logError(error as Error, {
      context: "Database seeding failed",
    });
  } finally {
    await databaseService.disconnect();
    process.exit(0);
  }
}

// Ejecutar seeding si este archivo se ejecuta directamente
if (require.main === module) {
  seedDatabase();
}

export { seedDatabase };
