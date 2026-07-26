/**
 * Hook para validación de inputs de compra/venta
 * Maneja validación de balance, cantidad, y formato de entrada
 */

"use client";

import { useMemo } from "react";
import {
  validate_token_amount,
  validate_sol_balance,
  validate_wallet_connected,
  BALANCE_BUFFER_SOL,
} from "@/lib/purchase";

/**
 * Props para el hook use_purchase_validation
 */
export interface UsePurchaseValidationProps {
  mode: "buy" | "sell";
  token_amount: number;
  wallet_address: string | null;
  sol_balance: number | null;
  required_sol: number;
}

/**
 * Resultado del hook use_purchase_validation
 */
export interface UsePurchaseValidationResult {
  can_submit: boolean;
  wallet_error: string | null;
  token_error: string | null;
  balance_error: string | null;
  all_errors: string[];
  has_wallet: boolean;
  has_enough_balance: boolean;
  required_sol_with_buffer: number;
}

/**
 * Hook para validar inputs de compra/venta
 *
 * Valida:
 * - Wallet conectada
 * - Cantidad de tokens válida
 * - Balance de SOL suficiente (para compra)
 *
 * @param props - Props con datos de compra/venta
 * @returns Objeto con estado de validación
 *
 * @example
 * const { can_submit, all_errors } = use_purchase_validation({
 *   mode: "buy",
 *   token_amount: 100,
 *   wallet_address: "7KLd2Cx...",
 *   sol_balance: 1.5,
 *   required_sol: 1.0
 * });
 *
 * if (can_submit) {
 *   // Ejecutar compra
 * }
 */
export function use_purchase_validation({
  mode,
  token_amount,
  wallet_address,
  sol_balance,
  required_sol,
}: UsePurchaseValidationProps): UsePurchaseValidationResult {
  /**
   * Validar wallet conectada
   */
  const wallet_validation = useMemo(() => {
    return validate_wallet_connected(wallet_address);
  }, [wallet_address]);

  /**
   * Validar cantidad de tokens
   */
  const token_validation = useMemo(() => {
    return validate_token_amount(token_amount);
  }, [token_amount]);

  /**
   * Validar balance de SOL (solo para compra)
   */
  const required_sol_with_buffer = useMemo(() => {
    return required_sol + BALANCE_BUFFER_SOL;
  }, [required_sol]);

  const balance_validation = useMemo(() => {
    if (mode === "sell") {
      return { is_valid: true, error_message: null };
    }
    return validate_sol_balance(sol_balance, required_sol);
  }, [mode, sol_balance, required_sol]);

  /**
   * Determinar si hay suficiente balance
   */
  const has_enough_balance = useMemo(() => {
    return balance_validation.is_valid;
  }, [balance_validation]);

  /**
   * Reunir todos los errores
   */
  const all_errors = useMemo(() => {
    const errors: string[] = [];
    if (!wallet_validation.is_valid && wallet_validation.error_message) {
      errors.push(wallet_validation.error_message);
    }
    if (!token_validation.is_valid && token_validation.error_message) {
      errors.push(token_validation.error_message);
    }
    if (!balance_validation.is_valid && balance_validation.error_message) {
      errors.push(balance_validation.error_message);
    }
    return errors;
  }, [wallet_validation, token_validation, balance_validation]);

  /**
   * Determinar si se puede enviar el formulario
   */
  const can_submit = useMemo(() => {
    if (mode === "buy") {
      return (
        wallet_validation.is_valid &&
        token_validation.is_valid &&
        balance_validation.is_valid
      );
    }
    // Para venta: solo wallet y cantidad
    return wallet_validation.is_valid && token_validation.is_valid;
  }, [mode, wallet_validation, token_validation, balance_validation]);

  return {
    can_submit,
    wallet_error: wallet_validation.error_message,
    token_error: token_validation.error_message,
    balance_error: balance_validation.error_message,
    all_errors,
    has_wallet: wallet_validation.is_valid,
    has_enough_balance,
    required_sol_with_buffer,
  };
}
