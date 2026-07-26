import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock logger service to avoid noisy logs
vi.mock("../services/logging/logger.service", () => ({
  loggerService: {
    logInfo: vi.fn(),
    logError: vi.fn(),
  },
}));

// Mock socket.service to avoid requiring socket.io in tests
vi.mock("../services/socket.service", () => ({
  default: {
    emitToPurchase: vi.fn(() => true),
    broadcast: vi.fn(() => true),
  },
}));

import { notificationsService } from "../services/notifications.service";

class MockSocket {
  handlers: Record<string, Function> = {};
  on(event: string, cb: Function) {
    this.handlers[event] = cb;
  }
  emitClose() {
    this.handlers.close?.();
  }
}

class MockRes {
  headers: Record<string, any> = {};
  writes: string[] = [];
  ended = false;
  req: any;
  throwOnWrite = false;

  constructor() {
    const socket = new MockSocket();
    this.req = { socket };
  }
  setHeader(k: string, v: any) {
    this.headers[k] = v;
  }
  flushHeaders() {}
  write(s: string) {
    if (this.throwOnWrite) throw new Error("write failed");
    this.writes.push(s);
  }
  end() {
    this.ended = true;
  }
}

describe("notifications.service", () => {
  beforeEach(() => {
    // reset clients map by reloading module instance if necessary
    // notificationsService is a singleton; remove clients via broadcast cleanup
    try {
      // Remove all existing clients by reading ids and ending their res
      const ids = notificationsService.getClientIds();
      for (const id of ids) {
        // Access internal map via any to call delete
        (notificationsService as any).clients.delete(id);
      }
    } catch (e) {}
  });

  it("should add client and send connected event", () => {
    const res = new MockRes();
    notificationsService.addClient("c1", res as any);
    const ids = notificationsService.getClientIds();
    expect(ids).toContain("c1");
    // first writes include connected event
    expect(res.writes.some((w) => w.includes("connected"))).toBeTruthy();
  });

  it("should broadcast event to clients and include payload", () => {
    const res = new MockRes();
    notificationsService.addClient("c2", res as any);
    notificationsService.broadcast("purchase.completed", {
      transactionId: "tx1",
    });
    // verify that at least one of the writes contains the event name
    const joined = res.writes.join("");
    expect(joined).toContain("event: purchase.completed");
    expect(joined).toContain('"type":"purchase.completed"');
    expect(joined).toContain('"transactionId":"tx1"');
  });

  it("should remove client when write throws", () => {
    const res = new MockRes();
    // Add client first (initial writes succeed)
    notificationsService.addClient("c3", res as any);
    // Now simulate write failure on subsequent writes
    res.throwOnWrite = true;
    // broadcast should attempt to write and then remove client
    notificationsService.broadcast("purchase.completed", {
      transactionId: "tx2",
    });
    const ids = notificationsService.getClientIds();
    expect(ids).not.toContain("c3");
  });

  it("postWithRetry should succeed on 200 response", async () => {
    // mock global fetch
    const originalFetch = (global as any).fetch;
    (global as any).fetch = vi.fn(async () => ({
      ok: true,
      text: async () => "",
    }));
    await (notificationsService as any).postWithRetry(
      "http://example",
      { a: 1 },
      0,
      1000,
    );
    expect((global as any).fetch).toHaveBeenCalled();
    (global as any).fetch = originalFetch;
  });

  it("postWithRetry should throw after retries on non-ok", async () => {
    const originalFetch = (global as any).fetch;
    (global as any).fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      statusText: "ERR",
      text: async () => "err",
    }));
    await expect(
      (notificationsService as any).postWithRetry(
        "http://bad",
        { a: 1 },
        1,
        200,
      ),
    ).rejects.toThrow();
    (global as any).fetch = originalFetch;
  });
});
