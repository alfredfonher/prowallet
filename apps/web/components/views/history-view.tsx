"use client";

import { useState, useEffect, useCallback } from "react";
import { useToken } from "@/components/token-provider";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import { formatNumber, formatDate } from "@/lib/token-store";
import {
  ShoppingCart,
  AlertCircle,
  Filter,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
} from "lucide-react";

type FilterType = "ALL" | "completed" | "pending" | "failed" | "processing";

interface HistoryTransaction {
  id: number;
  email: string;
  type: string;
  amountTokens: number;
  amountUsd: number;
  priceAtTx: number;
  status: string;
  createdAt: string;
}

export function HistoryView() {
  const { tokenInfo } = useToken();
  const { user } = useAuth();
  const [transactionHistory, setTransactionHistory] = useState<
    HistoryTransaction[]
  >([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!user) return;

    setIsLoadingHistory(true);
    setError(null);

    try {
      const response = await apiClient.get<any>(`/exchange/history`);
      if (response?.extra?.transactions) {
        setTransactionHistory(response.extra.transactions);
      }
    } catch (err: any) {
      const errorMsg = err.message || "Error al obtener historial";
      setError(errorMsg);
      console.error("Failed to fetch history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user, fetchHistory]);

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchHistory();
    }, 30000);

    return () => clearInterval(interval);
  }, [user, fetchHistory]);

  // Protección: Usuario no autenticado
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900">
                ⚠️ Autenticación Requerida
              </h3>
              <p className="mt-2 text-sm text-amber-800">
                Necesitas iniciar sesión para ver tu historial de transacciones.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoadingHistory && transactionHistory.length === 0) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-48 rounded bg-secondary animate-pulse" />
        <div className="overflow-hidden rounded-xl border border-border bg-card p-6">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 bg-secondary/50 rounded animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-500 mt-0.5" />
          <div>
            <p className="font-semibold text-rose-900">Error</p>
            <p className="text-sm text-rose-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const filteredTransactions = transactionHistory.filter((tx) => {
    if (filter === "ALL") return true;
    return tx.status === filter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Historial</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredTransactions.length} transacción(es)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchHistory}
            disabled={isLoadingHistory}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 disabled:opacity-50 transition-colors"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoadingHistory ? "animate-spin" : ""}`}
            />
            Actualizar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(["ALL", "completed", "pending", "failed"] as FilterType[]).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary hover:bg-secondary/80 text-foreground"
              }`}
            >
              {f === "ALL"
                ? "Todas"
                : f === "completed"
                  ? "Completadas"
                  : f === "pending"
                    ? "Pendientes"
                    : "Fallidas"}
            </button>
          ),
        )}
      </div>

      {/* Transactions Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="p-6 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No hay transacciones para mostrar
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    Cantidad
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    USD
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-foreground">
                      <span className="capitalize">{tx.type}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {formatNumber(Number(tx.amountTokens) / 1e9)} GAPC
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      ${formatNumber(tx.amountUsd, 2)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          tx.status === "completed"
                            ? "bg-green-500/10 text-green-700 dark:text-green-400"
                            : tx.status === "pending"
                              ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                              : "bg-red-500/10 text-red-700 dark:text-red-400"
                        }`}
                      >
                        {tx.status === "completed" && (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        {tx.status === "pending" && (
                          <Clock className="h-3 w-3" />
                        )}
                        {tx.status === "failed" && (
                          <XCircle className="h-3 w-3" />
                        )}
                        {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {formatDate(new Date(tx.createdAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
