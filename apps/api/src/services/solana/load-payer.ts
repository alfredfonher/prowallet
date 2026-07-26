import { Keypair } from "@solana/web3.js";
import { secretKeyService } from "./secret-key.service";
import { loggerService } from "../../services/logging/logger.service";

/**
 * Función segura para cargar el keypair del treasury
 * Implementa múltiples capas de seguridad
 */
export async function loadPayerKeypair(): Promise<Keypair> {
  try {
    return await secretKeyService.getKeyPair();
  } catch (error) {
    loggerService.logError(error as Error, {
      context: "loadPayerKeypair",
    });
    throw new Error("Failed to load treasury keypair");
  }
}

/**
 * Función de compatibilidad para código existente
 * @deprecated Usar loadPayerKeypair() en su lugar
 */
export function loadPayerKeypairSync(): Keypair {
  throw new Error(
    "Synchronous keypair loading is not supported. Use loadPayerKeypair() instead.",
  );
}
