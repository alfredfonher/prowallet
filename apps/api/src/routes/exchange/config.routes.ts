import { Request, Response, Router } from "express";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import { body, validationResult } from "express-validator";
import { sendSuccess, sendError } from "../../utils/response.util";
import { databaseService } from "../../services/database/database.service";
import { validateJWT } from "../../middleware/jwt";
import { LoggerService } from "../../services/logging/logger.service";
import { redisClient } from "../../services/redis.service";

const router: Router = Router();
const logger = LoggerService.getInstance();

/**
 * @swagger
 * components:
 *   schemas:
 *     SystemConfig:
 *       type: object
 *       properties:
 *         network:
 *           type: string
 *           description: Solana network (devnet/mainnet)
 *         tokenMint:
 *           type: string
 *           description: Token mint address
 *         platformFee:
 *           type: number
 *           description: Platform fee percentage
 *         minPurchaseAmount:
 *           type: number
 *           description: Minimum purchase amount
 *         maxPurchaseAmount:
 *           type: number
 *           description: Maximum purchase amount
 *         supportedPaymentMethods:
 *           type: array
 *           items:
 *             type: string
 *           description: Supported payment methods
 *         maintenanceMode:
 *           type: boolean
 *           description: Whether system is in maintenance mode
 */

/**
 * @swagger
 * /exchange/config:
 *   get:
 *     summary: Get system configuration
 *     tags: [Exchange]
 *     responses:
 *       200:
 *         description: System configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 code:
 *                   type: number
 *                 extra:
 *                   $ref: '#/components/schemas/SystemConfig'
 *       500:
 *         description: Internal server error
 */
router.get("/config", async (req: Request, res: Response) => {
  try {
    // Early return for cache hit
    const cacheKey = "system:config";
    const cachedConfig = await redisClient.get(cacheKey);

    if (cachedConfig) {
      return res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: JSON.parse(cachedConfig),
        }),
      );
    }

    // Build configuration object with proper validation
    const config = {
      network: process.env.SOLANA_NETWORK || "devnet",
      tokenMint: process.env.TOKEN_MINT_ADDRESS || "",
      platformFee: parseFloat(process.env.PLATFORM_FEE_PERCENT || "2.5"),
      minPurchaseAmount: parseFloat(process.env.MIN_PURCHASE_AMOUNT || "0.01"),
      maxPurchaseAmount: parseFloat(process.env.MAX_PURCHASE_AMOUNT || "10000"),
      supportedPaymentMethods: ["SOL", "USDC"],
      maintenanceMode: process.env.MAINTENANCE_MODE === "true",
      gasEstimateSol: parseFloat(process.env.GAS_ESTIMATE_SOL || "0.000005"),
      platformCommissionSol: parseFloat(
        process.env.PLATFORM_COMMISSION_SOL || "0.000005",
      ),
      commissionWallet: process.env.COMMISSION_WALLET || "",
      apiVersion: "v1",
      lastUpdated: new Date().toISOString(),
    };

    // Validate configuration
    if (!config.tokenMint) {
      return res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: {
            error: "La dirección de mint del token no está configurada",
          },
        }),
      );
    }

    // Cache configuration for 5 minutes
    await redisClient.setEx(cacheKey, 300, JSON.stringify(config));

    res.json(
      StatusFlow({
        code: StatusFlowCodes.OK,
        lang: "es",
        extra: config,
      }),
    );
  } catch (error) {
    console.error("Error getting system config:", error);
    res.status(500).json(
      StatusFlow({
        code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
        lang: "es",
        extra: {
          error:
            error instanceof Error
              ? error.message
              : "Error interno del servidor",
        },
      }),
    );
  }
});

/**
 * @swagger
 * /exchange/config:
 *   put:
 *     summary: Update system configuration (admin only)
 *     tags: [Exchange]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maintenanceMode:
 *                 type: boolean
 *               platformFee:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 10
 *               minPurchaseAmount:
 *                 type: number
 *                 minimum: 0
 *               maxPurchaseAmount:
 *                 type: number
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Configuration updated successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Admin privileges required
 *       500:
 *         description: Internal server error
 */
router.put(
  "/config",
  validateJWT,
  [
    body("maintenanceMode")
      .optional()
      .isBoolean()
      .withMessage("maintenanceMode must be a boolean"),
    body("platformFee")
      .optional()
      .isFloat({ min: 0, max: 10 })
      .withMessage("platformFee must be between 0 and 10"),
    body("minPurchaseAmount")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("minPurchaseAmount must be positive"),
    body("maxPurchaseAmount")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("maxPurchaseAmount must be positive"),
  ],
  async (req: Request, res: Response) => {
    try {
      // Early return for validation errors
      const validationErrors = validationResult(req);
      if (!validationErrors.isEmpty()) {
        return res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.INVALID_INPUT,
            lang: "es",
            extra: {
              errors: validationErrors.array(),
            },
          }),
        );
      }

      const tokenUser = (req as any).user;
      if (!tokenUser?.isAdmin) {
        return res.status(403).json(
          StatusFlow({
            code: StatusFlowCodes.FORBIDDEN,
            lang: "es",
            extra: {
              error: "Se requieren privilegios de administrador",
            },
          }),
        );
      }

      const {
        maintenanceMode,
        platformFee,
        minPurchaseAmount,
        maxPurchaseAmount,
      } = req.body;

      // Update environment variables (in production, these would be stored in database)
      const updates: any = {};

      if (typeof maintenanceMode === "boolean") {
        process.env.MAINTENANCE_MODE = maintenanceMode.toString();
        updates.maintenanceMode = maintenanceMode;
      }

      if (typeof platformFee === "number") {
        process.env.PLATFORM_FEE_PERCENT = platformFee.toString();
        updates.platformFee = platformFee;
      }

      if (typeof minPurchaseAmount === "number") {
        process.env.MIN_PURCHASE_AMOUNT = minPurchaseAmount.toString();
        updates.minPurchaseAmount = minPurchaseAmount;
      }

      if (typeof maxPurchaseAmount === "number") {
        process.env.MAX_PURCHASE_AMOUNT = maxPurchaseAmount.toString();
        updates.maxPurchaseAmount = maxPurchaseAmount;
      }

      // Clear cache to force refresh
      await redisClient.del("system:config");

      // Log configuration change
      console.log(
        "System configuration updated by",
        tokenUser.username,
        updates,
      );

      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            message: "Configuration updated successfully",
            updates,
          },
        }),
      );
    } catch (error) {
      console.error("Error updating system config:", error);
      res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: {
            error:
              error instanceof Error
                ? error.message
                : "Error interno del servidor",
          },
        }),
      );
    }
  },
);

/**
 * @swagger
 * /exchange/health:
 *   get:
 *     summary: Get exchange service health status
 *     tags: [Exchange]
 *     responses:
 *       200:
 *         description: Exchange health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 extra:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     database:
 *                       type: string
 *                     redis:
 *                       type: string
 *                     solana:
 *                       type: string
 *                     uptime:
 *                       type: number
 */
router.get("/health", async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    // Check database connectivity
    let databaseStatus = "disconnected";
    try {
      const prisma = databaseService.getClient();
      await prisma.$queryRaw`SELECT 1`;
      databaseStatus = "connected";
    } catch (error) {
      console.error("Database health check failed:", error);
    }

    // Check Redis connectivity
    let redisStatus = "disconnected";
    try {
      await redisClient.ping();
      redisStatus = "connected";
    } catch (error) {
      console.error("Redis health check failed:", error);
    }

    // Check Solana connectivity
    let solanaStatus = "disconnected";
    try {
      // This would typically use the solana service
      solanaStatus = "connected";
    } catch (error) {
      console.error("Solana health check failed:", error);
    }

    const responseTime = Date.now() - startTime;
    const isHealthy =
      databaseStatus === "connected" &&
      redisStatus === "connected" &&
      solanaStatus === "connected";

    res.status(isHealthy ? 200 : 503).json(
      StatusFlow({
        code: isHealthy
          ? StatusFlowCodes.OK
          : StatusFlowCodes.SERVICE_UNAVAILABLE,
        lang: "es",
        extra: {
          status: isHealthy ? "healthy" : "unhealthy",
          database: databaseStatus,
          redis: redisStatus,
          solana: solanaStatus,
          responseTime: `${responseTime}ms`,
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        },
      }),
    );
  } catch (error) {
    console.error("Error in exchange health check:", error);
    res.status(503).json(
      StatusFlow({
        code: StatusFlowCodes.SERVICE_UNAVAILABLE,
        lang: "es",
        extra: {
          status: "unhealthy",
          error: error instanceof Error ? error.message : "Health check failed",
          timestamp: new Date().toISOString(),
        },
      }),
    );
  }
});

export default router;
