import { Response } from "express";
import crypto from "crypto";
import { loggerService } from "./logging/logger.service";

// Read external webhook targets from env (comma-separated)
const OUTBOUND_WEBHOOK_URLS = (
  process.env.OUTBOUND_WEBHOOK_URLS ||
  process.env.N8N_WEBHOOK_URLS ||
  ""
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const OUTBOUND_TIMEOUT_MS =
  Number(process.env.OUTBOUND_WEBHOOK_TIMEOUT_MS) || 8000;
const OUTBOUND_RETRY = Number(process.env.OUTBOUND_WEBHOOK_RETRY || "2");
const WEBHOOK_SECRET = process.env.PROWALLET_WEBHOOK_SECRET || "";

type SSEClient = {
  id: string;
  res: Response;
};

class NotificationsService {
  private clients: Map<string, SSEClient> = new Map();
  // Simple in-memory metrics for debugging (not persisted)
  private metrics = {
    broadcasts: 0,
    sseWritesSuccess: 0,
    sseWritesFailed: 0,
    lastBroadcastAt: null as string | null,
  };

  addClient(id: string, res: Response) {
    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    // Allow cross-origin EventSource during development / local testing
    // In production, prefer explicit origin or proxy via same origin.
    res.setHeader("Access-Control-Allow-Origin", "*");
    // Disable buffering in some proxies (nginx) so events flush immediately
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const client: SSEClient = { id, res };
    this.clients.set(id, client);

    // Send a welcome event
    res.write(`event: connected\n`);
    res.write(
      `data: ${JSON.stringify({ message: "connected", clientId: id })}\n\n`,
    );

    // When the connection closes, remove the client
    reqOnClose(res, () => {
      this.clients.delete(id);
    });
  }
  broadcast(event: string, payload: Record<string, any>) {
    const data = JSON.stringify({ type: event, payload });
    // Log broadcasting attempt (temporary debug)
    try {
      loggerService.logInfo("Broadcasting SSE event", {
        event,
        clientCount: this.clientCount(),
      });
    } catch (e) {
      // ignore logger errors
      try {
        // fallback console
        // eslint-disable-next-line no-console
        console.log("Broadcasting SSE event", {
          event,
          clientCount: this.clientCount(),
        });
      } catch {}
    }

    for (const [, client] of this.clients) {
      try {
        client.res.write(`event: ${event}\n`);
        client.res.write(`data: ${data}\n\n`);
        this.metrics.sseWritesSuccess += 1;
      } catch (e) {
        // Log the write error and remove client
        try {
          loggerService.logError(e as Error, {
            context: "notifications.broadcast.write",
            clientId: client.id,
            event,
          });
          this.metrics.sseWritesFailed += 1;
        } catch {}
        try {
          client.res.end();
        } catch {}
        this.clients.delete(client.id);
      }
    }

    // Fire-and-forget: forward to configured external webhook URLs (e.g., n8n)
    if (OUTBOUND_WEBHOOK_URLS.length > 0) {
      const body = { event, payload, sentAt: new Date().toISOString() };
      for (const url of OUTBOUND_WEBHOOK_URLS) {
        this.postWithRetry(
          url,
          body,
          OUTBOUND_RETRY,
          OUTBOUND_TIMEOUT_MS,
        ).catch((err) => {
          loggerService.logError(err as Error, {
            context: "outbound-webhook",
            url,
            event,
          });
        });
      }
    }

    // update metrics and timestamp
    try {
      this.metrics.broadcasts += 1;
      this.metrics.lastBroadcastAt = new Date().toISOString();
    } catch {}

    // Additionally, emit via socket.io if available (best-effort)
    try {
      // Lazy require to avoid hard dependency at startup
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const socketService = require("./socket.service").default;
      // If payload contains purchaseId or transactionId, emit to that room
      const purchaseId =
        (payload && (payload.purchaseId || payload.transactionId)) || null;
      if (purchaseId) {
        try {
          socketService.emitToPurchase(purchaseId, event, payload);
        } catch (e) {
          // ignore
        }
      }

      // Broadcast globally as well
      try {
        socketService.broadcast(event, payload);
      } catch (e) {
        // ignore
      }
    } catch (e) {
      // socket.io not present or failed; ignore to keep notification flow working
    }
  }

  private async postWithRetry(
    url: string,
    body: Record<string, any>,
    retries: number,
    timeoutMs: number,
  ): Promise<void> {
    let attempt = 0;
    const backoffBase = 500;

    while (attempt <= retries) {
      attempt++;
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);

        // Compute HMAC signature if secret is configured
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (WEBHOOK_SECRET) {
          try {
            const payloadString = JSON.stringify(body);
            const hmac = crypto
              .createHmac("sha256", WEBHOOK_SECRET)
              .update(payloadString)
              .digest("hex");

            headers["X-PROWALLET-SIGNATURE"] = `sha256=${hmac}`;
          } catch (e) {
            // Don't fail entirely if signing fails; log and continue without signature
            loggerService.logError(e as Error, {
              context: "webhook-signing",
              url,
            });
          }
        }

        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal as any,
        });

        clearTimeout(id);

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            `Webhook POST to ${url} failed: ${res.status} ${res.statusText} ${text}`,
          );
        }

        // success
        loggerService.logInfo("Outbound webhook delivered", {
          url,
          event: body.event,
        });
        return;
      } catch (err) {
        const isAbort = (err as any)?.name === "AbortError";
        loggerService.logInfo(`Outbound webhook attempt ${attempt} failed`, {
          url,
          attempt,
          error: (err as Error).message || String(err),
          timeout: timeoutMs,
          aborted: isAbort,
        });

        if (attempt > retries) throw err;

        // backoff
        const delay = backoffBase * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  clientCount() {
    return this.clients.size;
  }

  /**
   * Dev helper: return connected client ids (temporary, for debugging)
   */
  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }
}

// Helper to attach close handler to Response
function reqOnClose(res: Response, cb: () => void) {
  // @ts-ignore - express Response inherits from Node's Stream
  const socket = (res as any).req?.socket || (res as any).socket;
  if (socket) {
    socket.on("close", cb);
    socket.on("end", cb);
  }
}

export const notificationsService = new NotificationsService();

export default notificationsService;
