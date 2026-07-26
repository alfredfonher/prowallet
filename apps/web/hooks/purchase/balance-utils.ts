/**
 * Utilidades para obtener balance con fallback (API primero, luego RPC)
 * Evita errores 403 de CORS al usar RPC público directamente
 */

import { PublicKey, LAMPORTS_PER_SOL, Connection } from "@solana/web3.js";
import { apiClient } from "@/lib/api-client";
import { BalanceError } from "./types";

/**
 * Obtiene el balance de SOL con fallback inteligente
 * 1. Intenta desde API backend (sin CORS issues)
 * 2. Fallback a RPC directo si API falla
 */
export async function getBalanceWithFallback(
  publicKey: PublicKey,
  connection: Connection,
  source: "api" | "rpc" | "both" = "both",
): Promise<number> {
  let solBalance = 0;

  if (source === "both" || source === "api") {
    try {
      // Intentar desde API backend primero
      const response = await apiClient.get<any>(
        `/exchange/getBalance/${publicKey.toString()}`,
      );

      const balance =
        response?.extra?.balance ||
        response?.data?.balance ||
        response?.balance ||
        null;

      if (balance !== null && balance !== undefined) {
        const numBalance = Number(balance);
        if (isFinite(numBalance) && numBalance >= 0) {
          return numBalance;
        }
      }
    } catch (err) {
      if (source === "api") {
        throw err; // Si solo queremos API, propagar error
      }
      // Si es fallback, continuar a RPC
    }
  }

  if (source === "both" || source === "rpc") {
    try {
      const lamports = await connection.getBalance(publicKey);
      solBalance = lamports / LAMPORTS_PER_SOL;
      return solBalance;
    } catch (err) {
      throw new Error(
        `Could not fetch balance from RPC: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  throw new Error("No valid balance source available");
}

/**
 * Valida que hay suficiente balance con fallback
 */
export async function validateSolBalanceWithFallback(
  publicKey: PublicKey,
  connection: Connection,
  requiredSol: number = 0.05,
): Promise<number> {
  let currentSol = 0;

  try {
    // Intentar desde API primero
    currentSol = await getBalanceWithFallback(publicKey, connection, "both");
  } catch (err) {
    console.error("Balance verification failed:", err);
    throw new BalanceError(
      `No se pudo verificar balance: ${
        err instanceof Error ? err.message : "Error desconocido"
      }`,
      "BALANCE_VERIFICATION_FAILED",
    );
  }

  if (currentSol < requiredSol) {
    throw new BalanceError(
      `Fondos insuficientes. Necesitas ${requiredSol} SOL, tienes ${currentSol.toFixed(
        4,
      )} SOL`,
      "INSUFFICIENT_BALANCE",
    );
  }

  return currentSol;
}

/**
 * Obtiene el precio del SOL en USD con múltiples fuentes
 */
export async function getSolPriceWithFallback(): Promise<number> {
  try {
    // Intentar /exchange/solPrice primero
    const priceResponse = await apiClient.get<any>("/exchange/solPrice");

    const price =
      priceResponse?.extra?.solPriceUsd ||
      priceResponse?.solPriceUsd ||
      priceResponse?.data?.solPriceUsd ||
      null;

    if (price && Number(price) > 0) {
      return Number(price);
    }

    // Fallback a market-stats
    const stats = await apiClient.getMarketStats();
    const statsPrice = stats?.solPriceUsd || stats?.solPrice || 0;

    if (statsPrice > 0) {
      return statsPrice;
    }

    throw new Error("No valid price data");
  } catch (err) {
    console.warn("Could not fetch SOL price:", err);
    // Retornar precio por defecto como último recurso
    return 245; // Precio aproximado (debería venir de config)
  }
}
