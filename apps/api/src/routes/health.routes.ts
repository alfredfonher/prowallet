import { Router, Request, Response } from "express";
import { solanaService } from "../services/solana.service";
import { StatusFlow, StatusFlowCodes } from "status-flow";

const router: Router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Verificar el estado básico de salud de la API
 *     description: Endpoint para verificar que la API esté funcionando correctamente con información básica del sistema
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: API funcionando correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-01T00:00:00.000Z"
 *                 uptime:
 *                   type: number
 *                   description: "Tiempo de actividad en segundos"
 *                   example: 3600
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 node:
 *                   type: string
 *                   description: "Versión de Node.js"
 *                   example: "v18.17.0"
 *                 platform:
 *                   type: string
 *                   example: "linux"
 *                 arch:
 *                   type: string
 *                   example: "x64"
 *                 memory:
 *                   type: object
 *                   properties:
 *                     used:
 *                       type: number
 *                       description: "Memoria usada en MB"
 *                       example: 45.2
 *                     total:
 *                       type: number
 *                       description: "Memoria total disponible en MB"
 *                       example: 512.0
 *                     free:
 *                       type: number
 *                       description: "Memoria libre en MB"
 *                       example: 466.8
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "unhealthy"
 *                 error:
 *                   type: string
 *                   example: "Error message"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-01T00:00:00.000Z"
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "1.0.0",
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: {
        used:
          Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) /
          100,
        total:
          Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) /
          100,
        free:
          Math.round(
            ((process.memoryUsage().heapTotal -
              process.memoryUsage().heapUsed) /
              1024 /
              1024) *
              100,
          ) / 100,
      },
    };

    res.json(
      StatusFlow({
        code: StatusFlowCodes.OK,
        lang: "es",
        extra: health,
      }),
    );
  } catch (error) {
    res.status(500).json(
      StatusFlow({
        code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
        lang: "es",
        extra: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }),
    );
  }
});

/**
 * @swagger
 * /health/solana:
 *   get:
 *     summary: Verificar la conexión con la red Solana
 *     description: Endpoint para verificar que la conexión con la red Solana esté funcionando correctamente
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Conexión con Solana exitosa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 network:
 *                   type: string
 *                   example: "devnet"
 *                 rpcUrl:
 *                   type: string
 *                   example: "https://api.devnet.solana.com"
 *                 programId:
 *                   type: string
 *                   example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-01T00:00:00.000Z"
 *       503:
 *         description: Error de conexión con Solana
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "unhealthy"
 *                 error:
 *                   type: string
 *                   example: "Failed to connect to Solana network"
 *                 network:
 *                   type: string
 *                   example: "devnet"
 *                 rpcUrl:
 *                   type: string
 *                   example: "https://api.devnet.solana.com"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-01T00:00:00.000Z"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/solana", async (req: Request, res: Response) => {
  try {
    const isConnected = await solanaService.checkConnection();
    const networkInfo = solanaService.getNetworkInfo();

    if (isConnected) {
      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            status: "healthy",
            network: networkInfo.network,
            rpcUrl: networkInfo.rpcUrl,
            programId: networkInfo.programId,
          },
        }),
      );
    } else {
      res.status(503).json(
        StatusFlow({
          code: StatusFlowCodes.SERVICE_UNAVAILABLE,
          lang: "es",
          extra: {
            status: "unhealthy",
            error: "Failed to connect to Solana network",
            network: networkInfo.network,
            rpcUrl: networkInfo.rpcUrl,
          },
        }),
      );
    }
  } catch (error) {
    res.status(500).json(
      StatusFlow({
        code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
        lang: "es",
        extra: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }),
    );
  }
});

/**
 * @swagger
 * /health/deep:
 *   get:
 *     summary: Verificación profunda de salud de todos los servicios
 *     description: Endpoint para verificar el estado de salud de todos los servicios incluyendo API, Solana y el contrato ProWallet
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Todos los servicios funcionando correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-01T00:00:00.000Z"
 *                 checks:
 *                   type: object
 *                   properties:
 *                     api:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: "healthy"
 *                     solana:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: "healthy"
 *                         network:
 *                           type: string
 *                           example: "devnet"
 *                         rpcUrl:
 *                           type: string
 *                           example: "https://api.devnet.solana.com"
 *                         programId:
 *                           type: string
 *                           example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
 *                     prowallet:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: "healthy"
 *                         accountsCount:
 *                           type: number
 *                           example: 5
 *       503:
 *         description: Uno o más servicios con problemas (estado degradado)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "degraded"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-01T00:00:00.000Z"
 *                 checks:
 *                   type: object
 *                   description: "Detalles de cada servicio verificado"
 *       500:
 *         description: Error crítico en los servicios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "unhealthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-01T00:00:00.000Z"
 *                 checks:
 *                   type: object
 *                   description: "Detalles de cada servicio verificado"
 */
router.get("/deep", async (req: Request, res: Response) => {
  const checks: any = {
    api: { status: "healthy" },
    solana: { status: "unknown" },
    prowallet: { status: "unknown" },
  };

  let overallStatus = "healthy";

  try {
    // Check Solana connection
    const solanaConnected = await solanaService.checkConnection();
    checks.solana = {
      status: solanaConnected ? "healthy" : "unhealthy",
      ...solanaService.getNetworkInfo(),
    };

    if (!solanaConnected) {
      overallStatus = "degraded";
    }

     // Check ProWallet contract
    try {
      const programAccounts = await solanaService.getProgramAccounts();
      checks.prowallet = {
        status: "healthy",
        accountsCount: programAccounts.length,
      };
    } catch (error) {
      checks.prowallet = {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
      };
      overallStatus = "degraded";
    }
  } catch (error) {
    overallStatus = "unhealthy";
  }

  const statusCode =
    overallStatus === "healthy"
      ? 200
      : overallStatus === "degraded"
        ? 503
        : 500;

  res.status(statusCode).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  });
});

export default router;
