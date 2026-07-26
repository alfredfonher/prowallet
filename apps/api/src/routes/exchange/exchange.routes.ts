import { Request, Response, Router } from "express";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import { sendSuccess, sendError } from "../../utils/response.util";
import { databaseService } from "../../services/database/database.service";
import { validateJWT } from "../../middleware/jwt";
import { solanaService } from "../../services/solana/solana.service";
import { priceService } from "../../services/price/price.service";
import {
  redisClient,
  getJson,
  setJson,
  connectRedis,
} from "../../services/redis.service";
import { autoSettleWithRetry } from "../../services/solana/auto-settle-retry.service";
import { TransactionValidatorService } from "../../services/solana/transaction-validator.service";
import { PublicKey } from "@solana/web3.js";
import { loggerService } from "../../services/logging/logger.service";
import { buildMintTransaction } from "../../services/solana/mint-transaction.service";
import priceRouter from "./price.routes";

const router: Router = Router();

// Cache simple in-memory flags to avoid spamming logs when a token mint is missing
const MISSING_MINT_CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes
const missingMintCache: Map<string, number> = new Map();

// Middleware: Normalizar cualquier objeto StatusFlow enviado con res.json
router.use((req: Request, res: Response, next) => {
  const origJson = res.json.bind(res);

  // Mantener la firma esperada por Express: res.json debe devolver Response.
  (res as any).json = function (body?: any): Response {
    try {
      // Detectar objeto StatusFlow y normalizar a { success, message, code, extra }
      if (
        body &&
        typeof body === "object" &&
        ("code" in body || "message" in body)
      ) {
        const sfObj = body;
        const known = new Set(["success", "message", "code", "lang"]);
        const extra = sfObj.extra
          ? sfObj.extra
          : Object.fromEntries(
              Object.entries(sfObj).filter(([k]) => !known.has(k)),
            );

        const message = sfObj.message;
        const code = sfObj.code || StatusFlowCodes.OK;
        // En lugar de llamar a `sendSuccess`/`sendError` (que a su vez usan `res.json`),
        // usar `origJson` para evitar recursión y devolver un Response compatible.
        if (sfObj.success === false) {
          const payload = {
            success: false,
            message: message || "Error",
            code,
            extra,
          };
          return origJson(payload) as Response;
        }

        const payload = {
          success: true,
          message: message || "OK",
          code,
          extra,
        };

        return origJson(payload) as Response;
      }
    } catch (e) {
      const payload = {
        success: false,
        message: "Response formatting error",
        code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
        extra: { error: String(e) },
      };
      return origJson(payload) as Response;
    }

    return origJson(body);
  };

  next();
});

// Helper para normalizar respuestas StatusFlow -> { success, extra }
function sendSF(res: Response, sfObj: any) {
  try {
    const known = new Set(["success", "message", "code", "lang"]);
    const extra = sfObj.extra
      ? sfObj.extra
      : Object.fromEntries(
          Object.entries(sfObj).filter(([k]) => !known.has(k)),
        );

    const message = sfObj.message;
    const code = sfObj.code || StatusFlowCodes.OK;

    if (sfObj.success === false) {
      sendError(res, message || "Error", code, extra);
      return;
    }

    sendSuccess(res, extra, message || "OK", code);
  } catch (e) {
    sendError(
      res,
      "Response formatting error",
      StatusFlowCodes.INTERNAL_SERVER_ERROR,
      {
        error: e instanceof Error ? e.message : String(e),
      },
    );
  }
}

function sendSFStatus(res: Response, statusCode: number, sfObj: any) {
  res.status(statusCode);
  return sendSF(res, sfObj);
}

/**
 * Obtiene el usuario y su wallet de Solana vinculada desde el token JWT.
 * Extrae email y user_id del token, luego busca la llave pública en la BD.
 *
 * @returns {user_id, email, solana_public_key} o null si no hay usuario
 */
async function obtener_usuario_de_token(
  tokenUser: any,
  prisma: any,
): Promise<{
  user_id: number;
  email: string;
  solana_public_key?: string;
} | null> {
  const email = tokenUser?.email;
  const user_id = tokenUser?.user_id;

  if (!email || !user_id) {
    return null;
  }

  try {
    const usuario = await prisma.user.findUnique({
      where: { id: user_id },
      select: { id: true, email: true, solanaPublicKey: true },
    });

    if (!usuario) {
      return null;
    }

    return {
      user_id: usuario.id,
      email: usuario.email,
      solana_public_key: usuario.solanaPublicKey || undefined,
    };
  } catch (error) {
    loggerService.logError(error as Error, {
      context: "obtener_usuario_de_token",
      user_id,
      email,
    });
    return null;
  }
}

// ========== CACHE PARA DATOS LENTOS ==========
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // TTL en ms
}

const cache: Map<string, CacheEntry<any>> = new Map();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > entry.ttl) {
    cache.delete(key);
    return null;
  }

  return entry.data as T;
}

function setCached<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000) {
  cache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
}

// GET /exchange/solPrice - Obtener precio de SOL/USD desde CryptoRank v2
router.get("/solPrice", async (req: Request, res: Response) => {
  try {
    // Try Redis cache first
    try {
      if (!redisClient.isOpen) {
        // attempt connect but don't fail the request if redis is down
        connectRedis().catch(() => {});
      }
    } catch (e) {
      // ignore
    }

    const legacyKey = "prowallet:solPrice";
    const newKey = "prowallet:price:SOL";

    // Read both legacy and new cache entries (if present) and pick the most recent
    const legacy = await getJson(legacyKey).catch(() => null);
    const modern = await getJson(newKey).catch(() => null);

    // If both missing, fallback to live aggregator
    if (!legacy && !modern) {
      const priceData = await priceService.getPriceWithMetadata("SOL");
      return sendSF(
        res,
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            solPriceUsd: priceData.price,
            timestamp: priceData.timestamp,
            ageMs: priceData.ageMs,
            updateCount: undefined,
            cached: false,
            source: priceData.source || "priceService",
          },
        }),
      );
    }

    // Choose the most recent one by timestamp
    let chosen: any = null;
    if (legacy && modern) {
      const lt = Number(legacy.timestamp || 0);
      const mt = Number(modern.timestamp || 0);
      chosen =
        mt >= lt
          ? {
              price: modern.price || modern.priceUsd || modern.solPriceUsd,
              timestamp: mt,
              source: modern.source || "priceService",
            }
          : {
              price: legacy.solPriceUsd,
              timestamp: lt,
              source: legacy.source || "legacy",
            };
    } else if (modern) {
      chosen = {
        price: modern.price || modern.priceUsd || modern.solPriceUsd,
        timestamp: Number(modern.timestamp || Date.now()),
        source: modern.source || "priceService",
      };
    } else {
      chosen = {
        price: legacy.solPriceUsd,
        timestamp: Number(legacy.timestamp || Date.now()),
        source: legacy.source || "legacy",
      };
    }

    return sendSF(
      res,
      StatusFlow({
        code: StatusFlowCodes.OK,
        lang: "es",
        extra: {
          solPriceUsd: chosen.price,
          timestamp: chosen.timestamp,
          ageMs: Date.now() - chosen.timestamp,
          updateCount: (legacy && legacy.updateCount) || undefined,
          cached: true,
          source: chosen.source,
        },
      }),
    );
  } catch (error) {
    return sendSFStatus(
      res,
      500,
      StatusFlow({
        code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
        lang: "es",
        extra: {
          error:
            error instanceof Error
              ? error.message
              : "Error al obtener el precio de SOL",
        },
      }),
    );
  }
});

// GET /exchange/getBalance - Obtener balance del usuario
router.get("/getBalance", validateJWT, async (req: Request, res: Response) => {
router.get("/config", async (req: Request, res: Response) => {
  try {
    const treasuryWallet =
      process.env.TREASURY_WALLET || process.env.AUTHORITY_WALLET;
    const tokenMint = process.env.TOKEN_MINT;
    const gasFee = parseFloat(process.env.GAS_ESTIMATE_SOL || "0.000005");
    const platformCommission = parseFloat(
      process.env.PLATFORM_COMMISSION_SOL || "0.000005",
    );

    res.json(
      StatusFlow({
        code: StatusFlowCodes.OK,
        lang: "es",
        extra: {
          treasuryWallet,
          tokenMint,
          fees: {
            gas: gasFee,
            platform: platformCommission,
            total: gasFee + platformCommission,
          },
          network: process.env.SOLANA_NETWORK || "devnet",
        },
      }),
    );
  } catch (error) {
    res.status(500).json(
      StatusFlow({
        code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
        lang: "es",
        extra: {
          error:
            error instanceof Error
              ? error.message
              : "Error al obtener la configuración",
        },
      }),
    );
  }
});

// GET /exchange/tokenInfo - Obtener información del token
router.get("/tokenInfo", async (req: Request, res: Response) => {
  try {
    const tokenMint = process.env.TOKEN_MINT;
    const decimals = Number(process.env.TOKEN_DECIMALS || 9);

    if (!tokenMint) {
      throw new Error("TOKEN_MINT no está configurado en .env");
    }

    const CACHE_KEY = "prowallet:tokenInfo";
    const CACHE_TTL_MS = parseInt(
      process.env.TOKENINFO_CACHE_TTL_MS || String(1000 * 60 * 60),
      10,
    ); // default 1 hour

    // Try Redis cache first (graceful)
    try {
      const cached = await getJson(CACHE_KEY).catch(() => null);
      if (cached && cached.lastUpdated) {
        const age = Date.now() - Number(cached.lastUpdated || 0);
        const isStale = age > CACHE_TTL_MS;
        // Return cached payload with metadata
        return sendSF(
          res,
          StatusFlow({
            code: StatusFlowCodes.OK,
            lang: "es",
            extra: {
              ...cached,
              cached: true,
              isStale,
              ageMs: age,
            },
          }),
        );
      }
    } catch (e) {
      // ignore cache read errors and continue to fetch live
    }

    let tokenInfo: any = {
      name: process.env.TOKEN_NAME || "ProWallet",
      symbol: process.env.TOKEN_SYMBOL || "GAPC",
      mintAddress: tokenMint,
      decimals: decimals,
      isInitialized: false,
      lastUpdated: new Date().toISOString(),
      source: "fallback",
    };

    // If running locally or for faster dev feedback, allow a mock fallback via env
    if (
      process.env.MOCK_TOKEN_INFO === "true" ||
      process.env.NODE_ENV !== "production"
    ) {
      // return fallback immediately without calling RPC
      tokenInfo = {
        ...tokenInfo,
        totalSupply:
          Number(process.env.MAX_SUPPLY || "1000000000000000000") /
          Math.pow(10, decimals),
        circulatingSupply: 0,
        holders: 0,
        price: 0,
        marketCap: 0,
        source: "mock",
      };
      sendSuccess(res, tokenInfo, "OK", StatusFlowCodes.OK);
      return;
    }

    try {
      const mintPubkey = new PublicKey(tokenMint);
      // Use solanaService wrapper to benefit from retry/backoff + RPC fallback
      const totalSupply = await (solanaService as any).getTokenSupply(
        mintPubkey,
      );

      // Use connection obtained from solanaService (may be fallback)
      const connection = solanaService.getConnection();
      const largest = await connection.getTokenLargestAccounts(mintPubkey);
      const largestAccounts = largest?.value || [];
      let holdersCount = 0;
      let circulating = 0;
      for (const acc of largestAccounts) {
        const amt = Number(acc.amount || 0) / Math.pow(10, decimals || 0);
        if (amt > 0) holdersCount += 1;
        circulating += amt;
      }

      tokenInfo = {
        ...tokenInfo,
        totalSupply: totalSupply,
        circulatingSupply: circulating,
        holders: holdersCount,
        source: "solana",
        isInitialized: true,
        price: 0,
        marketCap: 0,
        lastUpdated: Date.now(),
      };
      // Save to Redis cache
      try {
        await setJson(
          CACHE_KEY,
          {
            ...tokenInfo,
            lastUpdated: Date.now(),
          },
          CACHE_TTL_MS,
        );
      } catch (e) {
        // ignore cache write errors
      }
    } catch (rpcError) {
      const err =
        rpcError instanceof Error ? rpcError : new Error(String(rpcError));
      const msg = String(err.message || "").toLowerCase();
      if (
        msg.includes("could not find account") ||
        msg.includes("invalid param")
      ) {
        const tokenMint = process.env.TOKEN_MINT || "<unknown>";
        const now = Date.now();
        const last = missingMintCache.get(tokenMint) || 0;
        if (!last || now - last > MISSING_MINT_CACHE_TTL_MS) {
          missingMintCache.set(tokenMint, now);
          loggerService.logInfo(
            "tokenInfo RPC failed due to missing mint on chain - using fallback",
            {
              context: "tokenInfo RPC failed - using fallback",
              tokenMint,
              rawError: err.message,
            },
          );
        }
      } else {
        loggerService.logError(err, {
          context: "tokenInfo RPC failed - using fallback",
        });
      }
      tokenInfo = {
        ...tokenInfo,
        totalSupply:
          Number(process.env.MAX_SUPPLY || "1000000000000000000") /
          Math.pow(10, decimals),
        circulatingSupply: 0,
        holders: 0,
        price: 0,
        marketCap: 0,
        lastUpdated: Date.now(),
        isStale: true,
      };
      // Write fallback to cache so frontend can read last-known values
      try {
        await setJson(
          CACHE_KEY,
          {
            ...tokenInfo,
            lastUpdated: Date.now(),
          },
          parseInt(
            process.env.TOKENINFO_CACHE_TTL_MS || String(1000 * 60 * 60),
            10,
          ),
        );
      } catch (e) {
        // ignore
      }
    }

    sendSuccess(res, tokenInfo, "OK", StatusFlowCodes.OK);
  } catch (error) {
    console.error("Error in tokenInfo:", error);
    sendError(
      res,
      error instanceof Error
        ? error.message
        : "Error al obtener la información del token",
      StatusFlowCodes.INTERNAL_SERVER_ERROR,
      { error: error instanceof Error ? error.message : String(error) },
    );
  }
});

// GET /exchange/getPrice - Obtener precio fijo del token en USD (0.01 USD)
router.get("/getPrice", async (req: Request, res: Response) => {
  try {
    // Token price is fixed at 0.01 USD (constant across the system)
    const token_price_usd = 0.01;

    sendSuccess(
      res,
      {
        priceUSD: token_price_usd,
        currencyCode: "USD",
        lastUpdated: new Date().toISOString(),
        source: "fixed_price",
      },
      "OK",
      StatusFlowCodes.OK,
    );
  } catch (error: unknown) {
    loggerService.logError(error as Error, {
      endpoint: "/exchange/getPrice",
    });

    sendError(
      res,
      error instanceof Error ? error.message : "Error al obtener el precio",
      StatusFlowCodes.INTERNAL_SERVER_ERROR,
      { error: error instanceof Error ? error.message : String(error) },
    );
  }
});

// GET /exchange/getBalance/:walletAddress - Obtener balance de SOL para una wallet (sin autenticación requerida)
// Usado por el frontend para validar balance en tiempo real sin dependencia del RPC público
router.get(
  "/getBalance/:walletAddress",
  async (req: Request, res: Response) => {
    try {
      const { walletAddress } = req.params;

      // Validar que sea una dirección de Solana válida
      if (!walletAddress || walletAddress.length < 32) {
        return sendError(
          res,
          "Invalid wallet address",
          StatusFlowCodes.INVALID_INPUT,
          { error: "Formato de dirección de wallet inválido" },
        );
      }

      try {
        new PublicKey(walletAddress);
      } catch {
        return sendError(
          res,
          "Invalid wallet address",
          StatusFlowCodes.INVALID_INPUT,
          { error: "Dirección Solana inválida" },
        );
      }

      // Obtener balance desde Solana RPC usando el servicio
      const connection = solanaService.getConnection();
      const walletKey = new PublicKey(walletAddress);

      let balanceLamports = 0;
      try {
        balanceLamports = await connection.getBalance(walletKey);
      } catch (rpcErr) {
        console.error("RPC error fetching balance:", rpcErr);
        return sendError(
          res,
          "Could not fetch balance from blockchain",
          StatusFlowCodes.EXTERNAL_SERVICE_ERROR,
          {
            error: rpcErr instanceof Error ? rpcErr.message : "RPC error",
          },
        );
      }

      const balanceSol = balanceLamports / 1e9;

      return res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            balance: balanceSol,
            walletAddress,
          },
        }),
      );
    } catch (error) {
      console.error("Error in getBalance/:walletAddress:", error);
      return sendError(
        res,
        "Error fetching balance",
        StatusFlowCodes.INTERNAL_SERVER_ERROR,
        {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      );
    }
  },
);

// GET /exchange/getBalance - Obtener balance del usuario
router.get("/getBalance", validateJWT, async (req: Request, res: Response) => {
  try {
    const prisma = databaseService.getClient();
    const tokenUser = (req as any).user as any;

    const usuario = await obtener_usuario_de_token(tokenUser, prisma);
    if (!usuario) {
      sendError(
        res,
        "Se requiere usuario autenticado",
        StatusFlowCodes.INVALID_INPUT,
        { error: "Se requiere usuario autenticado" },
      );
      return;
    }

    // Obtener todas las transacciones del usuario por email
    const transactions = await prisma.userTransaction.findMany({
      where: {
        email: usuario.email,
        status: "completed",
      },
    });

    let tokenBalance = 0;
    let fiatBalance = 0;

    for (const tx of transactions) {
      if (tx.type === "purchase" || tx.type === "claim") {
        tokenBalance += Number(tx.amountTokens) / 1e9; // Convertir de lamports si aplica
        fiatBalance += tx.amountUsd;
      } else if (tx.type === "stake") {
        tokenBalance -= Number(tx.amountTokens) / 1e9;
      } else if (tx.type === "unstake") {
        tokenBalance += Number(tx.amountTokens) / 1e9;
      } else if (tx.type === "transfer") {
        tokenBalance -= Number(tx.amountTokens) / 1e9;
      }
    }

    const balanceData = {
      email: usuario.email,
      user_id: usuario.user_id,
      tokenBalance: Math.max(0, tokenBalance),
      fiatSpent: fiatBalance,
      pricePerToken: 0,
      totalValue: 0,
    };

    res.json(
      StatusFlow({
        code: StatusFlowCodes.OK,
        lang: "es",
        extra: balanceData,
      }),
    );
  } catch (error) {
    loggerService.logError(error as Error, {
      context: "getBalance",
    });
    res.status(500).json(
      StatusFlow({
        code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
        lang: "es",
        extra: {
          error:
            error instanceof Error
              ? error.message
              : "Error al obtener el balance",
        },
      }),
    );
  }
});

// POST /exchange/buyTokens - Comprar tokens (HYBRID: Fast response + Async on-chain settlement)
router.post("/buyTokens", validateJWT, async (req: Request, res: Response) => {
  try {
    const prisma = databaseService.getClient();
    const tokenUser = (req as any).user as any;

    const usuario = await obtener_usuario_de_token(tokenUser, prisma);
    if (!usuario) {
      sendError(
        res,
        "Se requiere usuario autenticado",
        StatusFlowCodes.INVALID_INPUT,
        { error: "Se requiere usuario autenticado" },
      );
      return;
    }

    const { amount, holder, signature, signedMessage } = req.body;

    if (!amount) {
      sendError(res, "Se requiere amount", StatusFlowCodes.INVALID_INPUT, {
        error: "Se requiere amount",
      });
      return;
    }

    // Usar holder si se proporciona, sino usar la wallet vinculada del usuario
    const wallet_address = holder || usuario.solana_public_key;
    if (!wallet_address) {
      sendError(
        res,
        "No se proporciona wallet. Vincula una wallet Solana o proporciona holder.",
        StatusFlowCodes.INVALID_INPUT,
        { error: "No se proporciona wallet" },
      );
      return;
    }

    // ========== PHASE 1: FAST PATH (≈100ms) ==========
    // 1. Get SOL/USD price from aggregated price service (cached)
    let solPriceUsd: number;
    try {
      solPriceUsd = await priceService.getPrice("SOL");
    } catch (priceErr) {
      loggerService.logError(priceErr as Error, {
        context: "buyTokens - price fetch failed",
      });
      return sendSFStatus(
        res,
        503,
        StatusFlow({
          code: StatusFlowCodes.SERVICE_UNAVAILABLE,
          lang: "es",
          extra: {
            error: "Precio no disponible (cargando). Intente más tarde.",
          },
        }),
      );
    }

    // 2. Get ProWallet token price from bonding curve (calculated dynamically)
    let tokenPriceUsd: number;
    try {
      const PROWALLET_CONFIG = {
        basePrice: parseFloat(process.env.BASE_TOKEN_PRICE || "0.01"),
        maxSupply: parseInt(process.env.MAX_SUPPLY || "1000000000000000000"),
        bonding_curve_multiplier: parseFloat(
          process.env.BONDING_CURVE_MULTIPLIER || "1.5",
        ),
        pricing_mode: (process.env.PRICING_MODE || "bonding").toLowerCase(),
      };

      let currentSupply: number = 0;
      if (PROWALLET_CONFIG.pricing_mode === "bonding") {
        try {
          const tokenMint = process.env.TOKEN_MINT;
          if (!tokenMint) throw new Error("TOKEN_MINT no configurado");

          // Prefer solanaService wrapper (retry + fallback)
          currentSupply = await (solanaService as any).getTokenSupply(
            new PublicKey(tokenMint),
          );
        } catch (supplyErr) {
          loggerService.logError(supplyErr as Error, {
            context: "Could not fetch token supply in buyTokens",
          });
          currentSupply = 0;
        }
      }

      const basePrice = PROWALLET_CONFIG.basePrice;
      const multiplier = PROWALLET_CONFIG.bonding_curve_multiplier;
      const safeSupply =
        typeof currentSupply === "number" && currentSupply > 0
          ? currentSupply
          : 0;

      tokenPriceUsd =
        safeSupply > 0
          ? basePrice *
            Math.pow(safeSupply / PROWALLET_CONFIG.maxSupply, multiplier)
          : basePrice;
    } catch (tokenPriceErr) {
      loggerService.logError(tokenPriceErr as Error, {
        context: "buyTokens - token price calculation failed",
      });
      return sendSFStatus(
        res,
        503,
        StatusFlow({
          code: StatusFlowCodes.SERVICE_UNAVAILABLE,
          lang: "es",
          extra: {
            error: "Precio del token no disponible. Intente más tarde.",
          },
        }),
      );
    }

    const pricePerTokenInSol = tokenPriceUsd / solPriceUsd; // ✅ Dynamic token price

    // 3. Calculate total cost
    const totalTokenAmount = parseFloat(amount);
    const totalPriceInSol = pricePerTokenInSol * totalTokenAmount;
    const gasFeeSol = parseFloat(process.env.GAS_ESTIMATE_SOL || "0.000005");
    const platformCommissionSol = parseFloat(
      process.env.PLATFORM_COMMISSION_SOL || "0.000005",
    );
    const totalFeesSol = gasFeeSol + platformCommissionSol;
    const paymentAmountTotal = totalPriceInSol + totalFeesSol;

    // ✅ VALIDACIÓN DE SEGURIDAD: Verificar balance disponible
    // El usuario debe tener suficiente SOL para cubrir: token + fees
    let walletBalance: number | null = null;
    try {
      const { PublicKey, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
      const connection = solanaService.getConnection();
      const walletKey = new PublicKey(wallet_address);
      const balanceLamports = await connection.getBalance(walletKey);
      walletBalance = balanceLamports / 1e9; // Convertir lamports a SOL

      loggerService.logInfo("💳 Balance check", {
        context: "buyTokens",
        wallet: walletKey.toString().slice(-6),
        available: walletBalance.toFixed(6),
        required: paymentAmountTotal.toFixed(9),
        sufficient: walletBalance >= paymentAmountTotal,
      });

      // Si no tiene suficiente balance, rechazar
      if (walletBalance < paymentAmountTotal) {
        return sendSFStatus(
          res,
          402, // 402 Payment Required
          StatusFlow({
            code: StatusFlowCodes.BAD_REQUEST,
            lang: "es",
            extra: {
              error: "Balance insuficiente en tu wallet",
              available: parseFloat(walletBalance.toFixed(6)),
              required: parseFloat(paymentAmountTotal.toFixed(6)),
              shortfall: parseFloat(
                (paymentAmountTotal - walletBalance).toFixed(6),
              ),
            },
          }),
        );
      }
    } catch (balanceCheckErr) {
      // Si no podemos verificar el balance, log pero continua
      // (la validación ocurrirá on-chain de todas formas)
      loggerService.logError(balanceCheckErr as Error, {
        context: "buyTokens - wallet balance check",
      });
    }

    loggerService.logInfo("💳 BuyTokens - FAST PATH", {
      context: "buyTokens",
      email: usuario.email,
      tokenAmount: totalTokenAmount,
      solPrice: solPriceUsd,
      tokenPrice: tokenPriceUsd,
      pricePerToken: pricePerTokenInSol,
      totalPriceInSol: totalPriceInSol.toFixed(9),
      fees: totalFeesSol.toFixed(9),
      total: paymentAmountTotal.toFixed(9),
    });

    // 3. Create ledger entry in DB (synchronous)
    const walletAddress = wallet_address;
    const transaction = await prisma.transaction.create({
      data: {
        transactionId: `buy-${Date.now()}-${walletAddress.slice(-6)}`,
        walletAddress: walletAddress,
        transactionType: "purchase",
        tokenAmount: totalTokenAmount,
        paymentAmount: parseFloat(paymentAmountTotal.toFixed(9)),
        paymentToken: "SOL",
        tokenPrice: pricePerTokenInSol,
        status: "pending", // Start as pending, will update when on-chain settles
        minting: false,
        minted: false,
        metadata: JSON.stringify({
          solPrice: String(solPriceUsd),
          tokenPrice: String(tokenPriceUsd),
          pricePerToken: String(pricePerTokenInSol),
          gasFee: String(gasFeeSol),
          platformCommission: String(platformCommissionSol),
          totalFees: String(totalFeesSol),
          originalAmount: String(totalPriceInSol),
          signature: signature || null,
          signedMessage: signedMessage || null,
          settlementStarted: false,
        }),
      },
    });

    console.log("✅ Ledger entry created:", {
      transactionId: transaction.transactionId,
      status: transaction.status,
      minted: transaction.minted,
    });

    // ========== PHASE 2: ASYNC PATH (runs in background) ==========
    // Start on-chain settlement WITHOUT waiting (fire-and-forget)
    setImmediate(async () => {
      try {
        console.log(
          `🚀 Starting async auto-settle for ${transaction.transactionId}...`,
        );

        // Mark as settling started
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            minting: true,
            mintStartedAt: new Date(),
            metadata: JSON.stringify({
              ...(JSON.parse(transaction.metadata || "{}") as any),
              settlementStarted: true,
              settlementStartedAt: new Date().toISOString(),
            }),
          },
        });

        // Attempt to settle with retries
        const settlementResult = await autoSettleWithRetry(
          transaction.transactionId,
          walletAddress,
          totalTokenAmount,
          signature || "", // Payment signature (optional for CEX ledger-only)
        );

        if (settlementResult.success) {
          console.log(
            `✅ Auto-settle succeeded for ${transaction.transactionId}:`,
            settlementResult.signature,
          );

          // Update transaction with on-chain data
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: "success",
              minted: true,
              minting: false,
              mintSignature: settlementResult.signature,
              completedAt: new Date(),
              metadata: JSON.stringify({
                ...(JSON.parse(transaction.metadata || "{}") as any),
                mintSignature: settlementResult.signature,
                settlementSuccess: true,
                settlementAttempts: settlementResult.attempt,
              }),
            },
          });
        } else {
          console.error(
            `❌ Auto-settle failed for ${transaction.transactionId}: ${settlementResult.error}`,
          );

          // Keep status as "pending" - retry will happen via worker
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              minting: false,
              metadata: JSON.stringify({
                ...(JSON.parse(transaction.metadata || "{}") as any),
                settlementSuccess: false,
                settlementError: settlementResult.error,
                settlementAttempts: settlementResult.attempt,
                requiresManualReview:
                  settlementResult.attempt >= settlementResult.totalAttempts,
              }),
            },
          });
        }
      } catch (settleError) {
        console.error(
          `⚠️ Unexpected error in async settlement: ${
            settleError instanceof Error ? settleError.message : "Unknown error"
          }`,
        );

        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            minting: false,
            metadata: JSON.stringify({
              ...(JSON.parse(transaction.metadata || "{}") as any),
              settlementError:
                settleError instanceof Error
                  ? settleError.message
                  : "Unexpected error",
            }),
          },
        });
      }
    });

    // ========== PHASE 1 RESPONSE: Return immediately (don't wait for on-chain) ==========
    sendSuccess(
      res,
      {
        message: "Compra registrada",
        transaction: {
          transactionId: transaction.transactionId,
          status: transaction.status,
          tokenAmount: transaction.tokenAmount,
          paymentAmount: transaction.paymentAmount,
          solPrice: solPriceUsd,
          pricePerToken: pricePerTokenInSol,
          fees: totalFeesSol,
          note: "Token en ledger inmediatamente. Settlement on-chain en progreso...",
        },
      },
      "Compra registrada",
      StatusFlowCodes.OK,
    );
  } catch (error) {
    console.error("Error in buyTokens:", error);
    sendError(
      res,
      error instanceof Error ? error.message : "Error al comprar tokens",
      StatusFlowCodes.INTERNAL_SERVER_ERROR,
      { error: error instanceof Error ? error.message : String(error) },
    );
  }
});

// POST /exchange/transferTokens - Transferir tokens
router.post(
  "/transferTokens",
  validateJWT,
  async (req: Request, res: Response) => {
    try {
      const prisma = databaseService.getClient();
      const tokenUser = (req as any).user as any;

      const usuario_remitente = await obtener_usuario_de_token(
        tokenUser,
        prisma,
      );
      if (!usuario_remitente) {
        return res.status(401).json(
          StatusFlow({
            code: StatusFlowCodes.UNAUTHORIZED,
            lang: "es",
            extra: {
              error: "Se requiere usuario autenticado",
            },
          }),
        );
      }

      const { to, amount, signature, signedMessage } = req.body;

      if (!to || !amount) {
        return res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.INVALID_INPUT,
            lang: "es",
            extra: {
              error: "Se requieren to (email) y amount",
            },
          }),
        );
      }

      // Validar que el recipient existe
      const recipient = await prisma.user.findUnique({
        where: { email: to },
        select: { id: true, email: true },
      });

      if (!recipient) {
        return res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.INVALID_INPUT,
            lang: "es",
            extra: {
              error: "El recipient no existe",
            },
          }),
        );
      }

      // Validar firma si se proporciona
      if (signature && signedMessage) {
        loggerService.logInfo("✓ Firma recibida para validación", {
          context: "transferTokens",
          signature: signature.substring(0, 20) + "...",
          message: signedMessage.substring(0, 50) + "...",
          from: usuario_remitente.email,
          to,
        });
      }

      // Verificar balance del emisor usando UserTransaction
      const senderTransactions = await prisma.userTransaction.findMany({
        where: {
          email: usuario_remitente.email,
          status: "completed",
        },
      });

      let senderBalance = 0;
      for (const tx of senderTransactions) {
        if (tx.type === "purchase" || tx.type === "claim") {
          senderBalance += Number(tx.amountTokens) / 1e9;
        } else if (tx.type === "stake") {
          senderBalance -= Number(tx.amountTokens) / 1e9;
        } else if (tx.type === "unstake") {
          senderBalance += Number(tx.amountTokens) / 1e9;
        } else if (tx.type === "transfer") {
          senderBalance -= Number(tx.amountTokens) / 1e9;
        }
      }

      if (senderBalance < amount) {
        return res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.INVALID_INPUT,
            lang: "es",
            extra: {
              error: "Saldo insuficiente para transferir",
              currentBalance: senderBalance,
              requestedAmount: amount,
            },
          }),
        );
      }

      // Crear transacción de transferencia (outgoing para remitente)
      const transaction = await prisma.userTransaction.create({
        data: {
          email: usuario_remitente.email,
          type: "transfer",
          amountTokens: BigInt(Math.round(amount * 1e9)),
          amountUsd: 0,
          priceAtTx: 0,
          status: "completed",
        },
      });

      // Crear transacción de recepción para el recipient
      await prisma.userTransaction.create({
        data: {
          email: to,
          type: "transfer",
          amountTokens: BigInt(Math.round(amount * 1e9)),
          amountUsd: 0,
          priceAtTx: 0,
          status: "completed",
        },
      });

      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            message: "Tokens transferidos exitosamente",
            from: usuario_remitente.email,
            to: to,
            amount: amount,
          },
        }),
      );
    } catch (error) {
      console.error("Error in transferTokens:", error);
      res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: {
            error:
              error instanceof Error
                ? error.message
                : "Error al transferir tokens",
          },
        }),
      );
    }
  },
);

// GET /exchange/history - Obtener historial de transacciones
router.get("/history", validateJWT, async (req: Request, res: Response) => {
  try {
    const prisma = databaseService.getClient();
    const tokenUser = (req as any).user as any;

    const usuario = await obtener_usuario_de_token(tokenUser, prisma);
    if (!usuario) {
      sendError(
        res,
        "Se requiere usuario autenticado",
        StatusFlowCodes.INVALID_INPUT,
        { error: "Se requiere usuario autenticado" },
      );
      return;
    }

    // Obtener historial de transacciones del usuario por email
    const transactions = await prisma.userTransaction.findMany({
      where: {
        email: usuario.email,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    sendSuccess(
      res,
      {
        transactions: transactions.map((t) => ({
          id: t.id,
          email: t.email,
          type: t.type,
          amountTokens: Number(t.amountTokens) / 1e9,
          amountUsd: t.amountUsd,
          priceAtTx: t.priceAtTx,
          status: t.status,
          createdAt: t.createdAt,
        })),
        total: transactions.length,
      },
      "OK",
      StatusFlowCodes.OK,
    );
  } catch (error) {
    loggerService.logError(error as Error, {
      context: "history",
    });
    sendError(
      res,
      "Error al obtener historial",
      StatusFlowCodes.INTERNAL_SERVER_ERROR,
      { error: error instanceof Error ? error.message : "Unknown error" },
    );
  }
});

// GET /exchange/confirmationStatus/:transactionId - Obtener estado de confirmación on-chain
router.get(
  "/confirmationStatus/:transactionId",
  validateJWT,
  async (req: Request, res: Response) => {
    try {
      const prisma = databaseService.getClient();
      const { transactionId } = req.params;
      const tokenUser = (req as any).user as any;

      const usuario = await obtener_usuario_de_token(tokenUser, prisma);
      if (!usuario) {
        return res.status(401).json(
          StatusFlow({
            code: StatusFlowCodes.UNAUTHORIZED,
            lang: "es",
            extra: {
              error: "Se requiere usuario autenticado",
            },
          }),
        );
      }

      if (!transactionId) {
        return res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.INVALID_INPUT,
            lang: "es",
            extra: {
              error: "Se requiere transactionId",
            },
          }),
        );
      }

      // Verify transaction exists and user has access to it
      // For now, just verify it exists
      const transaction = await prisma.transaction.findUnique({
        where: { transactionId },
      });

      if (!transaction) {
        return res.status(404).json(
          StatusFlow({
            code: StatusFlowCodes.NOT_FOUND,
            lang: "es",
            extra: { error: "Transacción no encontrada" },
          }),
        );
      }

      // Get confirmation status
      const confirmationData =
        await TransactionValidatorService.getConfirmationStatus(transactionId);

      const metadata = (transaction.metadata as any) || {};
      const onChainValidation = metadata.onChainValidation || null;

      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            transaction: {
              transactionId: transaction.transactionId,
              status: transaction.status,
              minted: transaction.minted,
              mintSignature: transaction.mintSignature,
            },
            confirmation: {
              status: onChainValidation?.status || "pending",
              blockSlot: onChainValidation?.blockSlot,
              blockTime: onChainValidation?.blockTime,
              fees: onChainValidation?.fees,
              instructionCount: onChainValidation?.instructionCount,
              confirmationTimeMs: onChainValidation?.confirmationTimeMs,
              retrievedAt: onChainValidation?.retrievedAt,
              validatedAt: onChainValidation?.validatedAt,
              error: onChainValidation?.error,
            },
          },
        }),
      );
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "confirmationStatus",
      });
      res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: {
            error:
              error instanceof Error
                ? error.message
                : "Error al obtener estado de confirmación",
          },
        }),
      );
    }
  },
);

// POST /exchange/validatePending - Validar todas las transacciones pendientes (admin)
router.post(
  "/validatePending",
  validateJWT,
  async (req: Request, res: Response) => {
    try {
      const tokenUser = (req as any).user as any;

      // This should be restricted to admins, but for now just validate JWT
      if (!tokenUser) {
        return res.status(401).json(
          StatusFlow({
            code: StatusFlowCodes.UNAUTHORIZED,
            lang: "es",
          }),
        );
      }

      const result =
        await TransactionValidatorService.validatePendingTransactions();

      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            validationSummary: {
              checked: result.checked,
              confirmed: result.confirmed,
              timedOut: result.timedOut,
              errors: result.errors.length,
            },
            errors: result.errors.slice(0, 10), // Return first 10 errors
          },
        }),
      );
    } catch (error) {
      res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: {
            error:
              error instanceof Error
                ? error.message
                : "Error validando transacciones pendientes",
          },
        }),
      );
    }
  },
);

export default router;

// Mount sub-routers
router.use("/", priceRouter);
