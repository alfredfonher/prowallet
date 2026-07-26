import { Router, Request, Response } from "express";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import { PrismaClient } from "@prisma/client";
import { requestLoggerMiddleware } from "../../services/logging/logger.service";
import { validateJWT } from "../../middleware/jwt";

const router: Router = Router();
const prisma = new PrismaClient();

router.use(requestLoggerMiddleware);

// GET /users/wallets - Get all wallets from users (for transfer dropdown)
// No auth required - returns wallet addresses with user details
router.get("/wallets", async (req: Request, res: Response): Promise<void> => {
  try {
    const mvp_users = await prisma.user.findMany({
      where: {
        solanaPublicKey: {
          not: null,
        },
      },
      select: {
        id: true,
        email: true,
        solanaPublicKey: true,
      },
      orderBy: {
        email: "asc",
      },
    });

    const wallets = mvp_users
      .map((user: any) => ({
        id: user.id,
        address: user.solanaPublicKey,
        label: user.email || user.solanaPublicKey,
        username: user.email,
      }))
      .filter((w: any) => w.address);

    res.json(
      StatusFlow({
        code: StatusFlowCodes.OK,
        lang: "es",
        extra: {
          wallets,
          total: wallets.length,
        },
      }),
    );
  } catch (error) {
    console.error("Error fetching wallets:", error);
    res.status(500).json(
      StatusFlow({
        code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
        lang: "es",
        extra: {
          error: "Error fetching wallets",
        },
      }),
    );
  }
});

// GET /users/list - Get user list (authenticated, more detailed)
router.get(
  "/list",
  validateJWT,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const users = await prisma.user.findMany({
        where: {
          solanaPublicKey: {
            not: null,
          },
        },
        select: {
          id: true,
          email: true,
          solanaPublicKey: true,
        },
        orderBy: {
          email: "asc",
        },
      });

      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            users: users.map((u: any) => ({
              id: u.id,
              wallet: u.solanaPublicKey,
              username: u.email,
            })),
          },
        }),
      );
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: {
            error: "Error fetching users",
          },
        }),
      );
    }
  },
);

// GET /users/check/:walletAddress - Check if wallet is registered in system
router.get(
  "/check/:walletAddress",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { walletAddress } = req.params;

      if (!walletAddress) {
        res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.BAD_REQUEST,
            lang: "es",
            extra: {
              error: "La dirección de wallet es requerida",
            },
          }),
        );
        return;
      }

      const user = await prisma.user.findFirst({
        where: {
          solanaPublicKey: walletAddress,
        },
        select: {
          id: true,
          email: true,
          solanaPublicKey: true,
        },
      });

      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            is_registered: !!user,
            user: user
              ? {
                  id: user.id,
                  username: user.email,
                  wallet: user.solanaPublicKey,
                }
              : null,
          },
        }),
      );
    } catch (error) {
      console.error("Error checking wallet:", error);
      res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: {
            error: "Error checking wallet",
          },
        }),
      );
    }
  },
);

export default router;
