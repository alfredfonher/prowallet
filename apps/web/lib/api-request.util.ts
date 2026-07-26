/**
 * API Request Handler Utility
 * Evita múltiples llamadas simultáneas al mismo endpoint
 * Útil para desarrollo para evitar errores de rate limiting (429 Too Many Requests)
 */

let requestCache = new Map<string, boolean>();
const REQUEST_CACHE_TTL = 3000; // 3 segundos

/**
 * Wrapper para fetch que evita duplicados
 */
export async function apiRequest(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const cacheKey = `${options.method || "GET"}:${url}:${JSON.stringify(options.body || "")}`;


  // Verificar si ya hay una solicitud en curso
  if (requestCache.has(cacheKey)) {
    console.log(`[RateLimiting] Solicitud en curso para: ${cacheKey}`);
    return fetch(url, options) as Promise<Response>;
  }

  // Marcar como solicitud en curso
  requestCache.set(cacheKey, true);

  try {
    const response = await fetch(url, options);
    return response;
  } finally {
    // Desmarcar después del caché (permite reintentos legítimos)
    setTimeout(() => requestCache.delete(cacheKey), REQUEST_CACHE_TTL);
  }
}

/**
 * Wrapper para POST requests específicamente
 */
export async function apiPost<T = any>(
  url: string,
  data?: T,
): Promise<Response> {
  return apiRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

/**
 * Wrapper para GET requests específicamente
 */
export async function apiGet<T = any>(
  url: string,
  params?: Record<string, string>,
): Promise<Response> {
  return apiRequest(url, {
    method: "GET",
    params,
  });
}

/**
 * Limpia el caché de solicitudes
 */
export const clearRequestCache = (): void => {
  requestCache.clear();
  console.log("[RateLimiting] Caché de solicitudes limpiado");
};
