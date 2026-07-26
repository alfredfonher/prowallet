import { useState, useCallback, useEffect } from "react";
import {
  formatTokenInput,
  parseTokenInput,
  isValidTokenInput,
} from "../utils/token-input-formatter";

interface UseTokenInputOptions {
  initialValue?: string;
  onValueChange?: (value: number) => void;
  onValidationChange?: (isValid: boolean) => void;
  maxValue?: number;
}

export interface UseTokenInputReturn {
  displayValue: string;
  numericValue: number;
  handleChange: (value: string) => void;
  handleBlur: () => void;
  isValid: boolean;
  reset: () => void;
  setDisplayValue: (value: string) => void;
}

/**
 * Hook para manejar input de cantidad de tokens con formato
 *
 * @param options Configuration options
 * @returns Token input state and handlers
 *
 * Features:
 * - Automatic formatting with thousands separator (.)
 * - Decimal separator (,)
 * - Validation
 * - RTL text direction
 * - Max 6 decimal places
 */
export function useTokenInput(
  options: UseTokenInputOptions = {},
): UseTokenInputReturn {
  const {
    initialValue = "",
    onValueChange,
    onValidationChange,
    maxValue = 999_999_999_999,
  } = options;

  const [displayValue, setDisplayValue] = useState<string>(initialValue);

  const numericValue = parseTokenInput(displayValue);
  const isValid = displayValue === "" ? false : isValidTokenInput(displayValue);

  // Notify validation changes
  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(isValid);
    }
  }, [isValid, onValidationChange]);

  // Notify value changes
  useEffect(() => {
    if (isValid && onValueChange) {
      onValueChange(numericValue);
    }
  }, [numericValue, isValid, onValueChange]);

  const handleChange = useCallback((rawInput: string) => {
    const formatted = formatTokenInput(rawInput);
    setDisplayValue(formatted);
  }, []);

  const handleBlur = useCallback(() => {
    // Re-format on blur to ensure clean display
    if (displayValue) {
      const reformatted = formatTokenInput(displayValue);
      setDisplayValue(reformatted);
    }
  }, [displayValue]);

  const reset = useCallback(() => {
    setDisplayValue("");
  }, []);

  return {
    displayValue,
    numericValue,
    handleChange,
    handleBlur,
    isValid,
    reset,
    setDisplayValue,
  };
}
