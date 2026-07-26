import request from "supertest";
import { vi } from "vitest";

// Ensure required env vars are set before loading the app/module graph
// Use valid base58-like placeholders for tests to satisfy Solana PublicKey parsing
process.env.PROWALLET_PROGRAM_ID =
  process.env.PROWALLET_PROGRAM_ID || "11111111111111111111111111111111";
process.env.TREASURY_WALLET =
  process.env.TREASURY_WALLET || "22222222222222222222222222222222";

// Import the app after environment variables are set. Use dynamic import
// so we control timing and avoid module-initialization race conditions.
const { default: app } = await import("../app");

describe("trpc proxy router", () => {
  it("POST /api/v1/trpc/purchase/start should proxy to /purchase/initiate (fallback)", async () => {
    // This is an integration-style test: we call the proxy endpoint which will
    // attempt to call the internal tRPC router. If tRPC is available it will
    // use it; if not, it falls back to proxying to /api/v1/purchase/initiate.
    // We stub fetch to return a predictable response so the test runs
    // deterministically.
    const fake = { transactionId: "test-tx-123", txBase64: "AAA" };

    // Mock global fetch used by the proxy to call the REST initiate
    const originalFetch = (global as any).fetch;
    (global as any).fetch = vi.fn(() =>
      Promise.resolve({ json: () => Promise.resolve(fake), status: 200 }),
    );

    const res = await request(app)
      .post("/api/v1/trpc/purchase/start")
      .send({ walletAddress: "test", tokenAmount: 1 })
      .set("Accept", "application/json");

    // restore
    (global as any).fetch = originalFetch;

    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    // The proxy returns the JSON from the internal call
    expect(res.body.transactionId || res.body.extra?.transactionId).toBe(
      "test-tx-123",
    );
  });
});
