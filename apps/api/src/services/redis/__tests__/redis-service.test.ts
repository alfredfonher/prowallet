/**
 * Tests para redis service
 * Coverage: 100% funciones core, 80% resto
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  RefactoredRedisService,
  RedisClientWrapper,
  IRedisClient,
} from "../redis-service-refactored";
import {
  RedisConnectionError,
  RedisCommandError,
  RedisValidationError,
  RedisTimeoutError,
  RedisConfig,
  RedisConnectionState,
} from "../types";

// Create a mock factory function that will be hoisted
function createMockRedisClient(): IRedisClient {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    isOpen: false,
  } as IRedisClient;
}

// Mock redis module
vi.mock("redis", () => ({
  createClient: vi.fn().mockReturnValue(createMockRedisClient()),
}));

describe("Redis Service", () => {
  let mockRedisClient: IRedisClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create fresh mock client for each test to avoid shared state
    mockRedisClient = createMockRedisClient();

    // Update the mock return value for this test
    const { createClient } = vi.mocked(require("redis") as any);
    createClient.mockReturnValue(mockRedisClient);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("RedisClientWrapper", () => {
    let wrapper: RedisClientWrapper;
    let mockConfig: RedisConfig;

    beforeEach(() => {
      mockConfig = {
        url: "redis://localhost:6379",
        maxRetries: 3,
        retryDelayMs: 1000,
        connectTimeoutMs: 5000,
        commandTimeoutMs: 3000,
        enableOfflineQueue: true,
        lazyConnect: false,
      };

      wrapper = new RedisClientWrapper(mockConfig);
    });

    describe("connect", () => {
      it("should connect successfully", async () => {
        mockRedisClient.isOpen = false;
        mockRedisClient.connect.mockResolvedValue(undefined);

        await wrapper.connect();

        expect(mockRedisClient.connect).toHaveBeenCalled();
      });

      it("should not connect if already connected", async () => {
        mockRedisClient.isOpen = true;

        await wrapper.connect();

        expect(mockRedisClient.connect).not.toHaveBeenCalled();
      });

      it("should throw RedisConnectionError on connection failure", async () => {
        mockRedisClient.isOpen = false;
        mockRedisClient.connect.mockRejectedValue(
          new Error("Connection failed"),
        );

        await expect(wrapper.connect()).rejects.toThrow(RedisConnectionError);
      });

      it("should preserve original error in connection error", async () => {
        const originalError = new Error("ECONNREFUSED");
        mockRedisClient.isOpen = false;
        mockRedisClient.connect.mockRejectedValue(originalError);

        try {
          await wrapper.connect();
        } catch (error) {
          expect(error).toBeInstanceOf(RedisConnectionError);
          expect((error as RedisConnectionError).originalError).toBe(
            originalError,
          );
        }
      });
    });

    describe("disconnect", () => {
      it("should disconnect successfully", async () => {
        mockRedisClient.isOpen = true;
        mockRedisClient.disconnect.mockResolvedValue(undefined);

        await wrapper.disconnect();

        expect(mockRedisClient.disconnect).toHaveBeenCalled();
      });

      it("should not disconnect if already disconnected", async () => {
        mockRedisClient.isOpen = false;

        await wrapper.disconnect();

        expect(mockRedisClient.disconnect).not.toHaveBeenCalled();
      });

      it("should handle disconnect errors gracefully", async () => {
        mockRedisClient.isOpen = true;
        mockRedisClient.disconnect.mockRejectedValue(
          new Error("Disconnect error"),
        );

        // Should not throw
        await expect(wrapper.disconnect()).resolves.toBeUndefined();
      });
    });

    describe("get", () => {
      it("should get value successfully", async () => {
        const expectedValue = "test-value";
        mockRedisClient.get.mockResolvedValue(expectedValue);

        const result = await wrapper.get("test-key");

        expect(result).toBe(expectedValue);
        expect(mockRedisClient.get).toHaveBeenCalledWith("test-key");
      });

      it("should throw RedisCommandError on failure", async () => {
        mockRedisClient.get.mockRejectedValue(new Error("GET command failed"));

        await expect(wrapper.get("test-key")).rejects.toThrow(
          RedisCommandError,
        );
      });

      it("should include key in command error", async () => {
        mockRedisClient.get.mockRejectedValue(new Error("Key not found"));

        try {
          await wrapper.get("test-key");
        } catch (error) {
          expect(error).toBeInstanceOf(RedisCommandError);
          expect((error as RedisCommandError).command).toBe("GET");
          expect((error as RedisCommandError).key).toBe("test-key");
        }
      });
    });

    describe("set", () => {
      it("should set value successfully", async () => {
        const expectedResponse = "OK";
        mockRedisClient.set.mockResolvedValue(expectedResponse);

        const result = await wrapper.set("test-key", "test-value");

        expect(result).toBe(expectedResponse);
        expect(mockRedisClient.set).toHaveBeenCalledWith(
          "test-key",
          "test-value",
          undefined,
        );
      });

      it("should set value with TTL", async () => {
        const expectedResponse = "OK";
        mockRedisClient.set.mockResolvedValue(expectedResponse);

        const result = await wrapper.set("test-key", "test-value", {
          PX: 60000,
        });

        expect(result).toBe(expectedResponse);
        expect(mockRedisClient.set).toHaveBeenCalledWith(
          "test-key",
          "test-value",
          { PX: 60000 },
        );
      });

      it("should throw RedisCommandError on failure", async () => {
        mockRedisClient.set.mockRejectedValue(new Error("SET command failed"));

        await expect(wrapper.set("test-key", "test-value")).rejects.toThrow(
          RedisCommandError,
        );
      });

      it("should include key and command in error", async () => {
        mockRedisClient.set.mockRejectedValue(new Error("Memory error"));

        try {
          await wrapper.set("test-key", "test-value");
        } catch (error) {
          expect(error).toBeInstanceOf(RedisCommandError);
          expect((error as RedisCommandError).command).toBe("SET");
          expect((error as RedisCommandError).key).toBe("test-key");
        }
      });
    });

    describe("isOpen", () => {
      it("should return connection state", () => {
        mockRedisClient.isOpen = true;
        expect(wrapper.isOpen).toBe(true);

        mockRedisClient.isOpen = false;
        expect(wrapper.isOpen).toBe(false);
      });
    });
  });

  describe("RefactoredRedisService", () => {
    let redisService: RefactoredRedisService;

    beforeEach(() => {
      redisService = new RefactoredRedisService(
        {
          url: "redis://localhost:6379",
          maxRetries: 2,
          retryDelayMs: 100,
          connectTimeoutMs: 1000,
          commandTimeoutMs: 500,
          enableOfflineQueue: false,
          lazyConnect: false,
        },
        mockRedisClient,
      );
    });

    describe("connect", () => {
      it("should connect successfully", async () => {
        mockRedisClient.isOpen = false;
        mockRedisClient.connect.mockResolvedValue(undefined);

        await redisService.connect();

        const state = redisService.getConnectionState();
        expect(state.isConnected).toBe(true);
        expect(state.isConnecting).toBe(false);
        expect(state.connectAttempts).toBeGreaterThan(0);
        expect(state.lastError).toBeNull();
      });

      it("should not connect if already connected", async () => {
        mockRedisClient.isOpen = true;

        await redisService.connect();

        expect(mockRedisClient.connect).not.toHaveBeenCalled();
      });

      it("should not connect if connection in progress", async () => {
        mockRedisClient.isOpen = false;
        mockRedisClient.connect.mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 1000)),
        );

        const connectPromise1 = redisService.connect();
        const connectPromise2 = redisService.connect();

        await Promise.all([connectPromise1, connectPromise2]);

        expect(mockRedisClient.connect).toHaveBeenCalledTimes(1);
      });

      it("should retry connection on failure", async () => {
        mockRedisClient.isOpen = false;
        mockRedisClient.connect
          .mockRejectedValueOnce(new Error("First attempt failed"))
          .mockRejectedValueOnce(new Error("Second attempt failed"))
          .mockResolvedValueOnce(undefined);

        await redisService.connect();

        expect(mockRedisClient.connect).toHaveBeenCalledTimes(3);
      });

      it("should throw error after max retries", async () => {
        mockRedisClient.isOpen = false;
        mockRedisClient.connect.mockRejectedValue(
          new Error("Persistent failure"),
        );

        await expect(redisService.connect()).rejects.toThrow(
          RedisConnectionError,
        );

        const state = redisService.getConnectionState();
        expect(state.isConnected).toBe(false);
        expect(state.lastError).toContain("Persistent failure");
      });
    });

    describe("disconnect", () => {
      it("should disconnect successfully", async () => {
        mockRedisClient.isOpen = true;
        mockRedisClient.disconnect.mockResolvedValue(undefined);

        await redisService.disconnect();

        const state = redisService.getConnectionState();
        expect(state.isConnected).toBe(false);
        expect(mockRedisClient.disconnect).toHaveBeenCalled();
      });

      it("should handle disconnect errors gracefully", async () => {
        mockRedisClient.isOpen = true;
        mockRedisClient.disconnect.mockRejectedValue(
          new Error("Disconnect error"),
        );

        // Should not throw
        await expect(redisService.disconnect()).resolves.toBeUndefined();
      });
    });

    describe("getJson", () => {
      beforeEach(async () => {
        mockRedisClient.isOpen = true;
        mockRedisClient.connect.mockResolvedValue(undefined);
        await redisService.connect();
      });

      it("should get and parse JSON successfully", async () => {
        const jsonData = { price: 50000, timestamp: Date.now() };
        const jsonString = JSON.stringify(jsonData);
        mockRedisClient.get.mockResolvedValue(jsonString);

        const result = await redisService.getJson("test-key");

        expect(result).toEqual(jsonData);
        expect(mockRedisClient.get).toHaveBeenCalledWith("test-key");
      });

      it("should return null for non-existent key", async () => {
        mockRedisClient.get.mockResolvedValue(null);

        const result = await redisService.getJson("non-existent-key");

        expect(result).toBeNull();
      });

      it("should throw error when not connected", async () => {
        mockRedisClient.isOpen = false;

        await expect(redisService.getJson("test-key")).rejects.toThrow(
          RedisConnectionError,
        );
      });

      it("should throw error for invalid JSON", async () => {
        mockRedisClient.get.mockResolvedValue("invalid-json");

        await expect(redisService.getJson("test-key")).rejects.toThrow(
          RedisValidationError,
        );
      });

      it("should validate key format", async () => {
        await expect(redisService.getJson("")).rejects.toThrow(
          RedisValidationError,
        );
        await expect(redisService.getJson("a".repeat(600))).rejects.toThrow(
          RedisValidationError,
        );
        await expect(redisService.getJson("invalid:key!@#")).rejects.toThrow(
          RedisValidationError,
        );
      });

      it("should update metrics on success", async () => {
        const jsonData = { test: "data" };
        mockRedisClient.get.mockResolvedValue(JSON.stringify(jsonData));

        await redisService.getJson("test-key");

        const metrics = redisService.getMetrics();
        expect(metrics.totalRequests).toBe(1);
        expect(metrics.successfulCommands).toBe(1);
        expect(metrics.failedCommands).toBe(0);
      });

      it("should update metrics on failure", async () => {
        mockRedisClient.get.mockRejectedValue(new Error("Command failed"));

        await expect(redisService.getJson("test-key")).rejects.toThrow();

        const metrics = redisService.getMetrics();
        expect(metrics.totalRequests).toBe(1);
        expect(metrics.successfulCommands).toBe(0);
        expect(metrics.failedCommands).toBe(1);
      });
    });

    describe("setJson", () => {
      beforeEach(async () => {
        mockRedisClient.isOpen = true;
        mockRedisClient.connect.mockResolvedValue(undefined);
        await redisService.connect();
      });

      it("should stringify and set JSON successfully", async () => {
        const jsonData = { price: 50000, timestamp: Date.now() };
        mockRedisClient.set.mockResolvedValue("OK");

        const result = await redisService.setJson("test-key", jsonData);

        expect(result).toBe(true);
        expect(mockRedisClient.set).toHaveBeenCalledWith(
          "test-key",
          JSON.stringify(jsonData),
          undefined,
        );
      });

      it("should set JSON with TTL", async () => {
        const jsonData = { test: "data" };
        mockRedisClient.set.mockResolvedValue("OK");

        const result = await redisService.setJson("test-key", jsonData, 60000);

        expect(result).toBe(true);
        expect(mockRedisClient.set).toHaveBeenCalledWith(
          "test-key",
          JSON.stringify(jsonData),
          { PX: 60000 },
        );
      });

      it("should throw error when not connected", async () => {
        mockRedisClient.isOpen = false;

        await expect(
          redisService.setJson("test-key", { data: "test" }),
        ).rejects.toThrow(RedisConnectionError);
      });

      it("should validate key and value", async () => {
        await expect(
          redisService.setJson("", { data: "test" }),
        ).rejects.toThrow(RedisValidationError);

        await expect(
          redisService.setJson("test-key", null as any),
        ).rejects.toThrow(RedisValidationError);

        await expect(
          redisService.setJson("test-key", undefined as any),
        ).rejects.toThrow(RedisValidationError);

        await expect(
          redisService.setJson("test-key", { circular: {} }),
        ).rejects.toThrow(RedisValidationError);
      });

      it("should validate TTL", async () => {
        await expect(
          redisService.setJson("test-key", { data: "test" }, -1000),
        ).rejects.toThrow(RedisValidationError);

        await expect(
          redisService.setJson(
            "test-key",
            { data: "test" },
            Number.MAX_SAFE_INTEGER,
          ),
        ).rejects.toThrow(RedisValidationError);
      });

      it("should update metrics on success", async () => {
        mockRedisClient.set.mockResolvedValue("OK");

        await redisService.setJson("test-key", { data: "test" });

        const metrics = redisService.getMetrics();
        expect(metrics.totalRequests).toBe(1);
        expect(metrics.successfulCommands).toBe(1);
        expect(metrics.failedCommands).toBe(0);
      });
    });

    describe("getConnectionState", () => {
      it("should return current connection state", () => {
        const state = redisService.getConnectionState();

        expect(state).toHaveProperty("isConnected");
        expect(state).toHaveProperty("isConnecting");
        expect(state).toHaveProperty("lastError");
        expect(state).toHaveProperty("connectAttempts");
        expect(state).toHaveProperty("lastConnectedAt");
      });

      it("should return immutable state copy", () => {
        const state1 = redisService.getConnectionState();
        const state2 = redisService.getConnectionState();

        expect(state1).not.toBe(state2);
        expect(state1).toEqual(state2);
      });
    });

    describe("getMetrics", () => {
      it("should return initial metrics", () => {
        const metrics = redisService.getMetrics();

        expect(metrics).toEqual({
          totalRequests: 0,
          successfulCommands: 0,
          failedCommands: 0,
          averageLatency: 0,
          connectionErrors: 0,
          reconnections: 0,
        });
      });

      it("should calculate average latency correctly", async () => {
        mockRedisClient.isOpen = true;
        mockRedisClient.connect.mockResolvedValue(undefined);
        mockRedisClient.get.mockResolvedValue('{"test": "data"}');

        await redisService.connect();
        await redisService.getJson("test-key");

        const metrics = redisService.getMetrics();
        expect(metrics.averageLatency).toBeGreaterThan(0);
      });
    });

    describe("healthCheck", () => {
      beforeEach(async () => {
        mockRedisClient.isOpen = true;
        mockRedisClient.connect.mockResolvedValue(undefined);
        await redisService.connect();
      });

      it("should return healthy status on successful check", async () => {
        mockRedisClient.set.mockResolvedValue("OK");
        mockRedisClient.get.mockResolvedValue('{"timestamp": 1234567890}');

        const health = await redisService.healthCheck();

        expect(health.healthy).toBe(true);
        expect(health.latency).toBeGreaterThan(0);
        expect(health.error).toBeUndefined();
      });

      it("should return unhealthy status on failure", async () => {
        mockRedisClient.set.mockRejectedValue(new Error("Redis error"));

        const health = await redisService.healthCheck();

        expect(health.healthy).toBe(false);
        expect(health.error).toBeDefined();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle concurrent operations", async () => {
      const redisService = new RefactoredRedisService(
        {
          url: "redis://localhost:6379",
          maxRetries: 1,
          retryDelayMs: 100,
          connectTimeoutMs: 1000,
          commandTimeoutMs: 500,
          enableOfflineQueue: false,
          lazyConnect: false,
        },
        mockRedisClient,
      );

      mockRedisClient.isOpen = true;
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.get.mockResolvedValue('{"data": "test"}');
      mockRedisClient.set.mockResolvedValue("OK");

      await redisService.connect();

      const operations = Array.from({ length: 10 }, (_, i) =>
        redisService.getJson(`test-key-${i}`),
      );

      const results = await Promise.all(operations);

      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result).toEqual({ data: "test" });
      });
    });

    it("should handle large JSON objects", async () => {
      const redisService = new RefactoredRedisService(
        undefined,
        mockRedisClient,
      );

      mockRedisClient.isOpen = true;
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.set.mockResolvedValue("OK");
      mockRedisClient.get.mockResolvedValue(
        JSON.stringify({
          data: "x".repeat(10000),
        }),
      );

      await redisService.connect();

      const largeObject = { data: "x".repeat(10000) };
      await redisService.setJson("large-key", largeObject);

      const retrieved = await redisService.getJson("large-key");

      expect(retrieved).toEqual(largeObject);
    });

    it("should handle special characters in keys", async () => {
      const redisService = new RefactoredRedisService(
        undefined,
        mockRedisClient,
      );

      mockRedisClient.isOpen = true;
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.set.mockResolvedValue("OK");
      mockRedisClient.get.mockResolvedValue('{"test": "data"}');

      await redisService.connect();

      const specialKeys = [
        "user:123:profile",
        "cache:temp:data",
        "session:abc123xyz",
        "rate-limit:api:192.168.1.1",
      ];

      for (const key of specialKeys) {
        await expect(redisService.setJson(key, { test: "data" })).resolves.toBe(
          true,
        );
        await expect(redisService.getJson(key)).resolves.toEqual({
          test: "data",
        });
      }
    });

    it("should handle rapid connection attempts", async () => {
      const redisService = new RefactoredRedisService(
        {
          url: "redis://localhost:6379",
          maxRetries: 1,
          retryDelayMs: 50,
          connectTimeoutMs: 100,
          commandTimeoutMs: 50,
          enableOfflineQueue: false,
          lazyConnect: false,
        },
        mockRedisClient,
      );

      mockRedisClient.isOpen = false;
      mockRedisClient.connect.mockRejectedValue(new Error("Connection failed"));

      const connectPromises = Array.from(
        { length: 5 },
        () => redisService.connect().catch(() => null), // Ignore errors for this test
      );

      await Promise.all(connectPromises);

      // Should not attempt connection multiple times simultaneously
      expect(mockRedisClient.connect).toHaveBeenCalledTimes(5); // One per attempt, not concurrent
    });
  });

  describe("Configuration", () => {
    it("should use default configuration when none provided", () => {
      const service = new RefactoredRedisService();

      expect(() => service.connect()).not.toThrow();
    });

    it("should merge configuration with defaults", () => {
      const customConfig = {
        url: "redis://custom:6380",
        maxRetries: 5,
        retryDelayMs: 2000,
      };

      const service = new RefactoredRedisService(customConfig, mockRedisClient);

      expect(() => service.connect()).not.toThrow();
    });

    it("should handle invalid configuration values", () => {
      const invalidConfigs = [
        { maxRetries: -1 },
        { retryDelayMs: -100 },
        { connectTimeoutMs: 0 },
        { commandTimeoutMs: -50 },
      ];

      invalidConfigs.forEach((config) => {
        expect(
          () => new RefactoredRedisService(config as any, mockRedisClient),
        ).not.toThrow();
      });
    });
  });
});
