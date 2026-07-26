/**
 * Utilidades para obtener balance de SOL
 */

/**
 * Obtiene el balance de SOL de una wallet desde la API del backend
 *
 * @param wallet_address - Dirección pública de la wallet
 * @param api_url - URL base de la API (opcional, usa variable de entorno por defecto)
 * @returns Balance en SOL, o null si hay error
 *
 * @example
 * const balance = await fetch_sol_balance('7KLd2Cx....');
 * console.log(balance); // 1.5
 */
export async function fetch_sol_balance(
  wallet_address: string,
  api_url?: string,
): Promise<number | null> {
  try {
    // Usar URL proporcionada o variable de entorno
    const base_url =
      api_url ||
      process.env.NEXT_PUBLIC_API_URL ||
      "https://servicioshilda.orioncaribe.com/api/v1";

    if (!api_url && !process.env.NEXT_PUBLIC_API_URL) {
      console.warn("⚠️ NEXT_PUBLIC_API_URL no configurada, usando fallback");
    }

    const response = await fetch(
      `${base_url}/exchange/getBalance/${wallet_address}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
    );

    if (response.ok) {
      const data = await response.json();
      const balance = data?.extra?.balance;

      if (balance !== undefined && balance !== null) {
        console.log("✅ Balance desde API:", balance, "SOL");
        return balance;
      }
    }

    console.error("⚠️ API devolvió datos de balance inválidos");
    return null;
  } catch (error) {
    console.error("❌ Error obteniendo balance de SOL:", error);
    return null;
  }
}
