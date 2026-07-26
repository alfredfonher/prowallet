import dotenv from "dotenv";
import path from "path";

// Load environment variables FIRST
// In development, load .env.local which overrides .env
// In production (Docker), DO NOT load any .env files - use Docker environment variables only
let envFile: string | null = null;
if (process.env.NODE_ENV === "development") {
  envFile = ".env.local";
} else if (process.env.NODE_ENV === "production") {
  // In production/Docker: DO NOT load .env.mainnet or any files
  // All variables come from docker-compose.yaml environment settings
  envFile = null;
} else {
  envFile = ".env";
}

// Only load .env files if we have an envFile path (development/testing)
if (envFile) {
  dotenv.config({
    path: path.resolve(process.cwd(), envFile),
    override: false,
  });
}

// Now import everything else
import express, { Application, Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import { StatusFlow, StatusFlowCodes, statusFlowMiddleware } from "status-flow";

// Import middleware
import {
  securityMiddleware,
  compressionMiddleware,
  rateLimitMiddleware,
  requestLogger,
  errorHandler,
} from "./middleware";

// Import logging service
import {
  requestLoggerMiddleware,
  loggerService,
} from "./services/logging/logger.service";

// Import routes - manual (disable dynamic loader for now)
import authRouter from "./routes/auth/auth.routes";
import exchangeRouter from "./routes/exchange/exchange.routes";
import prowalletRouter from "./routes/prowallet.routes";
import healthRouter from "./routes/health.routes";
import adminMetadataRouter from "./routes/admin/metadata.routes";
import paymentsWebhookRouter from "./routes/payments/webhook.routes";
import purchaseRouter from "./routes/purchase/purchase.routes";
import solanaProxyRouter from "./routes/solana/proxy.routes";
import transactionRouter from "./routes/transaction/transaction.routes";
import transferRouter from "./routes/transfer.routes";
import { walletSearchRoutes } from "./routes/wallets/wallet-search.routes";
import notificationsRouter from "./routes/notifications/notifications.routes";
import trpcProxyRouter from "./routes/trpc/trpc.proxy.routes";
import usersRouter from "./routes/users/users.routes";
import sendTransactionRouter from "./routes/transactions/send-transaction.routes";

// Import Swagger configuration
import { swaggerUi, specs } from "./config/swagger";

// Import services
import { purchaseSettlementService } from "./workers/purchase-settlement.service";
import { withdrawProcessorService } from "./workers/withdraw-processor.service";
import { TransactionValidationWorkerService } from "./workers/transaction-validation-worker.service";
import { priceService } from "./services/price/price.service.singleton";

// Import old services (for backward compatibility - to be removed)
// TODO: Remove these imports after migration is complete
import { coingeckoService } from "./services/coingecko.service";

const app: Application = express();

// CORS Configuration
// CORS abierto en desarrollo, restringido en producción
const isDev = process.env.NODE_ENV !== "production";

// Parse allowed origins from environment or use defaults
// Remove trailing slashes to avoid CORS comparison issues
const normalizeUrl = (url: string) => url.trim().replace(/\/$/, "");

const allowedOrigins =
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(normalizeUrl)
    .filter(Boolean).length > 0
    ? (process.env.ALLOWED_ORIGINS || "")
        .split(",")
        .map(normalizeUrl)
        .filter(Boolean)
    : [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
        "https://exchange.gapstation.net",
        "https://servicioshilda.orioncaribe.com",
      ];

const corsOptions = {
  origin: isDev ? true : allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-CSRF-Token",
  ],
  optionsSuccessStatus: 200,
};

// Nota: En producción, configura ALLOWED_ORIGINS en .env con los dominios frontend permitidos separados por coma (sin trailing slashes)

// Security & Performance Middleware
app.use(compressionMiddleware);
app.use(rateLimitMiddleware);
app.use(requestLogger);

// Basic Middleware
app.set("trust proxy", 1);
app.use(cors(corsOptions));
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Global normalization middleware: convierte objetos StatusFlow en un contrato
// consistente { success, message, code, extra } para toda la API.
// Esto protege al frontend de variaciones en la forma de las respuestas.
app.use((req: Request, res: Response, next: () => void) => {
  const origJson = res.json.bind(res);

  res.json = (body?: any) => {
    try {
      if (
        body &&
        typeof body === "object" &&
        (body.code || body.message || body.lang)
      ) {
        const known = new Set(["success", "message", "code", "lang"]);
        const extra = body.extra
          ? body.extra
          : Object.fromEntries(
              Object.entries(body).filter(([k]) => !known.has(k)),
            );

        const out = {
          success: body.success !== undefined ? body.success : true,
          message: body.message,
          code: body.code,
          extra,
        };

        return origJson(out);
      }
    } catch (e) {
      // Si falla la normalización, caemos al comportamiento original
    }

    return origJson(body);
  };

  next();
});

// API Routes
const API_PREFIX = process.env.API_PREFIX || "/api";
const API_VERSION = process.env.API_VERSION || "v1";

// Swagger Documentation
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    explorer: true,
    customCss: `
            .swagger-ui .topbar { display: none; }
            @media (prefers-color-scheme: dark) {
                body, .swagger-ui, .swagger-ui .wrapper, .swagger-ui .opblock, .swagger-ui .model-box, .swagger-ui .info, .swagger-ui .scheme-container, .swagger-ui .opblock-tag-section {
                    background: #181a1b !important;
                    color: #e8e6e3 !important;
                }
                .swagger-ui .opblock-summary, .swagger-ui .opblock-section-header, .swagger-ui .opblock-tag {
                    background: #181a1b !important;
                    color: #e8e6e3 !important;
                }
                .swagger-ui .opblock .opblock-summary-method {
                    color: #fff !important;
                }
                .swagger-ui .opblock .opblock-summary-path {
                    color: #00bfff !important;
                    font-weight: bold !important;
                }
                .swagger-ui .opblock .opblock-summary-description {
                    color: #e8e6e3 !important;
                }
                .swagger-ui .response-col_status, .swagger-ui .response-col_description {
                    color: #e8e6e3 !important;
                }
                .swagger-ui .btn {
                    background: #23272b !important;
                    color: #e8e6e3 !important;
                }
                .swagger-ui input, .swagger-ui select, .swagger-ui textarea {
                    background: #23272b !important;
                    color: #e8e6e3 !important;
                    border-color: #444 !important;
                }
                .swagger-ui .model-title, .swagger-ui .parameter__name, .swagger-ui .parameter__type, .swagger-ui .parameter__deprecated, .swagger-ui .parameter__in, .swagger-ui .parameter__description {
                    color: #e8e6e3 !important;
                }
                .swagger-ui .opblock-tag {
                    color: #00bfff !important;
                }
                .swagger-ui .renderedMarkdown p {
                    color: #ffffff !important;
                }
                .swagger-ui .authorization__btn, .swagger-ui .opblock-control-arrow {
                    color: #ffffff !important;
                }
            }
        `,
    customSiteTitle: "ProWallet API Documentation",
  }),
);

// ============================================
// STATIC FILES & FRONTEND SERVING (PRODUCTION)
// ============================================
// En producción, servimos el frontend compilado de Next.js desde la carpeta pública
// El frontend se copia al Docker durante el build en public/web/.next
// Servir archivos estáticos de Next.js (si existen)
const publicPath = path.join(__dirname, "../public/web");
try {
  // Solo servir si la carpeta existe
  if (require("fs").existsSync(publicPath)) {
    app.use(express.static(publicPath));
  }
} catch (e) {
  // Ignorar errores de existencia
}

// API Routes - All routes are discovered dynamically via buildAppRouter()
// Export a promise that resolves when routes are mounted so callers (server) can
// wait and avoid race conditions where the server starts accepting requests
// before the dynamic router has been attached.
// Manual route mounting (explicit, clearer durante desarrollo)
app.use(`${API_PREFIX}/${API_VERSION}/auth`, authRouter);
app.use(`${API_PREFIX}/${API_VERSION}/exchange`, exchangeRouter);
app.use(`${API_PREFIX}/${API_VERSION}/prowallet`, prowalletRouter);
app.use(`${API_PREFIX}/${API_VERSION}/health`, healthRouter);
// [MVP DEVNET] Disabled non-MVP routes
// app.use(`${API_PREFIX}/${API_VERSION}/admin/metadata`, adminMetadataRouter);
// app.use(`${API_PREFIX}/${API_VERSION}/payments/webhook`, paymentsWebhookRouter);
app.use(`${API_PREFIX}/${API_VERSION}/purchase`, purchaseRouter);
app.use(`${API_PREFIX}/${API_VERSION}/solana/proxy`, solanaProxyRouter);
app.use(`${API_PREFIX}/${API_VERSION}/transaction`, transactionRouter);
app.use(`${API_PREFIX}/${API_VERSION}/transactions`, sendTransactionRouter);
app.use(`${API_PREFIX}/${API_VERSION}/transfer`, transferRouter);
app.use(`${API_PREFIX}/${API_VERSION}/users`, usersRouter);
app.use(`${API_PREFIX}/${API_VERSION}/wallets`, walletSearchRoutes);
// [MVP DEVNET] Disabled non-MVP routes
// app.use(`${API_PREFIX}/${API_VERSION}/notifications`, notificationsRouter);
app.use(`${API_PREFIX}/${API_VERSION}/trpc`, trpcProxyRouter);

// Attempt to mount tRPC router if available (optional dependency)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const trpcExpress = require("@trpc/server/adapters/express");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const appRouter = require("./trpc/router").appRouter;
  if (appRouter && trpcExpress) {
    app.use(
      "/trpc",
      trpcExpress.createExpressMiddleware({
        router: appRouter,
        createContext: require("./trpc/context").createContext,
      }),
    );
    loggerService.logInfo("tRPC router mounted at /trpc");
  }
} catch (e) {
  // tRPC not installed or failed to mount; skip silently in dev
  loggerService.logInfo("tRPC not mounted (optional)", {
    reason: e instanceof Error ? e.message : String(e),
  });
}

loggerService.logInfo("✓ Manual routes mounted", { context: "app.routes" });

// Root endpoint
app.get("/", async (req: Request, res: Response) => {
  // Start all background services on first request
  purchaseSettlementService.start();
  withdrawProcessorService.start();
  TransactionValidationWorkerService.start();

  try {
    // Get SOL price from new priceService (stateless, no .start() needed)
    const priceInfo = await priceService.getPriceWithMetadata("SOL");

    res.json({
      message: "🚀 ProWallet API is running!",
      version: API_VERSION,
      services: {
        coingecko: "✅ Running",
        solPrice: `$${priceInfo.price.toFixed(2)}`,
        priceAge: `${priceInfo.ageMs}ms`,
        priceSource: priceInfo.source,
        transactionValidation: "✅ Running",
      },
      endpoints: {
        health: `${API_PREFIX}/${API_VERSION}/health`,
        prowallet: `${API_PREFIX}/${API_VERSION}/prowallet`,
        purchase: `${API_PREFIX}/${API_VERSION}/purchase`,
        docs: `${API_PREFIX}/docs`,
        transfer: `${API_PREFIX}/${API_VERSION}/transfer`,
      },
    });
  } catch (err) {
    loggerService.logError(err as Error, {
      endpoint: "/",
      context: "Failed to fetch price in root endpoint",
    });

    res.json({
      message: "🚀 ProWallet API is running! (price service unavailable)",
      version: API_VERSION,
      services: {
        coingecko: "⚠️ Temporarily unavailable",
        transactionValidation: "✅ Running",
      },
      endpoints: {
        health: `${API_PREFIX}/${API_VERSION}/health`,
        prowallet: `${API_PREFIX}/${API_VERSION}/prowallet`,
        purchase: `${API_PREFIX}/${API_VERSION}/purchase`,
        docs: `${API_PREFIX}/docs`,
        transfer: `${API_PREFIX}/${API_VERSION}/transfer`,
      },
    });
  }
});

// Internal debug endpoint: listar rutas registradas en Express
// Útil para verificar mount points y métodos durante desarrollo.
app.get("/internal/debug/routes", (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const stack = app._router && app._router.stack ? app._router.stack : [];
    const summary = stack.map((layer: any, idx: number) => {
      return {
        idx,
        name: layer.name,
        // route may be undefined for mounted routers / middlewares
        routePath: layer.route ? layer.route.path : null,
        methods: layer.route
          ? Object.keys(layer.route.methods).map((m) => m.toUpperCase())
          : null,
        handleName: layer.handle ? layer.handle.name : null,
        regexp: layer.regexp ? String(layer.regexp) : null,
      };
    });

    res.json({ count: summary.length, stack: summary });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// API Information endpoint
app.get("/api/info", (req: Request, res: Response) => {
  res.json({
    title: "ProWallet API Documentation",
    version: "1.0.0",
    description:
      "API para interactuar con el smart contract de ProWallet (GAP) en Solana",
    baseUrl: `${req.protocol}://${req.get("host")}/api/v1`,
    endpoints: {
      // Health endpoints
      "GET /health": "Check API health status",
      "GET /health/solana": "Check Solana network connectivity",

      // ProWallet endpoints
      "GET /prowallet/contract-info": "Get smart contract information",
      "GET /prowallet/whitelist": "Get current whitelist",
      "POST /prowallet/whitelist/add": "Add wallet to whitelist",
      "POST /prowallet/whitelist/remove": "Remove wallet from whitelist",
      "POST /prowallet/transfer": "Execute restricted transfer",
      "GET /prowallet/balance/:wallet": "Get wallet token balance",

      // Purchase endpoints
      "GET /purchase/price": "Get current token price with bonding curve",
      "POST /purchase/initiate": "Initiate token purchase",
      "POST /purchase/confirm/:id": "Confirm purchase with Solana signature",
      "GET /purchase/history/:wallet": "Get purchase history for wallet",
      "GET /purchase/market-stats":
        "Get market statistics and transparency data",
      // Exchange endpoints
      "GET /exchange/price": "Get current token price",
      "POST /exchange/buy": "Buy tokens",
      "POST /exchange/sell": "Sell tokens",
      "POST /exchange/transfer": "Transfer tokens",
      "GET /exchange/balance/:username": "Get user balance",
    },
  });
});

// ============================================
// CATCH-ALL ROUTE FOR FRONTEND (SPA ROUTING)
// ============================================
// Ruta catch-all para servir index.html (para que Next.js/SPA maneje el routing)
// IMPORTANTE: Esta ruta DEBE ir ANTES del 404 handler
// En Express 5.x usamos app.use() en lugar de app.get() para wildcards
app.use((req: Request, res: Response, next: () => void) => {
  // No servir si es una ruta de API
  if (req.path.startsWith("/api")) {
    return next();
  }

  // Intentar servir el index.html de Next.js para que maneje el routing del cliente
  const indexPath = path.join(__dirname, "../public/web/index.html");
  try {
    if (require("fs").existsSync(indexPath)) {
      res.sendFile(indexPath, (err) => {
        if (err) {
          // Si hay error, pasar al siguiente handler
          next();
        }
      });
    } else {
      // Si no existe index.html, pasar al siguiente handler (404)
      next();
    }
  } catch (err) {
    // En caso de error, pasar al siguiente handler
    next();
  }
});

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json(
    StatusFlow({
      code: StatusFlowCodes.NOT_FOUND,
      lang: "es",
      extra: {
        path: req.originalUrl,
        method: req.method,
        availableEndpoints: `${req.protocol}://${req.get("host")}/api/docs`,
      },
    }),
  );
});

// Global error handler (StatusFlow middleware)
app.use(statusFlowMiddleware);

export default app;
