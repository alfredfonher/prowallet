/// <reference path="./types/express.d.ts" />

import dotenv from "dotenv";
import path from "path";

// Load environment variables FIRST
// In development, load .env.local which overrides .env
// In production (Docker), DO NOT load any .env files - all vars come from docker-compose.yaml
const envFile = process.env.NODE_ENV === "development" ? ".env.local" : null;

// Only load .env files if we have a path (development/testing)
if (envFile) {
  dotenv.config({
    path: path.resolve(process.cwd(), envFile),
    override: false,
  });
}

// Debug: print critical env values to confirm which .env was loaded at runtime
console.log(
  "[36m[env-debug][0m BASE_TOKEN_PRICE=",
  process.env.BASE_TOKEN_PRICE,
  "PRICING_MODE=",
  process.env.PRICING_MODE,
);

// Now import app and services after env vars are loaded
import app from "./app";
import http from "http";
import { initSocketServer } from "./services/socket.service";
import { databaseService } from "./services/database/database.service";
import { loggerService } from "./services/logging/logger.service";
import { priceService } from "./services/price/price.service";
import { connectRedis } from "./services/redis.service";

const PORT = process.env.PORT || 3001;

// Función para inicializar el servidor
async function startServer() {
  try {
    // Conectar Redis (opcional - si falla la app seguirá funcionando con cache en memoria)
    console.log("🗄️  Inicializando conexión a Redis...");
    await connectRedis();

    // Iniciar servicio de precios (PriceService aggregator)
    console.log("📊 Inicializando servicio de precios (priceService)...");
    // priceService es on-demand; opcionalmente forzamos una primera actualización
    try {
      // Ejecutar una primera actualización no bloqueante
      priceService.forceRefresh("SOL").catch((e) => {
        console.warn(
          "⚠️ Primera actualización de precio falló:",
          e instanceof Error ? e.message : e,
        );
      });

      // Si se configuró un intervalo de actualización, iniciarlo
      const ms = parseInt(process.env.PRICE_UPDATE_MS || "0", 10);
      if (ms && !isNaN(ms) && ms > 0) {
        setInterval(() => {
          priceService
            .forceRefresh("SOL")
            .catch((e) =>
              console.warn(
                "⚠️ Error en actualización programada de precio:",
                e instanceof Error ? e.message : e,
              ),
            );
        }, ms);
      }
    } catch (e) {
      console.warn(
        "⚠️ No se pudo inicializar priceService:",
        e instanceof Error ? e.message : e,
      );
    }

    // Conectar a la base de datos (opcional para testing)
    try {
      await databaseService.connect();
      await databaseService.ensureIndexes();
      console.log("🗄️  Database: Connected successfully");
    } catch (dbError) {
      console.log(
        "⚠️  Database: Running without MongoDB (for testing purposes)",
      );
      console.log("   Install and start MongoDB to enable full functionality");
    }

    // Iniciar el servidor en un HTTP server para poder adjuntar socket.io
    const server = http.createServer(app);

    server.listen(PORT, () => {
      console.log(`🚀 ProWallet API Server running on port ${PORT}`);
      console.log(
        `📡 Solana Network: ${process.env.SOLANA_NETWORK || "devnet"}`,
      );
      console.log(
        `🗄️  Database: ${
          process.env.MONGODB_URI ? "Connected" : "Local MongoDB"
        }`,
      );
      console.log(`📄 API Docs: http://localhost:${PORT}/api/docs`);
      console.log(`📊 Purchase API: http://localhost:${PORT}/api/v1/purchase`);

      loggerService.logInfo("ProWallet API Server started successfully", {
        port: PORT,
        environment: process.env.NODE_ENV || "development",
        solanaNetwork: process.env.SOLANA_NETWORK || "devnet",
        databaseConnected: databaseService.isConnectedToDb(),
      });
      // Inicializar socket.io (si está disponible)
      try {
        initSocketServer(server);
      } catch (e) {
        console.warn(
          "Failed to initialize socket server:",
          e instanceof Error ? e.message : e,
        );
      }
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    loggerService.logError(error as Error, {
      context: "Server startup failed",
    });
    process.exit(1);
  }
}

// Manejar cierre graceful del servidor
process.on("SIGINT", async () => {
  console.log("\n🔄 Gracefully shutting down server...");

  try {
    await databaseService.disconnect();
    loggerService.logInfo("Server shutdown completed");
    console.log("✅ Server shutdown completed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    loggerService.logError(error as Error, {
      context: "Server shutdown error",
    });
    process.exit(1);
  }
});

// Manejar errores no capturados
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  loggerService.logError(new Error(`Unhandled Rejection: ${reason}`), {
    context: "Unhandled promise rejection",
  });
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  loggerService.logError(error, {
    context: "Uncaught exception",
  });
  process.exit(1);
});

// Iniciar el servidor
startServer();
