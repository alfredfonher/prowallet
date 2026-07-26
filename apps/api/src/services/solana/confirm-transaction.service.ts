import { Connection } from "@solana/web3.js";
import { loggerService } from "../logging/logger.service";

interface ConfirmOptions {
  maxRetries?: number;
  timeout?: number; // milliseconds
  initialDelay?: number; // milliseconds
  maxDelay?: number; // milliseconds
}

const DEFAULT_OPTIONS: ConfirmOptions = {
  maxRetries: 15, // Aumentado de 3 a 15 reintentos
  timeout: 180000, // 3 minutos (aumentado para manejar rate limiting)
  initialDelay: 5000, // 5 segundos para evitar rate limiting
  maxDelay: 15000, // 15 segundos máximo entre intentos
};

/**
 * Confirma una transacción de Solana con reintentos exponenciales
 * y timeout más largo que el default (30 segundos)
 *
 * Estrategia:
 * 1. Intenta confirmar con "finalized" commitment (más seguro)
 * 2. Si falla, intenta con "confirmed" commitment (más rápido)
 * 3. Si ambos fallan, retorna null en lugar de lanzar error
 *
 * @param connection - Conexión a Solana
 * @param signature - Firma de la transacción
 * @param options - Opciones de confirmación
 * @returns true si se confirmó, false si no se pudo confirmar
 */
export async function confirm_transaction_with_retries(
  connection: Connection,
  signature: string,
  options: ConfirmOptions = {},
): Promise<boolean> {
  const finalOptions = { ...DEFAULT_OPTIONS, ...options };

  loggerService.logInfo(
    `🔄 Iniciando confirmación de transacción con reintentos`,
    {
      context: "confirm_transaction_with_retries",
      signature,
      maxRetries: finalOptions.maxRetries,
      timeout: finalOptions.timeout,
    },
  );

  // Primero intentar con "finalized" (más seguro pero más lento)
  const finalized_result = await confirm_with_commitment(
    connection,
    signature,
    "finalized",
    finalOptions,
  );

  if (finalized_result) {
    loggerService.logInfo(`✅ Transacción confirmada (finalized)`, {
      context: "confirm_transaction_with_retries",
      signature,
    });
    return true;
  }

  // Si no se confirma con "finalized", intentar con "confirmed"
  loggerService.logInfo(
    `⚠️ No confirmada con "finalized", intentando con "confirmed"`,
    {
      context: "confirm_transaction_with_retries",
      signature,
    },
  );

  const confirmed_result = await confirm_with_commitment(
    connection,
    signature,
    "confirmed",
    finalOptions,
  );

  if (confirmed_result) {
    loggerService.logInfo(`✅ Transacción confirmada (confirmed)`, {
      context: "confirm_transaction_with_retries",
      signature,
    });
    return true;
  }

  // Si ambos fallan, loguear error pero no lanzar excepción
  // La transacción podría estar en la red pero no confirmada aún
  loggerService.logInfo(
    `⚠️ No se pudo confirmar la transacción en ${finalOptions.timeout}ms`,
    {
      context: "confirm_transaction_with_retries",
      signature,
      note: "La transacción puede seguir siendo procesada por la red. Verificar en Solana Explorer.",
    },
  );

  return false;
}

/**
 * Confirma una transacción con un commitment level específico
 * con reintentos exponenciales
 */
async function confirm_with_commitment(
  connection: Connection,
  signature: string,
  commitment: "confirmed" | "finalized",
  options: ConfirmOptions,
): Promise<boolean> {
  let delay = options.initialDelay || 1000;
  const max_delay = options.maxDelay || 10000;
  const max_retries = options.maxRetries || 10;
  const start_time = Date.now();

  for (let attempt = 1; attempt <= max_retries; attempt++) {
    try {
      const timeout = (options.timeout || 120000) - (Date.now() - start_time);

      if (timeout <= 0) {
        loggerService.logInfo(`⏰ Timeout global alcanzado`, {
          context: "confirm_with_commitment",
          signature,
          commitment,
          elapsed_ms: Date.now() - start_time,
        });
        return false;
      }

      loggerService.logInfo(
        `🔄 Intento ${attempt}/${max_retries} de confirmación (${commitment})`,
        {
          context: "confirm_with_commitment",
          signature,
          delay_ms: delay,
        },
      );

      // Esperar un poco antes de intentar
      await wait_milliseconds(delay);

      // Intentar confirmar con timeout
      const result = await Promise.race([
        connection.confirmTransaction(signature, commitment),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout esperando confirmación`)),
            Math.min(timeout, 30000), // Max 30 segundos por intento
          ),
        ),
      ]);

      loggerService.logInfo(
        `✅ Confirmación exitosa en intento ${attempt} (${commitment})`,
        {
          context: "confirm_with_commitment",
          signature,
        },
      );

      return true;
    } catch (error) {
      const err = error as Error;

      loggerService.logInfo(
        `⚠️ Intento ${attempt}/${max_retries} falló: ${err.message}`,
        {
          context: "confirm_with_commitment",
          signature,
          commitment,
        },
      );

      // Si es el último intento, no reintentar
      if (attempt === max_retries) {
        loggerService.logInfo(
          `❌ Todos los reintentos agotados (${commitment})`,
          {
            context: "confirm_with_commitment",
            signature,
            commitment,
            total_attempts: max_retries,
          },
        );
        return false;
      }

      // Aumentar delay exponencialmente pero más agresivo para evitar rate limiting
      delay = Math.min(delay * 2, max_delay);
    }
  }

  return false;
}

/**
 * Helper para esperar un cierto tiempo
 */
function wait_milliseconds(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Verifica el estado de una transacción sin intentar confirmar
 * (útil para validar si ya fue confirmada)
 */
export async function check_transaction_status(
  connection: Connection,
  signature: string,
): Promise<{
  status: "confirmed" | "finalized" | "unknown";
  age_blocks?: number;
} | null> {
  try {
    // Intentar obtener la transacción
    const tx_response = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx_response) {
      return { status: "unknown" };
    }

    // Si meta es null, transacción fue droppeada
    if (!tx_response.meta) {
      return { status: "unknown" };
    }

    // Si meta.err es null, la transacción fue exitosa
    if (tx_response.meta.err === null) {
      // Determinar si es "finalized" o "confirmed"
      // Esto es aproximado, Solana no proporciona esto directamente
      return {
        status: "finalized",
        age_blocks: await get_current_block_height()
          .then((h) => h - (tx_response.slot ?? 0))
          .catch(() => undefined),
      };
    }

    // Si hay error en meta.err, la transacción falló
    return {
      status: "unknown",
      age_blocks: undefined,
    };
  } catch (error) {
    const err = error as Error;
    loggerService.logInfo(`Error verificando estado de transacción`, {
      context: "check_transaction_status",
      signature,
      error: err.message,
    });
    return null;
  }
}

/**
 * Obtiene la altura de bloque actual
 */
async function get_current_block_height(): Promise<number> {
  // Esta función sería implementada en solanaService
  // Por ahora retornamos 0
  return 0;
}

/**
 * Función para monitorear una transacción en background
 * Útil para transacciones que tomaron mucho tiempo
 */
export function monitor_transaction_in_background(
  connection: Connection,
  signature: string,
  on_confirmed?: (sig: string) => void,
  on_failed?: (sig: string, reason: string) => void,
): void {
  // Ejecutar en background sin bloquear
  confirm_transaction_with_retries(connection, signature, {
    maxRetries: 30, // Más reintentos para background
    timeout: 300000, // 5 minutos para background
  })
    .then((success) => {
      if (success && on_confirmed) {
        on_confirmed(signature);
      } else if (!success && on_failed) {
        on_failed(signature, "Confirmación agotada");
      }
    })
    .catch((error) => {
      const err = error as Error;
      if (on_failed) {
        on_failed(signature, err.message);
      }
    });
}
