import { describe, it, expect, vi, beforeEach } from "vitest";
import * as environmentModule from "../environment";

describe("Environment Configuration", () => {
  beforeEach(() => {
    // Resetear la configuración entre tests
    vi.resetModules();
    (global as any).process = {
      env: {
        NODE_ENV: "development",
      },
    };
  });

  describe("getEnvironmentType", () => {
    it('should return "local" when NEXT_PUBLIC_ENVIRONMENT=local', () => {
      (global as any).process.env.NEXT_PUBLIC_ENVIRONMENT = "local";
      const { getEnvironmentConfig } = require("../environment");
      const config = getEnvironmentConfig();
      expect(config.environment).toBe("local");
    });

    it('should return "production" when NEXT_PUBLIC_ENVIRONMENT=production', () => {
      (global as any).process.env.NEXT_PUBLIC_ENVIRONMENT = "production";
      const { getEnvironmentConfig } = require("../environment");
      const config = getEnvironmentConfig();
      expect(config.environment).toBe("production");
    });

    it("should use explicit environment variable over hostname detection", () => {
      (global as any).process.env.NEXT_PUBLIC_ENVIRONMENT = "local";

      // Mock window.location.hostname to something that looks like production
      Object.defineProperty(window, "location", {
        value: {
          hostname: "example.com",
        },
        writable: true,
      });

      const { getEnvironmentConfig } = require("../environment");
      const config = getEnvironmentConfig();
      expect(config.environment).toBe("local");
    });
  });

  describe("getApiUrl", () => {
    it("should return local API URL for local environment", () => {
      (global as any).process.env.NEXT_PUBLIC_ENVIRONMENT = "local";
      (global as any).process.env.NEXT_PUBLIC_API_URL_LOCAL =
        "http://localhost:3000/api/v1";

      const { getEnvironmentConfig } = require("../environment");
      const config = getEnvironmentConfig();
      expect(config.apiUrl).toBe("http://localhost:3000/api/v1");
    });

    it("should return production API URL for production environment", () => {
      (global as any).process.env.NEXT_PUBLIC_ENVIRONMENT = "production";
      (global as any).process.env.NEXT_PUBLIC_API_URL_CLOUD =
        "https://servicioshilda.orioncaribe.com/api/v1";

      const { getEnvironmentConfig } = require("../environment");
      const config = getEnvironmentConfig();
      expect(config.apiUrl).toBe(
        "https://servicioshilda.orioncaribe.com/api/v1",
      );
    });

    it("should use default local URL if env var not set", () => {
      (global as any).process.env.NEXT_PUBLIC_ENVIRONMENT = "local";
      delete (global as any).process.env.NEXT_PUBLIC_API_URL_LOCAL;

      const { getEnvironmentConfig } = require("../environment");
      const config = getEnvironmentConfig();
      expect(config.apiUrl).toBe("http://localhost:3000/api/v1");
    });

    it("should use default production URL if env var not set", () => {
      (global as any).process.env.NEXT_PUBLIC_ENVIRONMENT = "production";
      delete (global as any).process.env.NEXT_PUBLIC_API_URL_CLOUD;

      const { getEnvironmentConfig } = require("../environment");
      const config = getEnvironmentConfig();
      expect(config.apiUrl).toBe(
        "https://servicioshilda.orioncaribe.com/api/v1",
      );
    });
  });

  describe("environment detection flags", () => {
    it("should set isDevelopment=true for local environment", () => {
      (global as any).process.env.NEXT_PUBLIC_ENVIRONMENT = "local";

      const { getEnvironmentConfig } = require("../environment");
      const config = getEnvironmentConfig();
      expect(config.isDevelopment).toBe(true);
      expect(config.isProduction).toBe(false);
    });

    it("should set isProduction=true for production environment", () => {
      (global as any).process.env.NEXT_PUBLIC_ENVIRONMENT = "production";

      const { getEnvironmentConfig } = require("../environment");
      const config = getEnvironmentConfig();
      expect(config.isDevelopment).toBe(false);
      expect(config.isProduction).toBe(true);
    });
  });

  describe("getCurrentApiUrl", () => {
    it("should return the current API URL", () => {
      (global as any).process.env.NEXT_PUBLIC_ENVIRONMENT = "local";
      (global as any).process.env.NEXT_PUBLIC_API_URL_LOCAL =
        "http://localhost:3000/api/v1";

      const { getCurrentApiUrl } = require("../environment");
      const url = getCurrentApiUrl();
      expect(url).toBe("http://localhost:3000/api/v1");
    });
  });
});
