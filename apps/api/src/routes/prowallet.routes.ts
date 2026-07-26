import { Request, Response, Router } from "express";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import { prowalletService } from "../services/prowallet.service";
import { databaseService } from "../services/database/database.service";
import { validateJWT, validateAdmin } from "../middleware/jwt";
import { PublicKey } from "@solana/web3.js";
import { solanaService } from "../services/solana.service";
import { PROWALLET_CONFIG } from "../config";

const router: Router = Router();

// [swagger documentation removed]
router.get("/contract-info", async (req: Request, res: Response) => {
  try {
    const contractInfo = await prowalletService.getContractInfo();
    res.json(
      StatusFlow({
        code: StatusFlowCodes.OK,
        lang: "es",
        extra: contractInfo,
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

// Get wallet GAPC token balance
router.get("/balance/:wallet", async (req: Request, res: Response) => {
  const walletParam = req.params.wallet;

  try {
    if (!walletParam) {
      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: { error: "La dirección de wallet es requerida" },
        }),
      );
    }

    // Validate wallet address format
    try {
      new PublicKey(walletParam);
    } catch (e) {
      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: { error: "Invalid Solana public key" },
        }),
      );
    }

    // Get GAPC token balance
    const balanceInfo = await solanaService.getTokenBalance(
      walletParam,
      PROWALLET_CONFIG.token_mint as string,
    );

    return res.json(
      StatusFlow({
        code: StatusFlowCodes.OK,
        lang: "es",
        extra: {
          balance: balanceInfo.uiAmount,
          wallet: balanceInfo.wallet,
          decimals: balanceInfo.decimals,
        },
      }),
    );
  } catch (error) {
    return res.status(500).json(
      StatusFlow({
        code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
        lang: "es",
        extra: {
          error:
            error instanceof Error
              ? error.message
              : "Failed to get token balance",
        },
      }),
    );
  }
});

// NOTE: All other routes disabled - ProWalletService methods not implemented
// TODO: Implement in Phase 2

// Whitelist endpoints
router.get("/whitelist", async (req: Request, res: Response) => {
  try {
    const prisma = databaseService.getClient();
    const list = await prisma.whitelistEntry.findMany({
      orderBy: { addedAt: "desc" },
    });
    res.json(
      StatusFlow({
        code: StatusFlowCodes.OK,
        lang: "es",
        extra: list,
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

router.get("/whitelist/:wallet", async (req: Request, res: Response) => {
  const { wallet } = req.params;
  try {
    // validate format
    try {
      new PublicKey(wallet);
    } catch (e) {
      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: { error: "Invalid Solana public key" },
        }),
      );
    }

    const prisma = databaseService.getClient();
    const entry = await prisma.whitelistEntry.findUnique({
      where: { wallet },
    });

    res.json(
      StatusFlow({
        code: StatusFlowCodes.OK,
        lang: "es",
        extra: { wallet, whitelisted: !!entry, entry },
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

router.post(
  "/whitelist/add",
  validateJWT,
  validateAdmin,
  async (req: Request, res: Response) => {
    const { wallet, source } = req.body;
    const addedBy = (req as any).user?.username || "unknown";

    if (!wallet) {
      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: { error: "Falta wallet en el cuerpo de la solicitud" },
        }),
      );
    }

    try {
      new PublicKey(wallet);
    } catch (e) {
      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: { error: "Invalid Solana public key" },
        }),
      );
    }

    try {
      const prisma = databaseService.getClient();
      const created = await prisma.whitelistEntry.create({
        data: {
          wallet,
          addedBy,
          source: source || "offchain",
        },
      });

      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: created,
        }),
      );
    } catch (error) {
      // Unique constraint (Prisma P2002) or message contains 'unique'
      const errAny: any = error;
      if (
        (errAny.code && errAny.code === "P2002") ||
        (errAny.message && errAny.message.toLowerCase().includes("unique"))
      ) {
        return res.status(409).json(
          StatusFlow({
            code: StatusFlowCodes.CONFLICT,
            lang: "es",
            extra: { error: "Wallet already whitelisted" },
          }),
        );
      }

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
  },
);

router.post(
  "/whitelist/remove",
  validateJWT,
  validateAdmin,
  async (req: Request, res: Response) => {
    const { wallet } = req.body;
    if (!wallet) {
      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: { error: "Falta wallet en el cuerpo de la solicitud" },
        }),
      );
    }

    try {
      const prisma = databaseService.getClient();
      const deleted = await prisma.whitelistEntry.delete({
        where: { wallet },
      });

      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: deleted,
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
  },
);

export default router;
