"use client";

import React, { ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import { useTokenInput } from "@/lib/hooks/useTokenInput";
import { formatTokenInput } from "@/lib/utils/token-input-formatter";

interface TokenAmountInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onValueChange?: (numericValue: number) => void;
  onValidationChange?: (isValid: boolean) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  label?: string;
  helperText?: string;
  className?: string;
  required?: boolean;
}

/**
 * Componente mejorado para input de cantidad de tokens
 *
 * Features:
 * ✓ Separador de miles (.)
 * ✓ Separador decimal (,)
 * ✓ Texto RTL (derecha a izquierda)
 * ✓ Sin icono spinner
 * ✓ Validación visual
 * ✓ Max 6 decimales
 */
export function TokenAmountInput({
  value: externalValue,
  onChange,
  onValueChange,
  onValidationChange,
  placeholder = "0",
  disabled = false,
  error,
  label,
  helperText,
  className,
  required = false,
}: TokenAmountInputProps) {
  const {
    displayValue,
    numericValue,
    handleChange,
    handleBlur,
    isValid,
    reset,
  } = useTokenInput({
    initialValue: externalValue || "",
    onValueChange,
    onValidationChange,
  });

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawInput = e.target.value;
    const formatted = formatTokenInput(rawInput);
    handleChange(rawInput);
    if (onChange) {
      onChange(formatted);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Input Container */}
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            // Base styles
            "w-full px-4 py-3 text-right text-lg font-semibold",
            "border rounded-lg transition-colors",
            "placeholder-gray-400",
            // Direction RTL
            "direction-rtl",
            // Focus styles
            "focus:outline-none focus:ring-2",
            // States
            disabled && "bg-gray-100 cursor-not-allowed opacity-50",
            !disabled && "bg-white",
            // Border color based on validation
            error
              ? "border-red-500 focus:ring-red-500"
              : displayValue && isValid
                ? "border-green-500 focus:ring-green-500"
                : "border-gray-300 focus:ring-blue-500",
            "focus:border-transparent",
          )}
          aria-invalid={!!error}
          aria-describedby={
            error ? "error-message" : helperText ? "helper-text" : undefined
          }
        />

        {/* Validation Indicator */}
        {displayValue && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isValid ? (
              <span className="text-green-500 font-bold text-lg">✓</span>
            ) : (
              <span className="text-red-500 font-bold text-lg">✕</span>
            )}
          </div>
        )}
      </div>

      {/* Helper Text / Error / Info */}
      <div className="flex justify-between items-start text-xs">
        <div className="flex flex-col gap-1">
          {isValid && (
            <span className="text-gray-500">
              {numericValue.toLocaleString("es-ES")} GAPC
            </span>
          )}
          {helperText && !error && (
            <span id="helper-text" className="text-gray-500">
              {helperText}
            </span>
          )}
        </div>
        {error && (
          <span id="error-message" className="text-red-500 font-medium">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Wrapper component para uso simplificado
 */
export function TokenAmountInputSimple(
  props: Omit<TokenAmountInputProps, "value" | "onChange">,
) {
  const [value, setValue] = React.useState("");

  return <TokenAmountInput {...props} value={value} onChange={setValue} />;
}
