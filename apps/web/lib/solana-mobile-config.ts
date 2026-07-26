/**
 * Stub para soporte mobile de wallets en devnet MVP.
 * Implementación completa futura: deep links, detección de plataforma, etc.
 */

/**
 * Detecta si el dispositivo es móvil
 * @returns true si es dispositivo móvil
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

/**
 * Detecta si el dispositivo es Android
 * @returns true si es Android
 */
export function isAndroidDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/**
 * Detecta si el dispositivo es iOS
 * @returns true si es iOS
 */
export function isIOSDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Genera deep link para Phantom en Android
 * @param redirect_url - URL de retorno
 * @returns deep link URL
 */
export function generatePhantomDeepLink(redirect_url: string): string {
  return `https://phantom.app/ul/browse/${encodeURIComponent(redirect_url)}`;
}

/**
 * Genera deep link para Phantom en iOS
 * @param redirect_url - URL de retorno
 * @returns deep link URL
 */
export function generatePhantomIOSDeepLink(redirect_url: string): string {
  return `phantom://browse/${encodeURIComponent(redirect_url)}`;
}

/**
 * Genera deep link para Backpack
 * @param redirect_url - URL de retorno
 * @returns deep link URL
 */
export function generateBackpackDeepLink(redirect_url: string): string {
  return `backpack://browse/${encodeURIComponent(redirect_url)}`;
}

/**
 * Genera deep link para Solflare
 * @param redirect_url - URL de retorno
 * @returns deep link URL
 */
export function generateSolflareDeepLink(redirect_url: string): string {
  return `solflare://browse/${encodeURIComponent(redirect_url)}`;
}

/**
 * Guarda un intento de conexión a wallet en sessionStorage
 * @param wallet_name - Nombre de la wallet
 */
export function saveConnectionAttempt(wallet_name: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    `wallet_connect_${wallet_name}`,
    JSON.stringify({ timestamp: Date.now(), wallet: wallet_name }),
  );
}

/**
 * Obtiene un intento de conexión previo
 * @param wallet_name - Nombre de la wallet
 * @returns datos del intento o null
 */
export function getConnectionAttempt(
  wallet_name: string,
): { timestamp: number; wallet: string } | null {
  if (typeof window === "undefined") return null;
  const data = sessionStorage.getItem(`wallet_connect_${wallet_name}`);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Limpia todos los intentos de conexión guardados
 */
export function clearConnectionAttempts(): void {
  if (typeof window === "undefined") return;
  const keys = Object.keys(sessionStorage).filter((k) =>
    k.startsWith("wallet_connect_"),
  );
  keys.forEach((k) => sessionStorage.removeItem(k));
}

/**
 * Obtiene el scheme de URL para wallets en iOS
 * @param wallet_name - Nombre de la wallet
 * @returns scheme URL o null si no soportada
 */
export function getIOSWalletScheme(wallet_name: string): string | null {
  const schemes: Record<string, string> = {
    Phantom: "phantom://",
    Backpack: "backpack://",
    Solflare: "solflare://",
  };
  return schemes[wallet_name] || null;
}
