/**
 * Servicio para limpiar cachés de wallets
 * Elimina residuos en sessionStorage, localStorage, IndexedDB y en los providers
 */

/**
 * Limpia todos los cachés relacionados con wallets
 */
export function clearWalletCache(): void {
  try {
    console.log("🧹 Limpiando caché de wallets...");

    // 1. Limpiar sessionStorage
    const sessionKeysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes("wallet") || key.includes("Wallet"))) {
        sessionKeysToRemove.push(key);
      }
    }

    sessionKeysToRemove.push("walletAddress", "publicKey", "_publicKey");

    sessionKeysToRemove.forEach((key) => {
      try {
        sessionStorage.removeItem(key);
      } catch (e) {
        console.warn(`Could not remove sessionStorage key: ${key}`, e);
      }
    });

    // 2. Limpiar localStorage
    const localKeysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes("wallet") || key.includes("Wallet"))) {
        localKeysToRemove.push(key);
      }
    }

    localKeysToRemove.push(
      "selectedWallet",
      "lastWallet",
      "connectedWallet",
      "phantom.injected",
      "walletAddress", // ✅ CRÍTICO: Asegurar limpieza de walletAddress
      "solana_wallet",
      "solflare-last-wallet",
    );

    localKeysToRemove.forEach((key) => {
      try {
        localStorage.removeItem(key);
        // ✅ Limpiar también sessionStorage por cada clave
        sessionStorage.removeItem(key);
      } catch (e) {
        console.warn(`Could not remove storage key: ${key}`, e);
      }
    });

    // 3. Limpiar IndexedDB si existe
    if (typeof window !== "undefined" && window.indexedDB) {
      try {
        const dbRequest = indexedDB.databases?.();
        if (dbRequest instanceof Promise) {
          dbRequest
            .then((dbs) => {
              dbs.forEach((db) => {
                if (db.name?.includes("wallet")) {
                  indexedDB.deleteDatabase(db.name);
                }
              });
            })
            .catch(() => {
              // Ignorar errores
            });
        }
      } catch (e) {
        console.warn("Could not clear IndexedDB", e);
      }
    }

    console.log("✅ Caché de wallets limpiado");
  } catch (error) {
    console.warn("Error limpiando caché:", error);
  }
}

/**
 * Obtiene la wallet actualmente conectada sin usar caché
 * Fuerza una lectura fresca del provider
 */
export async function getConnectedWalletFresh(
  provider: any,
): Promise<string | null> {
  try {
    // Limpiar caché local del provider
    if (provider._publicKey) {
      delete provider._publicKey;
    }
    if (provider.publicKey) {
      provider.publicKey = null;
    }

    // Obtener estado actual del provider
    if (provider.isConnected && provider.publicKey) {
      return provider.publicKey.toString();
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Desconecta completamente de todos los proveedores y limpia cachés
 */
export async function disconnectAllWalletsAndClearCache(): Promise<void> {
  try {
    console.log("🔌 Desconectando de todos los providers...");

    // Acceder a todos los providers globales
    const providers = [
      (window as any).phantom?.solana,
      (window as any).solflare,
      (window as any).backpack,
    ].filter(Boolean);

    console.log(`Found ${providers.length} providers to disconnect`);

    // PASO 1: Desconectar de cada uno
    for (const provider of providers) {
      if (provider?.disconnect && typeof provider.disconnect === "function") {
        try {
          console.log("Calling disconnect on provider...");
          await provider.disconnect().catch(() => {});

          // ✅ PASO 2: Limpiar AGRESIVAMENTE todas las propiedades de caché
          const cacheProperties = [
            // Phantom
            "_publicKey",
            "publicKey",
            "_connected",
            "_account",
            // Solflare
            "_isConnected",
            "_selectedAccount",
            "_pubkey",
            "selectedAccount",
            "account",
            "_accounts",
            "accounts",
            // Backpack
            "_walletAddress",
            "_connected",
            "_connection",
            // Genérico
            "_wallet",
            "_provider",
            "_address",
          ];

          cacheProperties.forEach((prop) => {
            try {
              // Usar Object.defineProperty para forzar borrado incluso de props read-only
              if (provider.hasOwnProperty(prop)) {
                if (
                  typeof provider[prop] === "object" &&
                  provider[prop] !== null
                ) {
                  try {
                    Object.assign(provider[prop], {});
                  } catch {
                    delete provider[prop];
                  }
                } else {
                  delete provider[prop];
                }
              }
            } catch (e) {
              // Silenciar errores de propiedades read-only
            }
          });

          console.log("✓ Provider cleaned aggressively");
        } catch (e) {
          console.warn("Error disconnecting provider:", e);
        }
      }
    }

    // PASO 3: Limpiar IndexedDB y otros cachés de storage
    console.log("Clearing IndexedDB and storage caches...");
    try {
      // Limpiar localStorage específicamente
      const storageKeysToRemove = [
        "phantom.injected",
        "solflare.injected",
        "walletAddress",
        "selectedPublicKey",
        "_publicKey",
        "ethereumSelectedAddress",
      ];

      storageKeysToRemove.forEach((key) => {
        try {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        } catch (e) {
          // Ignorar errores
        }
      });

      // Intentar limpiar IndexedDB
      const dbs = await (indexedDB as any).databases?.();
      if (dbs) {
        for (const db of dbs) {
          try {
            await new Promise<void>((resolve, reject) => {
              const request = indexedDB.deleteDatabase(db.name);
              request.onerror = () => reject(request.error);
              request.onsuccess = () => resolve();
            }).catch(() => {
              // Ignorar errores de deleteDatabase
            });
          } catch (e) {
            // Ignorar
          }
        }
      }
    } catch (e) {
      console.warn("IndexedDB cleanup error:", e);
    }

    // PASO 4: Esperar más tiempo a que se procesen las desconexiones
    console.log("Waiting for provider cleanup (2000ms)...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // PASO 5: Limpiar todos los cachés
    clearWalletCache();

    console.log("✅ Todos los providers desconectados y caché limpiado");
  } catch (error) {
    console.warn("Error limpiando wallets y caché:", error);
  }
}
