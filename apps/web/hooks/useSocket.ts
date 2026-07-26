"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { API_BASE_URL } from "@/lib/api-client";

type SocketLike = {
  connected: boolean;
  id?: string;
  emit: (event: string, ...args: any[]) => void;
  on: (event: string, listener: (...args: any[]) => void) => void;
  off: (event: string, listener: (...args: any[]) => void) => void;
  removeAllListeners: () => void;
  disconnect: () => void;
};

interface SocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

interface UseSocketReturn {
  socket: SocketLike | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  joinPurchase: (purchaseId: string) => void;
  leavePurchase: (purchaseId: string) => void;
  disconnect: () => void;
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<SocketLike | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [socketState, setSocketState] = useState<SocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
  });

  const updateSocketState = useCallback((updates: Partial<SocketState>) => {
    setSocketState((prev: SocketState) => ({ ...prev, ...updates }));
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      try {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        console.log("[useSocket] Manually disconnected");
      } catch (error) {
        console.warn("[useSocket] Error during disconnect:", error);
      } finally {
        socketRef.current = null;
        updateSocketState({
          isConnected: false,
          isConnecting: false,
          error: null,
        });
      }
    }
  }, [updateSocketState]);

  const joinPurchase = useCallback(
    (purchaseId: string) => {
      if (socketRef.current?.connected) {
        try {
          socketRef.current.emit("join:purchase", purchaseId);
          console.log("[useSocket] Joined purchase:", purchaseId);
        } catch (error) {
          console.error("[useSocket] Failed to join purchase:", error);
          updateSocketState({
            error: "Failed to join purchase room",
          });
        }
      } else {
        console.warn("[useSocket] Cannot join purchase: socket not connected");
        updateSocketState({ error: "Socket not connected" });
      }
    },
    [updateSocketState],
  );

  const leavePurchase = useCallback((purchaseId: string) => {
    if (socketRef.current?.connected) {
      try {
        socketRef.current.emit("leave:purchase", purchaseId);
        console.log("[useSocket] Left purchase:", purchaseId);
      } catch (error) {
        console.error("[useSocket] Failed to leave purchase:", error);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let isComponentMounted = true;
    let socketInstance: SocketLike | null = null;

    const initializeSocket = async () => {
      if (!isComponentMounted) return;

      updateSocketState({ isConnecting: true, error: null });

      try {
        // Clear any existing connection timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }

        // Dynamic import to avoid SSR issues
        // Dynamic import to avoid SSR issues - commented out until dependency is installed
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        // const { default: io } = await import("socket.io-client");

        // Temporary fallback until socket.io-client is properly installed
        const createSocket = (): SocketLike => ({
          connected: false,
          on: () => {},
          off: () => {},
          emit: () => {},
          removeAllListeners: () => {},
          disconnect: () => {},
        });

        if (!isComponentMounted) return;

        const baseUrl = (
          API_BASE_URL || "https://servicioshilda.orioncaribe.com/"
        ).replace(/\/api\/v1\/?$/, "");
        const socketUrl = baseUrl || window.location.origin;

        socketInstance = createSocket();

        socketRef.current = socketInstance;

        // Connection event handlers
        if (socketInstance) {
          socketInstance.on("connect", () => {
            console.log("[useSocket] Connected:", socketInstance?.id);
            if (isComponentMounted) {
              updateSocketState({
                isConnected: true,
                isConnecting: false,
                error: null,
              });
            }
          });

          socketInstance.on("disconnect", (reason: string) => {
            console.log("[useSocket] Disconnected:", reason);
            if (isComponentMounted) {
              updateSocketState({
                isConnected: false,
                isConnecting: false,
                error: `Disconnected: ${reason}`,
              });
            }
          });

          socketInstance.on("connect_error", (error: any) => {
            console.error("[useSocket] Connection error:", error);
            if (isComponentMounted) {
              updateSocketState({
                isConnected: false,
                isConnecting: false,
                error: `Connection failed: ${error?.message || "Unknown error"}`,
              });
            }
          });

          socketInstance.on("reconnect", (attemptNumber: number) => {
            console.log(
              "[useSocket] Reconnected after",
              attemptNumber,
              "attempts",
            );
            if (isComponentMounted) {
              updateSocketState({
                isConnected: true,
                isConnecting: false,
                error: null,
              });
            }
          });

          socketInstance.on("reconnect_error", (error: any) => {
            console.error("[useSocket] Reconnection error:", error);
            if (isComponentMounted) {
              updateSocketState({
                error: `Reconnection failed: ${error?.message || "Unknown error"}`,
              });
            }
          });
        }
      } catch (error) {
        console.error("[useSocket] Socket initialization failed:", error);
        if (isComponentMounted) {
          updateSocketState({
            isConnected: false,
            isConnecting: false,
            error: `Socket initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }
    };

    // Set connection timeout
    connectionTimeoutRef.current = setTimeout(() => {
      if (isComponentMounted && socketState.isConnecting) {
        updateSocketState({
          isConnecting: false,
          error: "Connection timeout",
        });
      }
    }, 15000);

    initializeSocket();

    return () => {
      isComponentMounted = false;

      // Clear connection timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }

      // Properly disconnect socket
      if (socketInstance) {
        try {
          socketInstance.removeAllListeners();
          socketInstance.disconnect();
        } catch (error) {
          console.warn("[useSocket] Error during cleanup:", error);
        }
      }

      socketRef.current = null;
    };
  }, [updateSocketState, socketState.isConnecting]);

  return {
    socket: socketRef.current,
    isConnected: socketState.isConnected,
    isConnecting: socketState.isConnecting,
    error: socketState.error,
    joinPurchase,
    leavePurchase,
    disconnect,
  };
}

export default useSocket;
