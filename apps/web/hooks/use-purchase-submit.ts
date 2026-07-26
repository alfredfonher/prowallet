/**
 * Hook para manejar el envío de transacciones de compra/venta
 * Orquesta todo el flujo: precio, validación, API calls
 */

"use client";

import { useCallback, useState } from "react";

/**
 * Estado de la transacción pendiente
 */
export interface PendingTransaction {
  mode: "buy" | "sell";
  amount: number;
}

/**
 * Resultado del hook use_purchase_submit
 */
export interface UsePurchaseSubmitResult {
  is_processing: boolean;
  error: string | null;
  pending_transaction: PendingTransaction | null;
  open_confirmation_modal: () => void;
  cancel_transaction: () => void;
  confirm_transaction: (on_success: () => void) => Promise<void>;
  set_pending_transaction: (tx: PendingTransaction | null) => void;
  clear_error: () => void;
}

/**
 * Hook para manejar el envío de transacciones
 *
 * Responsabilidades:
 * - Mostrar modal de confirmación
 * - Validar precio antes de enviar
 * - Llamar buyTokens / sellTokens
 * - Manejar errores y timeouts
 * - Verificar estado remoto si hay timeout
 *
 * @returns Objeto con métodos para control de transacción
 *
 * @example
 * const { open_confirmation_modal, confirm_transaction } = use_purchase_submit();
 *
 * const handle_submit = async (e: React.FormEvent) => {
 *   e.preventDefault();
 *   open_confirmation_modal();
 * };
 *
 * const handle_confirm = async () => {
 *   await confirm_transaction(() => {
 *     console.log('Compra exitosa');
 *   });
 * };
 */
export function use_purchase_submit(): UsePurchaseSubmitResult {
  const [is_processing, set_is_processing] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [pending_transaction, set_pending_transaction] =
    useState<PendingTransaction | null>(null);

  /**
   * Abrir modal de confirmación
   */
  const open_confirmation_modal = useCallback(() => {
    // Este callback se usa desde el componente para abrir el modal
    // El estado pending_transaction controla si se muestra o no
  }, []);

  /**
   * Cancelar transacción pendiente
   */
  const cancel_transaction = useCallback(() => {
    set_pending_transaction(null);
    set_error(null);
    set_is_processing(false);
  }, []);

  /**
   * Limpiar error
   */
  const clear_error = useCallback(() => {
    set_error(null);
  }, []);

  /**
   * Confirmar y ejecutar transacción
   *
   * Este es el método principal que orquesta todo el flujo
   */
  const confirm_transaction = useCallback(
    async (on_success: () => void) => {
      if (!pending_transaction) return;

      set_is_processing(true);
      set_error(null);

      try {
        // Aquí se ejecutaría la lógica de compra/venta
        // Por ahora es un placeholder que será completado en trade-view.tsx

        // Simular validación de precio pre-transacción
        // En la implementación real, llamaría a /exchange/getPrice

        // Llamar a buyTokens / sellTokens desde TokenProvider
        // const txId = await buyTokens(wallet_address, pending_transaction.amount);

        // Si llegamos aquí sin excepciones, fue éxito
        on_success();
        set_pending_transaction(null);
      } catch (err: any) {
        const error_msg =
          err?.message || "Ocurrió un error al procesar la operación";
        set_error(error_msg);

        // Intentar verificar estado remoto si hay txId
        // const status_response = await apiClient.get(`/purchase/status/${txId}`);
        // if (status_response?.minted) {
        //   // La compra se procesó en backend a pesar del error
        //   on_success();
        // }
      } finally {
        set_is_processing(false);
      }
    },
    [pending_transaction],
  );

  return {
    is_processing,
    error,
    pending_transaction,
    open_confirmation_modal,
    cancel_transaction,
    confirm_transaction,
    set_pending_transaction,
    clear_error,
  };
}
