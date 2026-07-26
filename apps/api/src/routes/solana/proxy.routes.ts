import { Router, Request, Response } from "express";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import axios from "axios";
import rateLimit from "express-rate-limit";
import { loggerService } from "../../services/logging/logger.service";

const router: Router = Router();

// Rate limiting para proxy RPC (más permisivo para transacciones reales)
const proxyRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 50, // 50 requests por minuto por IP
  message: {
    success: false,
    error: "Too many RPC requests. Please wait before trying again.",
    retryAfter: "1 minute",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Lista de RPCs de fallback para mainnet-beta
const MAINNET_RPCS = [
  process.env.SOLANA_RPC_URL,
  "https://api.mainnet-beta.solana.com",
].filter(Boolean) as string[];

let currentRPCIndex = 0;

/**
 * @swagger
 * /api/v1/solana/rpc:
 *   post:
 *     summary: Proxy para RPC de Solana
 *     description: Proxy que reenvía requests RPC a Solana devnet con fallback automático
 *     tags: [Solana]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               method:
 *                 type: string
 *                 example: "getLatestBlockhash"
 *               params:
 *                 type: array
 *                 example: []
 *               id:
 *                 type: number
 *                 example: 1
 *               jsonrpc:
 *                 type: string
 *                 example: "2.0"
 *     responses:
 *       200:
 *         description: RPC response exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Request inválido
 *       503:
 *         description: Todos los RPCs fallaron
 */
router.post("/rpc", proxyRateLimit, async (req: Request, res: Response) => {
  const requestId = (req as any).requestId || loggerService.generateRequestId();
  const startTime = Date.now();

  try {
    const { method, params, id, jsonrpc } = req.body;

    // Validar request básico de RPC
    if (!method || !jsonrpc) {
      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Invalid RPC request",
            details: { code: -32600, message: "Invalid Request" },
          },
        }),
      );
    }

    loggerService.logInfo("Solana RPC proxy request", {
      requestId,
      method,
      paramsCount: Array.isArray(params) ? params.length : 0,
    });

    let response;
    let rpcUsed;
    let attempts = 0;
    const maxAttempts = MAINNET_RPCS.length;

    // Intentar con cada RPC hasta que uno funcione
    while (attempts < maxAttempts) {
      const rpcUrl = MAINNET_RPCS[currentRPCIndex];
      rpcUsed = rpcUrl;

      try {
        response = await axios.post(
          rpcUrl,
          {
            method,
            params,
            id,
            jsonrpc,
          },
          {
            timeout: 15000, // 15 segundos timeout
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        // Si llegamos aquí, el RPC funcionó
        break;
      } catch (rpcError) {
        attempts++;
        currentRPCIndex = (currentRPCIndex + 1) % MAINNET_RPCS.length;

        loggerService.logInfo("RPC attempt failed, trying next", {
          requestId,
          attempt: attempts,
          failedRPC: rpcUrl,
          error: rpcError instanceof Error ? rpcError.message : "Unknown error",
        });

        // Si es el último intento, lanzar error
        if (attempts === maxAttempts) {
          throw rpcError;
        }
      }
    }

    if (!response) {
      throw new Error("All RPC endpoints failed");
    }

    const responseTime = Date.now() - startTime;

    loggerService.logInfo("Solana RPC proxy success", {
      requestId,
      method,
      rpcUsed,
      responseTime: `${responseTime}ms`,
      attempts,
      hasResult: !!response.data.result,
    });

    // Reenviar la respuesta exacta del RPC
    res.json(response.data);
  } catch (error) {
    const responseTime = Date.now() - startTime;

    loggerService.logError(error as Error, {
      requestId,
      context: "solana_rpc_proxy",
      responseTime: `${responseTime}ms`,
      method: req.body.method,
    });

    // Determinar código de error apropiado
    let statusCode = 503;
    let errorMessage = "All Solana RPC endpoints are currently unavailable";

    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        errorMessage = "RPC request timeout. Please try again.";
        statusCode = 408;
      } else if (
        error.message.includes("ENOTFOUND") ||
        error.message.includes("NAME_NOT_RESOLVED")
      ) {
        errorMessage = "DNS resolution failed for Solana RPC endpoints";
        statusCode = 503;
      }
    }

    res.status(statusCode).json(
      StatusFlow({
        code:
          statusCode === 408
            ? StatusFlowCodes.TOO_MANY_REQUESTS
            : StatusFlowCodes.SERVICE_UNAVAILABLE,
        lang: "es",
        extra: {
          error: errorMessage,
          requestId,
        },
      }),
    );
  }
});

/**
 * @swagger
 * /api/v1/solana/rpc/health:
 *   get:
 *     summary: Health check de RPCs
 *     description: Verifica el estado de los RPCs de Solana disponibles
 *     tags: [Solana]
 *     responses:
 *       200:
 *         description: Estado de los RPCs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     rpcs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           url:
 *                             type: string
 *                           status:
 *                             type: string
 *                           responseTime:
 *                             type: number
 */
router.get("/rpc/health", async (req: Request, res: Response) => {
  const requestId = (req as any).requestId || loggerService.generateRequestId();

  try {
    const healthChecks = await Promise.allSettled(
      MAINNET_RPCS.map(async (rpc, index) => {
        const startTime = Date.now();
        try {
          const response = await axios.post(
            rpc,
            {
              method: "getHealth",
              params: [],
              id: 1,
              jsonrpc: "2.0",
            },
            {
              timeout: 5000,
            },
          );

          return {
            url: rpc,
            status: "healthy",
            responseTime: Date.now() - startTime,
            index,
          };
        } catch (error) {
          return {
            url: rpc,
            status: "unhealthy",
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : "Unknown error",
            index,
          };
        }
      }),
    );

    const results = healthChecks.map((result, index) =>
      result.status === "fulfilled"
        ? result.value
        : {
            url: MAINNET_RPCS[index],
            status: "error",
            error: result.reason?.message || "Unknown error",
            index,
          },
    );

    const healthyCount = results.filter((r) => r.status === "healthy").length;

    loggerService.logInfo("RPC health check completed", {
      requestId,
      totalRPCs: MAINNET_RPCS.length,
      healthyCount,
      currentRPCIndex,
    });

    res.json(
      StatusFlow({
        code: StatusFlowCodes.OK,
        lang: "es",
        extra: {
          rpcs: results,
          summary: {
            total: MAINNET_RPCS.length,
            healthy: healthyCount,
            unhealthy: MAINNET_RPCS.length - healthyCount,
            currentRPC: currentRPCIndex,
          },
        },
      }),
    );
  } catch (error) {
    loggerService.logError(error as Error, {
      requestId,
      context: "rpc_health_check",
    });

    res.status(500).json(
      StatusFlow({
        code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
        lang: "es",
        extra: {
          error: "Verificación de salud falló",
          requestId,
        },
      }),
    );
  }
});

export default router;
