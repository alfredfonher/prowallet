/**
 * Reconstruye transacciones para agregar firmas adicionales
 *
 * El problema: cuando una transacción es serializada por el cliente y luego
 * deserializada en el servidor, no se pueden agregar signers nuevos porque
 * ya está congelada en su estructura.
 *
 * La solución: reconstruir la transacción en el servidor con ambos signers
 * desde el principio, aprovechando las instrucciones del cliente.
 */

import {
  Transaction,
  PublicKey,
  Connection,
  TransactionInstruction,
} from "@solana/web3.js";
import { PROWALLET_CONFIG } from "../../config";

/**
 * Reconstruye una transacción de transferencia de tokens con ambos signers
 *
 * @param clientTx - Transacción original del cliente (para extraer instrucciones)
 * @param authorityKey - Clave pública de la autoridad (para ser signer)
 * @param blockhash - Nuevo blockhash reciente
 * @param connection - Conexión a Solana
 * @returns Nueva transacción reconstruida con ambos signers
 */
export async function reconstructTokenTransactionWithAuthority(
  clientTx: Transaction,
  authorityKey: PublicKey,
  blockhash: string,
  connection: Connection,
): Promise<Transaction> {
  // Crear nueva transacción con autoridad como feePayer
  const reconstructedTx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: authorityKey, // Authority pays fees
  });

  console.log("🔨 Reconstruyendo transacción con ambos signers:", {
    feePayer: authorityKey.toString(),
    originalInstructions: clientTx.instructions.length,
  });

  // Copiar todas las instrucciones de la transacción original
  clientTx.instructions.forEach((instruction, idx) => {
    console.log(
      `  Copiando instrucción ${idx + 1}/${clientTx.instructions.length}:`,
      {
        programId: instruction.programId.toString(),
        keys: instruction.keys.length,
      },
    );
    reconstructedTx.add(instruction);
  });

  // La clave: ahora la transacción tiene authority como feePayer,
  // lo que automáticamente lo registra como signer requerido
  console.log("✅ Transacción reconstruida con", {
    instructions: reconstructedTx.instructions.length,
    feePayer: reconstructedTx.feePayer?.toString(),
    status: "lista para doble firma",
  });

  return reconstructedTx;
}

/**
 * Verifica que todos los signers requeridos estén presentes
 */
export function validateRequiredSigners(
  transaction: Transaction,
  expectedSigners: PublicKey[],
): { valid: boolean; missing: string[] } {
  const requiredSigners = new Set<string>();

  // El feePayer es siempre requerido
  if (transaction.feePayer) {
    requiredSigners.add(transaction.feePayer.toString());
  }

  // Recolectar signers de instrucciones
  transaction.instructions.forEach((instruction) => {
    instruction.keys.forEach((key) => {
      if (key.isSigner) {
        requiredSigners.add(key.pubkey.toString());
      }
    });
  });

  const expectedSet = new Set(expectedSigners.map((pk) => pk.toString()));
  const missing: string[] = [];

  expectedSet.forEach((signer) => {
    if (!requiredSigners.has(signer)) {
      missing.push(signer);
    }
  });

  return {
    valid: missing.length === 0,
    missing,
  };
}
