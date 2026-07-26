// lib/transaction-signer.ts
import bs58 from "bs58";

export interface TransactionSignRequest {
  type: "BUY" | "SELL" | "TRANSFER";
  walletAddress: string;
  amount: number;
  recipient?: string; // Para TRANSFER
  tokenAmount?: number;
  timestamp: number;
}

export interface SignedTransaction {
  transactionData: TransactionSignRequest;
  signature: string;
  publicKey: string;
  signedAt: string;
  walletType: string; // Phantom, Solflare, Magic Eden, etc
}

export class TransactionSigner {
  /**
   * Obtiene todos los proveedores de wallet disponibles
   */
  private getAvailableWallets(): Array<{
    name: string;
    provider: any;
  }> {
    const wallets: Array<{ name: string; provider: any }> = [];

    // Phantom
    if ((window as any).phantom?.solana) {
      wallets.push({
        name: "Phantom",
        provider: (window as any).phantom.solana,
      });
    }

    // Solflare
    if ((window as any).solflare) {
      wallets.push({
        name: "Solflare",
        provider: (window as any).solflare,
      });
    }

    // Magic Eden
    if ((window as any).magicEden?.solana) {
      wallets.push({
        name: "Magic Eden",
        provider: (window as any).magicEden.solana,
      });
    }

    // Brave Wallet
    if ((window as any).brave?.solana) {
      wallets.push({
        name: "Brave Wallet",
        provider: (window as any).brave.solana,
      });
    }

    // Slope
    if ((window as any).slope) {
      wallets.push({
        name: "Slope",
        provider: (window as any).slope,
      });
    }

    // Coin98
    if ((window as any).coin98?.solana) {
      wallets.push({
        name: "Coin98",
        provider: (window as any).coin98.solana,
      });
    }

    // Ledger Live
    if ((window as any).ledger?.solana) {
      wallets.push({
        name: "Ledger Live",
        provider: (window as any).ledger.solana,
      });
    }

    return wallets;
  }

  /**
   * Solicita que la wallet conectada firme una transacción
   * Abre el modal nativo de la wallet para confirmación
   */
  async signTransaction(
    request: TransactionSignRequest,
  ): Promise<SignedTransaction> {
    // Obtener wallets disponibles
    const availableWallets = this.getAvailableWallets();

    if (availableWallets.length === 0) {
      throw new Error(
        "❌ No hay wallets de Solana instaladas. Por favor instala Phantom, Solflare, Magic Eden o cualquier otra wallet compatible.",
      );
    }

    // Usar la primera wallet conectada
    let provider = availableWallets[0].provider;
    let walletName = availableWallets[0].name;

    // Buscar la wallet conectada (si hay múltiples)
    for (const wallet of availableWallets) {
      if (wallet.provider.publicKey) {
        provider = wallet.provider;
        walletName = wallet.name;
        break;
      }
    }

    if (!provider) {
      throw new Error(
        "❌ No hay wallets conectadas. Por favor conecta tu wallet primero.",
      );
    }

    // Verificar que está conectado
    if (!provider.publicKey) {
      throw new Error(
        `❌ ${walletName} no está conectado. Por favor conecta tu wallet.`,
      );
    }

    const publicKey = provider.publicKey.toString();

    // Validar que el publicKey coincide con el walletAddress
    if (publicKey !== request.walletAddress) {
      throw new Error(
        `❌ La wallet conectada (${publicKey.slice(0, 8)}...) no coincide con la wallet de la transacción.`,
      );
    }

    // Crear el mensaje a firmar con datos de la transacción
    const transactionMessage = this.createTransactionMessage(request);
    const encoded = new TextEncoder().encode(transactionMessage);

    console.log(`📝 Solicitando firma a ${walletName}...`);
    console.log(`   Tipo: ${request.type}`);
    console.log(`   Monto: ${request.amount}`);
    console.log(`   Wallet: ${publicKey}`);

    try {
      // Solicitar firma - Esto abre el modal nativo de la wallet
      let signedData: any;

      // Intentar con signMessage (estándar en Solana)
      if (provider.signMessage && typeof provider.signMessage === "function") {
        try {
          signedData = await provider.signMessage(encoded, "utf8");
        } catch (e: any) {
          // Si signMessage falla, intentar con sign
          if (provider.sign && typeof provider.sign === "function") {
            signedData = await provider.sign(encoded);
          } else {
            throw e;
          }
        }
      }
      // Alternativa: usar sign
      else if (provider.sign && typeof provider.sign === "function") {
        signedData = await provider.sign(encoded);
      } else {
        throw new Error(`❌ ${walletName} no soporta firma de mensajes.`);
      }

      // Extraer la firma (diferentes wallets la retornan diferente)
      let signature: Uint8Array;

      if (signedData.signature) {
        // Phantom, Solflare, etc retornan { signature, publicKey }
        signature = signedData.signature;
      } else if (signedData.signedMessage) {
        // Algunos wallets retornan signedMessage
        signature = signedData.signedMessage;
      } else if (signedData instanceof Uint8Array) {
        // Algunos retornan directamente Uint8Array
        signature = signedData;
      } else if (Array.isArray(signedData)) {
        // Algunos retornan como array
        signature = new Uint8Array(signedData);
      } else {
        throw new Error("❌ No se pudo extraer la firma de la wallet");
      }

      // Convertir a Base58
      const signatureBase58 = bs58.encode(
        signature instanceof Uint8Array ? signature : new Uint8Array(signature),
      );

      console.log(`✅ Transacción firmada correctamente por ${walletName}`);
      console.log(`   Firma: ${signatureBase58.slice(0, 20)}...`);

      return {
        transactionData: request,
        signature: signatureBase58,
        publicKey,
        signedAt: new Date().toISOString(),
        walletType: walletName,
      };
    } catch (error: any) {
      // El usuario rechazó la firma
      if (
        error.message?.includes("rejected") ||
        error.message?.includes("User rejected") ||
        error.message?.includes("cancelled") ||
        error.code === 4001 // Standard JSON-RPC error code for user rejection
      ) {
        throw new Error(
          `❌ Rechazaste la solicitud de firma en ${walletName}. La transacción fue cancelada.`,
        );
      }

      throw new Error(
        `❌ Error al firmar la transacción con ${walletName}: ${error.message}`,
      );
    }
  }

  /**
   * Crea el mensaje que será firmado
   */
  private createTransactionMessage(request: TransactionSignRequest): string {
    const timestamp = new Date(request.timestamp).toISOString();

    let message = "";

    switch (request.type) {
      case "BUY":
        message = `PROWALLET_BUY_TRANSACTION
Wallet: ${request.walletAddress}
Amount: ${request.amount} SOL
Timestamp: ${timestamp}
Action: Compra de tokens ProWallet
Network: Solana`;
        break;

      case "SELL":
        message = `PROWALLET_SELL_TRANSACTION
Wallet: ${request.walletAddress}
Amount: ${request.tokenAmount} GAPC
Timestamp: ${timestamp}
Action: Venta de tokens ProWallet
Network: Solana`;
        break;

      case "TRANSFER":
        message = `PROWALLET_TRANSFER_TRANSACTION
From: ${request.walletAddress}
To: ${request.recipient}
Amount: ${request.tokenAmount} GAPC
Timestamp: ${timestamp}
Action: Transferencia de tokens ProWallet
Network: Solana`;
        break;
    }

    return message;
  }

  /**
   * Obtiene el proveedor de wallet
   */
  private async getWalletProvider(): Promise<any> {
    // Esperar a que al menos una wallet esté disponible (máximo 5 segundos)
    const maxAttempts = 50; // 50 * 100ms = 5 segundos
    let attempts = 0;

    while (attempts < maxAttempts) {
      const wallets = this.getAvailableWallets();
      if (wallets.length > 0) {
        return wallets[0].provider;
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return null;
  }

  /**
   * Verifica que la firma es válida
   */
  verifySignature(signed: SignedTransaction): boolean {
    if (!signed.signature || signed.signature.length === 0) {
      return false;
    }

    if (!signed.publicKey || signed.publicKey.length === 0) {
      return false;
    }

    if (!signed.transactionData) {
      return false;
    }

    if (!signed.walletType || signed.walletType.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Obtiene la lista de wallets disponibles (para debugging)
   */
  getInstalledWallets(): string[] {
    return this.getAvailableWallets().map((w) => w.name);
  }
}

// Instancia singleton
export const transactionSigner = new TransactionSigner();
