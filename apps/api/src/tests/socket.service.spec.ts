import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock socket.io Server implementation
vi.mock("socket.io", () => {
  return {
    Server: class MockServer {
      opts: any;
      handlers: Record<string, Function> = {};
      constructor(server: any, opts: any) {
        this.opts = opts;
      }
      on(ev: string, cb: Function) {
        this.handlers[ev] = cb;
      }
      to(room: string) {
        return { emit: () => true };
      }
      emit() {}
    },
  };
});

import http from "http";
import {
  initSocketServer,
  getIo,
  broadcast,
  emitToPurchase,
} from "../services/socket.service";

describe("socket.service", () => {
  let server: http.Server;
  beforeEach(() => {
    server = http.createServer();
  });

  it("initializes without throwing", () => {
    expect(() => initSocketServer(server)).not.toThrow();
    const io = getIo();
    expect(io).toBeDefined();
  });

  it("broadcast returns true when io present", () => {
    initSocketServer(server);
    expect(broadcast("hello", { ok: true })).toBeTruthy();
  });

  it("emitToPurchase returns true when io present", () => {
    initSocketServer(server);
    expect(
      emitToPurchase("p1", "purchase.completed", { tx: "1" }),
    ).toBeTruthy();
  });
});
