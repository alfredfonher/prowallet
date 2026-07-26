const DECIMAL_SEPARATOR = ",";
const THOUSANDS_SEPARATOR = ".";
const MAX_DECIMALS = 6;
const MAX_TOKEN_VALUE = 999_999_999_999;

/**
 * Formats token input with thousands separator (.) and decimal separator (,)
 * - Adds thousands separator after every 3 digits
 * - Converts dot to comma for decimals (only if preceded by 0)
 * - Limits decimal places to 6
 * - Text flows right-to-left
 *
 * @param input Raw user input
 * @returns Formatted string ready for display
 *
 * @example
 * formatTokenInput('1234') => '1.234'
 * formatTokenInput('1234,50') => '1.234,50'
 * formatTokenInput('0.5') => '0,5'
 * formatTokenInput('12.34') => '1234' (dot not preceded by 0, invalid)
 */
export function formatTokenInput(input: string): string {
  if (!input) return "";

  // Check if input contains decimal separator (comma or dot)
  const hasComma = input.includes(",");
  const hasDot = input.includes(".");

  let integerPart = input;
  let decimalPart = "";

  // Handle decimal input
  if (hasComma || hasDot) {
    const separatorIndex = hasComma ? input.indexOf(",") : input.indexOf(".");

    integerPart = input.substring(0, separatorIndex);
    const potentialDecimal = input.substring(separatorIndex + 1);

    // Validate dot usage: only allow if preceded by 0
    if (hasDot) {
      if (integerPart !== "0") {
        // Dot found but not preceded by 0, treat as thousands separator
        // Remove both dots and commas, treat as integer
        integerPart = input.replace(/[.,]/g, "");
        decimalPart = "";
      } else {
        // Valid: 0.x format, convert to 0,x
        decimalPart = potentialDecimal;
      }
    } else {
      // Comma separator - valid decimal
      decimalPart = potentialDecimal;
    }

    // Clean integer part - remove any separators
    integerPart = integerPart.replace(/[.,]/g, "");
  } else {
    // Integer input - remove any separators
    integerPart = input.replace(/[.,]/g, "");
  }

  // Remove leading zeros from integer part (but keep at least one digit)
  integerPart = integerPart.replace(/^0+(?!$)/, "");
  if (!integerPart) integerPart = "0";

  // Limit decimal places
  if (decimalPart) {
    decimalPart = decimalPart.slice(0, MAX_DECIMALS);
  }

  // Add thousands separators to integer part
  const formattedInteger = integerPart.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    THOUSANDS_SEPARATOR,
  );

  // Combine parts
  return decimalPart
    ? `${formattedInteger}${DECIMAL_SEPARATOR}${decimalPart}`
    : formattedInteger;
}

/**
 * Parses formatted input string to numeric value
 *
 * @param input Formatted input string
 * @returns Numeric value or 0 if invalid
 *
 * @example
 * parseTokenInput('1.234,50') => 1234.50
 * parseTokenInput('100') => 100
 * parseTokenInput('0,5') => 0.5
 */
export function parseTokenInput(input: string): number {
  if (!input) return 0;

  try {
    const normalized = input
      .replace(/\./g, "") // Remove thousands separators
      .replace(/,/g, "."); // Convert decimal separator to standard

    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
}

/**
 * Validates token input
 *
 * @param input Input string to validate
 * @returns true if valid, false otherwise
 *
 * Validation rules:
 * - Must not be empty
 * - Must be positive
 * - Must not exceed MAX_TOKEN_VALUE
 * - Only one decimal separator allowed
 * - No negative signs
 */
export function isValidTokenInput(input: string): boolean {
  if (!input) return false;

  const parsed = parseTokenInput(input);

  // Check if positive and within bounds
  if (parsed <= 0 || parsed > MAX_TOKEN_VALUE) {
    return false;
  }

  // Check for multiple decimal separators
  const commaCount = (input.match(/,/g) || []).length;
  const dotCount = (input.match(/\./g) || []).length;

  // Only allow one comma OR dots used as thousands separators
  if (commaCount > 1) {
    return false;
  }

  // If there's a comma, no dots should be after it
  if (commaCount === 1 && input.indexOf(".") > input.indexOf(",")) {
    return false;
  }

  // Check for negative sign
  if (input.includes("-")) {
    return false;
  }

  return true;
}

/**
 * Extracts numeric value from formatted input
 *
 * @param input Formatted input string
 * @returns Clean numeric value
 */
export function extractNumericValue(input: string): number {
  return parseTokenInput(input);
}

/**
 * Formats a number back to display format
 *
 * @param value Numeric value
 * @returns Formatted string
 *
 * @example
 * formatNumberToDisplay(1234.5) => '1.234,5'
 */
export function formatNumberToDisplay(value: number): string {
  if (value === 0) return "0";

  const [integerStr, decimalStr] = value.toString().split(".");

  const formattedInteger = integerStr.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    THOUSANDS_SEPARATOR,
  );

  return decimalStr
    ? `${formattedInteger}${DECIMAL_SEPARATOR}${decimalStr}`
    : formattedInteger;
}
