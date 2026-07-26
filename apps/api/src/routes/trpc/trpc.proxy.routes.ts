import { Router, Request, Response } from "express";
import type { Router as ExpressRouter } from "express";

const router: ExpressRouter = Router();

// Proxy endpoint to call tRPC router on the server side (optional)
// This allows the frontend to use a simple REST POST while the server
// delegates to the typed tRPC implementation when available.
router.post("/purchase/start", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    // Try to require the tRPC router and call createCaller
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require("../../trpc/router");
      const appRouter = mod.appRouter;
      if (appRouter && typeof appRouter.createCaller === "function") {
        const caller = appRouter.createCaller({ req, res });
        // call purchase.start
        const result = await caller.purchase.start({
          walletAddress: body.walletAddress,
          tokenAmount: body.tokenAmount,
        });
        return res.json(result);
      }
    } catch (e) {
      // fallthrough to legacy behaviour
      console.warn(
        "tRPC router not available or failed:",
        (e as Error)?.message || String(e),
      );
    }

    // If tRPC not available, fallback to existing purchase initiate endpoint
    // Proxy to /purchase/initiate
    const fetchRes = await fetch(
      `${req.protocol}://${req.get("host")}/api/v1/purchase/initiate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    const json = await fetchRes.json();
    return res.status(fetchRes.status).json(json);
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, error: (err as Error).message });
  }
});

export default router;
