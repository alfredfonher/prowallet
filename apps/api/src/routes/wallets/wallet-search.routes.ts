import { Router, Request, Response } from "express";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import { walletSearchService } from "../../services/wallet-search.service";
import { catchAsync } from "../../utils/catchAsync";

const router: Router = Router();

// GET /wallets/search?query=partial&limit=5
// Search wallets with smart ranking and caching
router.get(
  "/search",
  catchAsync(async (req: Request, res: Response) => {
    const { query, limit = "5" } = req.query;

    if (typeof query !== "string") {
      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: { error: "El parámetro de consulta es requerido y debe ser una cadena" },
        }),
      );
    }

    const limitNum = Math.min(parseInt(limit as string) || 5, 10); // Max 10 results

    try {
      const wallets = await walletSearchService.searchWallets(query, limitNum);

      return res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            wallets,
            query,
            count: wallets.length,
            limit: limitNum,
            cacheStatus: walletSearchService.getCacheStatus(),
          },
        }),
      );
    } catch (error) {
      return res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: { error: "Error searching wallets" },
        }),
      );
    }
  }),
);

// POST /wallets/refresh
// Force refresh wallet cache
router.post(
  "/refresh",
  catchAsync(async (req: Request, res: Response) => {
    try {
      const wallets = await walletSearchService.refreshWallets();

      return res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            wallets,
            count: wallets.length,
            cacheStatus: walletSearchService.getCacheStatus(),
            message: "Cache refreshed successfully",
          },
        }),
      );
    } catch (error) {
      return res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: { error: "Error refreshing wallet cache" },
        }),
      );
    }
  }),
);

// GET /wallets/status
// Get cache status
router.get(
  "/status",
  catchAsync(async (req: Request, res: Response) => {
    try {
      const cacheStatus = walletSearchService.getCacheStatus();

      return res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            cacheStatus,
          },
        }),
      );
    } catch (error) {
      return res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: { error: "Error getting cache status" },
        }),
      );
    }
  }),
);

export { router as walletSearchRoutes };
