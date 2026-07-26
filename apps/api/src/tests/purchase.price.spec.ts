import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import bodyParser from "body-parser";

// Mock logger to silence logs and provide requestLoggerMiddleware used by routes
vi.mock("../services/logging/logger.service", () => ({
  loggerService: {
    logInfo: vi.fn(),
    logError: vi.fn(),
    generateRequestId: () => "req-1",
  },
  requestLoggerMiddleware: (req: any, res: any, next: any) => next(),
}));

import purchaseRouter from "../routes/purchase/purchase.routes";
import { PurchaseController } from "../controllers/purchase/PurchaseController";

describe("GET /purchase/price", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(bodyParser.json());
    // mount router at root for testing
    app.use("/", purchaseRouter);
  });

  it("returns current price when getCurrentSupply succeeds", async () => {
    // Spy on controller internal method to return supply
    vi.spyOn(
      PurchaseController.prototype as any,
      "getCurrentSupply",
    ).mockResolvedValue(1000);

    const res = await request(app).get("/price").query({ amount: 2 });
    expect(res.status).toBe(200);
    // Response may be normalized by global middleware in app.ts or be the raw statusflow payload
    expect(res.body).toHaveProperty("success", true);

    // Support both response shapes: { success, extra } or raw StatusFlow { code, message, extra }
    const candidate =
      res.body && res.body.extra ? res.body.extra : res.body || {};

    // If candidate doesn't have pricePerToken directly, try to find it in nested objects
    const hasPrice =
      candidate &&
      (candidate.pricePerToken !== undefined ||
        candidate.tokenAmount !== undefined ||
        candidate.totalCost !== undefined);
    expect(hasPrice).toBeTruthy();
  });

  it("returns 503 when getCurrentSupply fails", async () => {
    vi.spyOn(
      PurchaseController.prototype as any,
      "getCurrentSupply",
    ).mockRejectedValue(new Error("RPC down"));

    const res = await request(app).get("/price").query({ amount: 1 });
    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty("success", false);
  });
});
