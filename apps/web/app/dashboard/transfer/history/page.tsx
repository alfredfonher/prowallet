"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  ArrowRight,
  Loader,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useWallet } from "@/lib/use-wallet";
import { apiClient } from "@/lib/api-client";

interface Transfer {
  id: string;
  transactionId: string;
  signature: string;
  status: "pending" | "success" | "failed";
  amount: number;
  createdAt: string;
  metadata?: {
    fromWallet: string;
    toWallet: string;
    amount: number;
  };
}

interface PaginationData {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export default function TransferHistoryPage() {
  const { user } = useAuth();
  const walletAddress = useWallet();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 10;

  const addressToFetch = walletAddress || user?.walletAddress;

  useEffect(() => {
    const fetchTransfers = async () => {
      if (!addressToFetch) {
        setError("No wallet connected");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await apiClient.get(
          `/transfer/history/${addressToFetch}?limit=${limit}&offset=${offset}`,
        );

        if (response.extra) {
          setTransfers(response.extra.transfers || []);
          setPagination(response.extra.pagination);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch transfer history",
        );
        setTransfers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTransfers();
  }, [addressToFetch, offset]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "pending":
        return <Clock className="h-5 w-5 text-amber-600" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "success":
        return "Completado";
      case "failed":
        return "Fallido";
      case "pending":
        return "Pendiente";
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncateAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(
      address.length - 4,
    )}`;
  };

  if (loading && transfers.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4 lg:p-8">
        <div className="flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Cargando historial...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Historial de Transferencias</h1>
            <p className="text-muted-foreground mt-1">
              {pagination?.total || 0} transferencias registradas
            </p>
          </div>
          <Link
            href="/dashboard/transfer"
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
          >
            Nueva Transferencia
          </Link>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Transfers List */}
        {transfers.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground mb-4">
              No hay transferencias registradas aún
            </p>
            <Link
              href="/dashboard/transfer"
              className="inline-block px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
            >
              Hacer tu primera transferencia
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {transfers.map((transfer) => (
              <Link
                key={transfer.id}
                href={`/dashboard/transfer/transaction/${transfer.id}`}
              >
                <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-card/80 transition-colors cursor-pointer">
                  {/* Status & Amount */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-shrink-0">
                      {getStatusIcon(transfer.status)}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-foreground">
                        {transfer.amount.toFixed(4)} GAPC
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <span>
                          {truncateAddress(transfer.metadata?.fromWallet || "")}
                        </span>
                        <ArrowRight className="h-4 w-4" />
                        <span>
                          {truncateAddress(transfer.metadata?.toWallet || "")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Date & Status */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(transfer.createdAt)}
                      </div>
                      <div className="text-xs font-medium mt-1">
                        {getStatusLabel(transfer.status)}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.total > limit && (
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="px-4 py-2 rounded-lg border border-border hover:bg-secondary disabled:opacity-50"
            >
              ← Anterior
            </button>
            <span className="text-sm text-muted-foreground">
              {offset + 1} - {Math.min(offset + limit, pagination.total)} de{" "}
              {pagination.total}
            </span>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={!pagination.hasMore}
              className="px-4 py-2 rounded-lg border border-border hover:bg-secondary disabled:opacity-50"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
