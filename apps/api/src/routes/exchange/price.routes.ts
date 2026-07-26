import { Router, Request, Response } from "express";
import type { Router as ExpressRouter } from "express";
import { priceService } from "../../services/price/price.service";

const router: ExpressRouter = Router();

// GET /exchange/solPriceCached - returns cached SOL price if available
router.get("/solPriceCached", async (req: Request, res: Response) => {
  try {
    const meta = await priceService.getPriceWithMetadata("SOL");
    return res.json({
      success: true,
      extra: {
        solPriceUsd: meta.price,
        source: meta.source,
        timestamp: meta.timestamp,
      },
    });
  } catch (e) {
    return res.status(503).json({
      success: false,
      message: "No cached price available",
      code: 503,
    });
  }
});

export default router;
