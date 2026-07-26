import { describe, it, expect } from "vitest";
import {
  formatTokenInput,
  parseTokenInput,
  isValidTokenInput,
  extractNumericValue,
  formatNumberToDisplay,
} from "../utils/token-input-formatter";

describe("Token Input Formatter", () => {
  describe("formatTokenInput", () => {
    it("should format single digit without thousands separator", () => {
      expect(formatTokenInput("5")).toBe("5");
    });

    it("should format two digits without thousands separator", () => {
      expect(formatTokenInput("50")).toBe("50");
    });

    it("should format three digits without thousands separator", () => {
      expect(formatTokenInput("500")).toBe("500");
    });

    it("should add thousands separator when exceeding 3 digits", () => {
      expect(formatTokenInput("1234")).toBe("1.234");
    });

    it("should add thousands separators for multiple groups", () => {
      expect(formatTokenInput("1234567")).toBe("1.234.567");
    });

    it("should handle decimal separator with comma", () => {
      expect(formatTokenInput("1234,50")).toBe("1.234,50");
    });

    it("should convert dot to comma for decimals (when preceded by 0)", () => {
      expect(formatTokenInput("0.5")).toBe("0,5");
    });

    it("should convert dot to comma for decimals (0.123456)", () => {
      expect(formatTokenInput("0.123456")).toBe("0,123456");
    });

    it("should reject dot when not preceded by 0", () => {
      expect(formatTokenInput("12.34")).toBe("1.234");
    });

    it("should handle empty string", () => {
      expect(formatTokenInput("")).toBe("");
    });

    it("should remove leading zeros except for decimals", () => {
      expect(formatTokenInput("00123")).toBe("123");
    });

    it("should handle only zeros", () => {
      expect(formatTokenInput("000")).toBe("0");
    });

    it("should limit decimal places to 6", () => {
      expect(formatTokenInput("1,1234567")).toBe("1,123456");
    });

    it("should handle starting with comma", () => {
      expect(formatTokenInput("0,")).toBe("0,");
    });

    it("should format large numbers with decimals", () => {
      expect(formatTokenInput("1000000,5")).toBe("1.000.000,5");
    });

    it("should handle multiple zeros before decimal", () => {
      expect(formatTokenInput("00,5")).toBe("0,5");
    });
  });

  describe("parseTokenInput", () => {
    it("should parse formatted input to number", () => {
      expect(parseTokenInput("1.234,50")).toBe(1234.5);
    });

    it("should parse without thousands separator", () => {
      expect(parseTokenInput("100")).toBe(100);
    });

    it("should parse with only decimals", () => {
      expect(parseTokenInput("0,5")).toBe(0.5);
    });

    it("should return 0 for empty string", () => {
      expect(parseTokenInput("")).toBe(0);
    });

    it("should handle malformed input gracefully", () => {
      expect(parseTokenInput("abc")).toBe(0);
    });

    it("should parse large numbers", () => {
      expect(parseTokenInput("1.000.000,50")).toBe(1000000.5);
    });

    it("should parse multi-separator input", () => {
      expect(parseTokenInput("1.234.567,890123")).toBe(1234567.890123);
    });
  });

  describe("isValidTokenInput", () => {
    it("should validate positive integers", () => {
      expect(isValidTokenInput("1.234")).toBe(true);
    });

    it("should validate with decimals", () => {
      expect(isValidTokenInput("1.234,50")).toBe(true);
    });

    it("should validate single digit", () => {
      expect(isValidTokenInput("5")).toBe(true);
    });

    it("should validate zero with decimals", () => {
      expect(isValidTokenInput("0,5")).toBe(true);
    });

    it("should reject negative numbers", () => {
      expect(isValidTokenInput("-100")).toBe(false);
    });

    it("should reject multiple commas", () => {
      expect(isValidTokenInput("1,23,45")).toBe(false);
    });

    it("should reject empty string", () => {
      expect(isValidTokenInput("")).toBe(false);
    });

    it("should reject exceeding max value", () => {
      expect(isValidTokenInput("999999999999999")).toBe(false);
    });

    it("should reject zero", () => {
      expect(isValidTokenInput("0")).toBe(false);
    });

    it("should reject dot after comma", () => {
      expect(isValidTokenInput("1,23.45")).toBe(false);
    });
  });

  describe("extractNumericValue", () => {
    it("should extract numeric value", () => {
      expect(extractNumericValue("1.234,50")).toBe(1234.5);
    });

    it("should return 0 for empty", () => {
      expect(extractNumericValue("")).toBe(0);
    });
  });

  describe("formatNumberToDisplay", () => {
    it("should format number to display format", () => {
      expect(formatNumberToDisplay(1234.5)).toBe("1.234,5");
    });

    it("should format large number", () => {
      expect(formatNumberToDisplay(1234567.890123)).toBe("1.234.567,890123");
    });

    it("should format zero", () => {
      expect(formatNumberToDisplay(0)).toBe("0");
    });

    it("should format integer", () => {
      expect(formatNumberToDisplay(1000)).toBe("1.000");
    });
  });
});
