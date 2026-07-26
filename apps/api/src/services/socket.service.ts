import { Server as HttpServer } from "http";

let io: any = null;

export function initSocketServer(server: HttpServer) {
  try {
    // Import socket.io lazily so the app can still start if dependency is missing
    // during early development. If socket.io is present, attach it to the HTTP server.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Server } = require("socket.io");

    io = new Server(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      // pingInterval/pingTimeout could be tuned for production
    });

    // If REDIS_URL is configured, attempt to use the redis adapter for scaling
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI || "";
    if (redisUrl) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { createAdapter } = require("@socket.io/redis-adapter");
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { createClient } = require("redis");

        const pubClient = createClient({ url: redisUrl });
        const subClient = pubClient.duplicate();

        // Connect both clients
        Promise.all([pubClient.connect(), subClient.connect()])
          .then(() => {
            io.adapter(createAdapter(pubClient, subClient));
            console.log("[socket.service] redis adapter attached to socket.io");
          })
          .catch((err: any) => {
            console.warn(
              "[socket.service] failed to connect redis clients:",
              err?.message || err,
            );
          });
      } catch (e) {
        console.warn(
          "[socket.service] redis adapter not available:",
          (e as Error)?.message || String(e),
        );
      }
    }

    io.on("connection", (socket: any) => {
      const ua = socket.handshake.headers["user-agent"] || "unknown";
      console.log("[socket.io] client connected", socket.id, ua);

      socket.on("join:purchase", (purchaseId: string) => {
        if (purchaseId) socket.join(`purchase:${purchaseId}`);
      });

      socket.on("leave:purchase", (purchaseId: string) => {
        if (purchaseId) socket.leave(`purchase:${purchaseId}`);
      });

      socket.on("join:wallet", (walletAddr: string) => {
        if (walletAddr) socket.join(`wallet:${walletAddr}`);
      });

      socket.on("disconnect", (reason: any) => {
        console.log("[socket.io] client disconnected", socket.id, reason);
      });
    });

    console.log("[socket.service] socket.io initialized");
  } catch (e) {
    console.warn(
      "[socket.service] socket.io not available or failed to init:",
      (e as Error)?.message || String(e),
    );
  }
}

export function getIo() {
  return io;
}

export function emitToPurchase(
  purchaseId: string,
  event: string,
  payload: any,
) {
  if (!io) return false;
  try {
    io.to(`purchase:${purchaseId}`).emit(event, payload);
    return true;
  } catch (e) {
    console.warn(
      "[socket.service] emitToPurchase failed",
      (e as Error)?.message || String(e),
    );
    return false;
  }
}

export function broadcast(event: string, payload: any) {
  if (!io) return false;
  try {
    io.emit(event, payload);
    return true;
  } catch (e) {
    console.warn(
      "[socket.service] broadcast failed",
      (e as Error)?.message || String(e),
    );
    return false;
  }
}

export default { initSocketServer, getIo, emitToPurchase, broadcast };
