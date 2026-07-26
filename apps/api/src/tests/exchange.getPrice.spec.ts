import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import express from "express";
import bodyParser from "body-parser";
import request from "supertest";

// Mocks
vi.mock("../services/logging/logger.service", () => ({
  loggerService: { logInfo: vi.fn(), logError: vi.fn(), logDebug: vi.fn() },
}));

vi.mock("../services/solana.service", () => ({
  solanaService: { getTokenSupply: vi.fn(), getConnection: vi.fn() },
}));

vi.mock("../services/redis.service", () => ({
  getJson: vi.fn(),
  setJson: vi.fn(),
  connectRedis: vi.fn(),
}));

import exchangeRouter from "../routes/exchange/exchange.routes";
import { solanaService } from "../services/solana.service";
import { loggerService } from "../services/logging/logger.service";

describe("GET /exchange/getPrice - fallback when mint missing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TOKEN_MINT = "DUMMY_MINT";
    process.env.PRICING_MODE = "bonding";
    process.env.BASE_TOKEN_PRICE = "0.01";
  });

  afterEach(() => {
    delete process.env.TOKEN_MINT;
    delete process.env.PRICING_MODE;
    delete process.env.BASE_TOKEN_PRICE;
  });

  it("returns basePrice and logs info when mint not found", async () => {
    // Simulate RPC error indicating missing mint
    (solanaService.getTokenSupply as any).mockRejectedValue(
      new Error(
        "failed to get token supply: Invalid param: could not find account",
      ),
    );

    const app = express();
    app.use(bodyParser.json());
    app.use("/", exchangeRouter);

    const res = await request(app).get("/getPrice").expect(200);

    expect(res.body).toHaveProperty("success", true);
    const extra = res.body.extra;
    expect(extra).toHaveProperty("priceUSD");
    expect(extra.priceUSD).toBe(
      parseFloat(process.env.BASE_TOKEN_PRICE || "0.01"),
    );
    expect(extra.currentSupply).toBe(0);

    // Should have logged an info about missing mint
    expect(loggerService.logInfo as any).toHaveBeenCalled();
  });
});
