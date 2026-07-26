import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import bodyParser from "body-parser";
import request from "supertest";

// Mock logger
vi.mock("../services/logging/logger.service", () => ({
  loggerService: { logInfo: vi.fn(), logError: vi.fn() },
}));

import notificationsRouter from "../routes/notifications/notifications.routes";

describe("notifications.routes webhook", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(bodyParser.json());
    app.use("/", notificationsRouter);
    // Ensure env secret cleared by default
    delete process.env.PROWALLET_WEBHOOK_SECRET;
  });

  it("should accept webhook without signature if no secret configured", async () => {
    const res = await request(app)
      .post("/webhook")
      .send({ event: "purchase.completed", payload: { tx: "123" } });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
  });

  it("should reject when secret configured and signature missing", async () => {
    process.env.PROWALLET_WEBHOOK_SECRET = "shh";
    const res = await request(app)
      .post("/webhook")
      .send({ event: "purchase.completed", payload: { tx: "123" } });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("success", false);
  });

  it("should accept when secret configured and signature valid", async () => {
    process.env.PROWALLET_WEBHOOK_SECRET = "shh";
    const body = { event: "purchase.completed", payload: { tx: "abc" } };
    const crypto = await import("crypto");
    const expected = `sha256=${crypto.createHmac("sha256", process.env.PROWALLET_WEBHOOK_SECRET!).update(JSON.stringify(body)).digest("hex")}`;

    const res = await request(app)
      .post("/webhook")
      .set("X-PROWALLET-SIGNATURE", expected)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
  });
});
