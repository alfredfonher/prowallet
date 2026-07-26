// Minimal tRPC router scaffold. This file will be used if @trpc/server is available.
// tRPC router: implement purchase.start as a server-side proxy to the existing
// REST endpoint `/api/v1/purchase/initiate`. This avoids duplicating the
// purchase initiation logic while providing a typed RPC surface when
// @trpc/server is installed. The file still requires `@trpc/server` / `zod` at
// runtime; mounting is optional and guarded in `app.ts`.
import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { createContext } from "./context";

const t = initTRPC.context<typeof createContext>().create();

export const appRouter = t.router({
  purchase: t.router({
    start: t.procedure
      .input(
        z.object({
          walletAddress: z.string().min(1),
          tokenAmount: z.number().positive(), // Allow any positive number including decimals < 1
        }),
      )
      .mutation(async ({ input, ctx }) => {
        // Proxy to the existing REST endpoint so we keep one implementation
        // of purchase initiation. Use the original request host/protocol
        // to construct an absolute URL (works in local + container setups).
        try {
          const req = (ctx as any).req;
          const host = req && req.get ? req.get("host") : "localhost:3001";
          const protocol = req && req.protocol ? req.protocol : "http";
          const url = `${protocol}://${host}/api/v1/purchase/initiate`;

          const body = {
            walletAddress: input.walletAddress,
            tokenAmount: input.tokenAmount,
            paymentMethod: "SOL",
          };

          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          const json = await res.json();
          // Return the payload as-is. tRPC caller will receive the same
          // structure that the REST endpoint returns.
          return json;
        } catch (err) {
          // Normalize error for tRPC transport
          throw new Error(err instanceof Error ? err.message : String(err));
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;

export default appRouter;
