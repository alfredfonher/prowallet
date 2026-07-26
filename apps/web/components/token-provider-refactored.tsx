"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useSocket } from "../hooks/useSocket";
import { apiClient, API_BASE_URL } from "../lib/api-client";

// Define types locally to avoid import issues
interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  supply: string;
  currentPrice: number;
  lastUpdated: number;
}

interface Transaction {
  id: string;
  type: "BUY" | "SELL" | "TRANSFER";
  amount: number;
  price: number;
  timestamp: number;
  signature: string;
  status: "pending" | "confirmed" | "failed";
}

const initialTokenInfo: TokenInfo = {
  symbol: "PRO",
  name: "ProWallet",
  decimals: 9,
  supply: "0",
  currentPrice: 0,
  lastUpdated: Date.now(),
};

const initialTransactions: Transaction[] = [];

// Mock auth hook for now
const useAuth = () => ({
  user: null,
  publicKey: null,
});

// Contexts for separation of concerns
const TokenInfoContext = createContext<{
  tokenInfo: TokenInfo;
  setTokenInfo: (info: TokenInfo) => void;
  refreshPrice: () => Promise<void>;
  loading: boolean;
} | null>(null);

const TransactionContext = createContext<{
  transactions: Transaction[];
  addTransaction: (tx: Transaction) => void;
  clearTransactions: () => void;
  loading: boolean;
} | null>(null);

const RealtimeContext = createContext<{
  isConnected: boolean;
  lastUpdate: number;
  forceUpdate: () => void;
} | null>(null);

// Main provider component
export function TokenProvider({ children }: { children: ReactNode }) {
  const { user, publicKey } = useAuth();
  const socket = useSocket();

  // Token info state
  const [tokenInfo, setTokenInfo] = useState<TokenInfo>(initialTokenInfo);
  const [priceLoading, setPriceLoading] = useState(false);

  // Transaction state
  const [transactions, setTransactions] =
    useState<Transaction[]>(initialTransactions);
  const [transactionLoading, setTransactionLoading] = useState(false);

  // Realtime state
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // Price refresh logic
  const refreshPrice = async () => {
    if (!publicKey) return;

    setPriceLoading(true);
    try {
      // Mock price fetch for now
      const price = Math.random() * 100 + 50; // Random price between 50-150
      setTokenInfo((prev: TokenInfo) => ({
        ...prev,
        currentPrice: price,
        lastUpdated: Date.now(),
      }));
    } catch (error) {
      console.error("Failed to refresh price:", error);
    } finally {
      setPriceLoading(false);
    }
  };

  // Transaction management
  const addTransaction = (tx: Transaction) => {
    setTransactions((prev: Transaction[]) => [tx, ...prev]);
    setLastUpdate(Date.now());
  };

  const clearTransactions = () => {
    setTransactions([]);
  };

  // Force update
  const forceUpdate = () => {
    setLastUpdate(Date.now());
    refreshPrice();
  };

  // Socket connection management
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handlePriceUpdate = (newPrice: number) => {
      setTokenInfo((prev: TokenInfo) => ({
        ...prev,
        currentPrice: newPrice,
        lastUpdated: Date.now(),
      }));
    };

    socket.socket?.on("connect", handleConnect);
    socket.socket?.on("disconnect", handleDisconnect);
    socket.socket?.on("price-update", handlePriceUpdate);

    return () => {
      socket.socket?.off("connect", handleConnect);
      socket.socket?.off("disconnect", handleDisconnect);
      socket.socket?.off("price-update", handlePriceUpdate);
    };
  }, [socket]);

  // Initial data fetch
  useEffect(() => {
    if (user && publicKey) {
      refreshPrice();
      // Fetch initial transactions
      setTransactionLoading(true);
      apiClient
        .getTransactions(publicKey)
        .then((data: any) => {
          if (Array.isArray(data)) {
            setTransactions(data);
          }
        })
        .catch(console.error)
        .finally(() => setTransactionLoading(false));
    }
  }, [user, publicKey]);

  return (
    <TokenInfoContext.Provider
      value={{
        tokenInfo,
        setTokenInfo,
        refreshPrice,
        loading: priceLoading,
      }}
    >
      <TransactionContext.Provider
        value={{
          transactions,
          addTransaction,
          clearTransactions,
          loading: transactionLoading,
        }}
      >
        <RealtimeContext.Provider
          value={{
            isConnected,
            lastUpdate,
            forceUpdate,
          }}
        >
          {children}
        </RealtimeContext.Provider>
      </TransactionContext.Provider>
    </TokenInfoContext.Provider>
  );
}

// Custom hooks for consuming contexts
export function useTokenInfo() {
  const context = useContext(TokenInfoContext);
  if (!context) {
    throw new Error("useTokenInfo must be used within TokenProvider");
  }
  return context;
}

export function useTransactions() {
  const context = useContext(TransactionContext);
  if (!context) {
    throw new Error("useTransactions must be used within TokenProvider");
  }
  return context;
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtime must be used within TokenProvider");
  }
  return context;
}

// Legacy export for backward compatibility
export function useToken() {
  const tokenInfo = useTokenInfo();
  const transactions = useTransactions();

  return {
    ...tokenInfo,
    transactions: transactions.transactions,
    addTransaction: transactions.addTransaction,
    clearTransactions: transactions.clearTransactions,
  };
}
