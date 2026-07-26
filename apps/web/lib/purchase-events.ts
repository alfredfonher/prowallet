/**
 * Módulo de eventos para el flujo de compra de tokens.
 * Usa CustomEvent de JavaScript para comunicación desacoplada
 * entre el token provider y el modal de confirmación.
 *
 * PROPÓSITO:
 * - Eliminar race conditions en el cierre del modal
 * - Desacoplar token-provider.tsx de TransactionConfirmationModal.tsx
 * - Permitir múltiples transacciones simultáneas
 */

export interface PurchaseConfirmedDetail {
  transactionId: string;
  tokenAmount: number;
  mintSignature?: string;
  walletAddress?: string;
  timestamp: number;
}

export interface PurchaseFailedDetail {
  transactionId: string;
  error: string;
  timestamp: number;
}

export class PurchaseEvents {
  /**
   * Evento emitido cuando una compra se confirmó exitosamente
   * y los tokens fueron minted.
   *
   * CUÁNDO SE EMITE:
   * - Después de que buyTokens() completó exitosamente
   * - Después de que los tokens fueron minted en blockchain
   * - Después de que la BD fue actualizada
   *
   * QUIÉN LO ESCUCHA:
   * - TransactionConfirmationModal
   * - Cualquier otra UI que quiera notificación de éxito
   */
  static readonly PURCHASE_CONFIRMED = "prowallet:purchase.confirmed";

  /**
   * Evento emitido cuando una compra falló.
   *
   * CUÁNDO SE EMITE:
   * - Cuando hay un error en cualquier paso de buyTokens()
   * - Antes de que se actualice el estado local de error
   *
   * QUIÉN LO ESCUCHA:
   * - TransactionConfirmationModal
   * - Logs y analytics
   */
  static readonly PURCHASE_FAILED = "prowallet:purchase.failed";

  /**
   * Emitir evento de compra confirmada
   *
   * EJEMPLO:
   * ```
   * PurchaseEvents.emitConfirmed({
   *   transactionId: "tx-123",
   *   tokenAmount: 100,
   *   mintSignature: "sig-456",
   *   walletAddress: "abc...xyz",
   *   timestamp: Date.now()
   * });
   * ```
   */
  static emitConfirmed(detail: PurchaseConfirmedDetail) {
    if (typeof window === "undefined") return;

    try {
      console.log("🚀 [PurchaseEvents] EMITIENDO PURCHASE_CONFIRMED:", {
        eventName: this.PURCHASE_CONFIRMED,
        transactionId: detail.transactionId,
        tokenAmount: detail.tokenAmount,
        timestamp: new Date(detail.timestamp).toISOString(),
      });

      window.dispatchEvent(
        new CustomEvent(this.PURCHASE_CONFIRMED, { detail }),
      );

      console.log(
        "✅ [PurchaseEvents] PURCHASE_CONFIRMED emitido exitosamente",
      );
    } catch (e) {
      console.error(
        "❌ [PurchaseEvents] Error emitiendo PURCHASE_CONFIRMED:",
        e,
      );
    }
  }

  /**
   * Emitir evento de compra fallida
   *
   * EJEMPLO:
   * ```
   * PurchaseEvents.emitFailed({
   *   transactionId: "tx-123",
   *   error: "Balance insuficiente",
   *   timestamp: Date.now()
   * });
   * ```
   */
  static emitFailed(detail: PurchaseFailedDetail) {
    if (typeof window === "undefined") return;

    try {
      window.dispatchEvent(new CustomEvent(this.PURCHASE_FAILED, { detail }));
      console.log("📢 [PurchaseEvents] PURCHASE_FAILED emitido:", {
        transactionId: detail.transactionId,
        error: detail.error,
        timestamp: new Date(detail.timestamp).toISOString(),
      });
    } catch (e) {
      console.error("[PurchaseEvents] Error emitiendo PURCHASE_FAILED:", e);
    }
  }

  /**
   * Hook para escuchar el evento PURCHASE_CONFIRMED
   *
   * RETORNA:
   * - Función para desuscribirse (cleanup)
   *
   * EJEMPLO:
   * ```
   * useEffect(() => {
   *   const unsubscribe = PurchaseEvents.onConfirmed((detail) => {
   *     console.log("Compra confirmada:", detail);
   *     setConfirmed(true);
   *   });
   *   return () => unsubscribe();
   * }, []);
   * ```
   */
  static onConfirmed(
    callback: (detail: PurchaseConfirmedDetail) => void,
  ): () => void {
    if (typeof window === "undefined") return () => {};

    const handler = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as PurchaseConfirmedDetail;
        callback(detail);
      } catch (err) {
        console.warn(
          "[PurchaseEvents] Error en handler PURCHASE_CONFIRMED:",
          err,
        );
      }
    };

    window.addEventListener(this.PURCHASE_CONFIRMED, handler);
    console.log("👂 [PurchaseEvents] Listener PURCHASE_CONFIRMED registrado");

    // Retornar función para desuscribirse
    return () => {
      window.removeEventListener(this.PURCHASE_CONFIRMED, handler);
      console.log("👋 [PurchaseEvents] Listener PURCHASE_CONFIRMED removido");
    };
  }

  /**
   * Hook para escuchar el evento PURCHASE_FAILED
   *
   * RETORNA:
   * - Función para desuscribirse (cleanup)
   *
   * EJEMPLO:
   * ```
   * useEffect(() => {
   *   const unsubscribe = PurchaseEvents.onFailed((detail) => {
   *     console.error("Compra falló:", detail.error);
   *     setError(detail.error);
   *   });
   *   return () => unsubscribe();
   * }, []);
   * ```
   */
  static onFailed(
    callback: (detail: PurchaseFailedDetail) => void,
  ): () => void {
    if (typeof window === "undefined") return () => {};

    const handler = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as PurchaseFailedDetail;
        callback(detail);
      } catch (err) {
        console.warn("[PurchaseEvents] Error en handler PURCHASE_FAILED:", err);
      }
    };

    window.addEventListener(this.PURCHASE_FAILED, handler);
    console.log("👂 [PurchaseEvents] Listener PURCHASE_FAILED registrado");

    // Retornar función para desuscribirse
    return () => {
      window.removeEventListener(this.PURCHASE_FAILED, handler);
      console.log("👋 [PurchaseEvents] Listener PURCHASE_FAILED removido");
    };
  }
}
