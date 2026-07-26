import bs58 from "bs58";

export interface WalletProvider {
  publicKey: { toString(): string } | null;
  signMessage?: (message: Uint8Array, encoding: string) => Promise<any>;
  sign?: (message: Uint8Array) => Promise<any>;
  isConnected?: boolean;
  _selectedAccount?: any;
  request?: (params: { method: string; [key: string]: any }) => Promise<any>;
}

export interface WalletDetectionResult {
  name: string;
  provider: WalletProvider;
  public_key: string;
}

export interface WalletDetectionError {
  message: string;
  attempts: number;
}

// Mapa de wallets soportadas
const WALLET_ADAPTERS: Record<string, string> = {
  phantom: "phantom",
  solflare: "solflare",
  backpack: "backpack",
};

/**
 * Detecta y conecta a una wallet disponible en el navegador
 * Soporta: Phantom, Solflare, Backpack
 */
export const detect_wallet = async (): Promise<WalletDetectionResult> => {
  const max_attempts = 15;
  const delay_ms = 100;

  for (let attempt = 0; attempt < max_attempts; attempt++) {
    // Buscar wallets disponibles
    for (const [wallet_name, _] of Object.entries(WALLET_ADAPTERS)) {
      const provider = (window as any)[wallet_name];

      if (!provider) continue;

      // Intentar conectar
      try {
        // Algunos proveedores requieren request() para conectar
        if (provider.request && typeof provider.request === "function") {
          try {
            await provider.request({
              method: "connect",
            });
          } catch {
            // Ignorar si request falla, podría ya estar conectado
          }
        }

        // Validar que está conectado
        if (!provider.publicKey || !provider.isConnected) {
          continue;
        }

        const public_key = provider.publicKey.toString();
        if (!public_key) continue;

        return {
          name: wallet_name,
          provider,
          public_key,
        };
      } catch (error) {
        // Continuar a siguiente wallet
        continue;
      }
    }

    // Si no encontró wallet, esperar y reintentar
    if (attempt < max_attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delay_ms));
    }
  }

  throw new Error(
    `No wallet detected after ${max_attempts} attempts. Please install Phantom, Solflare, or Backpack.`,
  );
};

/**
 * Firma un mensaje con la wallet del usuario
 */
export const sign_message = async (
  provider: WalletProvider,
  message: string,
): Promise<string> => {
  const encoded = new TextEncoder().encode(message);

  let signed: any;

  // Intentar con signMessage (estándar moderno)
  if (provider.signMessage && typeof provider.signMessage === "function") {
    try {
      signed = await provider.signMessage(encoded, "utf8");
    } catch (error) {
      // Fallback a sign() si signMessage falla
      if (provider.sign && typeof provider.sign === "function") {
        signed = await provider.sign(encoded);
      } else {
        throw error;
      }
    }
  } else if (provider.sign && typeof provider.sign === "function") {
    signed = await provider.sign(encoded);
  } else {
    throw new Error("Wallet does not support message signing");
  }

  // Convertir firma a base58
  const signature_bytes =
    signed.signature instanceof Uint8Array
      ? signed.signature
      : new Uint8Array(signed.signature || signed);

  return bs58.encode(signature_bytes);
};

/**
 * Desconecta la wallet actual
 * (Algunos proveedores permiten desconexión)
 */
export const disconnect_wallet = async (provider: WalletProvider) => {
  try {
    // Intentar request disconnect
    if (provider.request && typeof provider.request === "function") {
      await provider.request({
        method: "disconnect",
      });
    }
  } catch {
    // Ignorar si falla
  }

  // Limpiar referencia local
  if (provider.publicKey) {
    provider.publicKey = null;
  }
  if ((provider as any)._selectedAccount) {
    (provider as any)._selectedAccount = null;
  }
};
