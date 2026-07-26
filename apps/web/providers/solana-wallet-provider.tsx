import React from "react";

/**
 * Simple Solana Wallet Provider
 * Detects Phantom/Solflare wallet sin necesidad de instalar wallet-adapter
 * Funciona con la API nativa de Solana wallets
 */

export interface SolanaWallet {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  signTransaction(transaction: any): Promise<any>;
  signAllTransactions?(transactions: any[]): Promise<any[]>;
  publicKey: {
    toString(): string;
  } | null;
  isConnected: boolean;
}

interface WalletContextType {
  wallet: SolanaWallet | null;
  is_connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const WalletContext = React.createContext<WalletContextType | undefined>(
  undefined,
);

export function SolanaWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [wallet, set_wallet] = React.useState<SolanaWallet | null>(null);
  const [is_connected, set_is_connected] = React.useState(false);

  React.useEffect(() => {
    // Detect Phantom or Solflare wallet
    const detected_wallet = (window as any).solana || (window as any).soflare;

    if (detected_wallet) {
      set_wallet(detected_wallet);
      set_is_connected(detected_wallet.isConnected || false);

      // Listen for wallet changes
      const handle_connect = () => set_is_connected(true);
      const handle_disconnect = () => set_is_connected(false);

      detected_wallet.on?.("connect", handle_connect);
      detected_wallet.on?.("disconnect", handle_disconnect);

      return () => {
        detected_wallet.off?.("connect", handle_connect);
        detected_wallet.off?.("disconnect", handle_disconnect);
      };
    }
  }, []);

  const connect = React.useCallback(async () => {
    if (!wallet) {
      throw new Error("Solana wallet not found");
    }

    try {
      await wallet.connect();
      set_is_connected(true);
    } catch (err) {
      set_is_connected(false);
      throw err;
    }
  }, [wallet]);

  const disconnect = React.useCallback(async () => {
    if (!wallet) return;

    try {
      await wallet.disconnect?.();
      set_is_connected(false);
    } catch (err) {
      console.error("Error disconnecting wallet:", err);
    }
  }, [wallet]);

  return (
    <WalletContext.Provider
      value={{
        wallet,
        is_connected,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function use_solana_wallet() {
  const context = React.useContext(WalletContext);

  if (!context) {
    throw new Error(
      "use_solana_wallet must be used within SolanaWalletProvider",
    );
  }

  return context;
}
