import { Router, Request, Response } from "express";
import type { Router as ExpressRouter } from "express";
import crypto from "crypto";
import { notificationsService } from "../../services/notifications.service";

const router: ExpressRouter = Router();

// SSE stream endpoint
router.get("/stream", (req: Request, res: Response) => {
  const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  notificationsService.addClient(clientId, res);
});

// Debug: list connected SSE clients (temporary, safe for local debugging)
router.get("/clients", (req: Request, res: Response) => {
  try {
    const ids = notificationsService.getClientIds();
    res.json({ success: true, count: ids.length, ids });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// Debug: trigger a test event from the server (temporary)
router.post("/test", (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const event = body.event || "purchase.completed";
    const payload = body.payload || {
      transactionId: `test-${Date.now()}`,
      minted: true,
      note: "test event",
    };

    notificationsService.broadcast(event, payload);

    res.json({
      success: true,
      message: "Test event broadcasted",
      event,
      payload,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

// Metrics endpoint for notifications (debug)
router.get("/metrics", (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const svc =
      require("../../services/notifications.service").notificationsService;
    // access metrics if present
    const metrics = svc && svc.metrics ? svc.metrics : null;
    return res.json({
      success: true,
      clientCount: svc.clientCount(),
      metrics,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, error: (e as Error).message });
  }
});

// Generic webhook receiver (external systems can POST here)
router.post("/webhook", (req: Request, res: Response) => {
  try {
    const body = req.body || {};

    // If a secret is configured, verify incoming signature
    const secret = process.env.PROWALLET_WEBHOOK_SECRET || "";
    if (secret) {
      const incoming = (req.get("X-PROWALLET-SIGNATURE") ||
        req.get("x-prowallet-signature") ||
        "") as string;

      if (!incoming) {
        return res.status(401).json({
          success: false,
          error: "Falta el header de firma",
        });
      }

      const expected = `sha256=${crypto
        .createHmac("sha256", secret)
        .update(JSON.stringify(body))
        .digest("hex")}`;

      try {
        const a = Buffer.from(incoming);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          return res.status(401).json({
            success: false,
            error: "Invalid signature",
          });
        }
      } catch (e) {
        return res.status(401).json({
          success: false,
          error: "Invalid signature format",
        });
      }
    }

    // Support both `type` (preferred) and `event` (common external naming)
    const event = body.type || body.event || "webhook_event";
    const payload = body.payload || body || {};

    notificationsService.broadcast(event, payload);

    res.json({ success: true, message: "Webhook broadcasted" });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
});

export default router;
