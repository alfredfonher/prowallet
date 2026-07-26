"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  Copy,
  ExternalLink,
  Loader,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import {
  getNetworkConfig,
  isTestnet,
  getExplorerUrl,
} from "@/lib/network-config";

interface TransactionDetail {
  id: string;
  transactionId: string;
  signature: string;
  status: "pending" | "success" | "failed";
  amount: number;
  createdAt: string;
  metadata: {
    fromWallet: string;
    toWallet: string;
    amount: number;
    timestamp: string;
  };
}

export default function TransactionDetailsPage() {
  const params = useParams();
  const txId = params.id as string;
  const [transaction, setTransaction] = useState<TransactionDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransaction = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch transaction by ID
        const response = await apiClient.get(`/transfer/${txId}`);

        if (response.success && response.data) {
          setTransaction(response.data);
        } else {
          setError("Failed to load transaction details");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load transaction",
        );
      } finally {
        setLoading(false);
      }
    };

    if (txId) {
      fetchTransaction();
    }
  }, [txId]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "success":
        return "✅ Completado";
      case "failed":
        return "❌ Fallido";
      case "pending":
        return "⏳ Pendiente";
      default:
        return status;
    }
  };

  const explorerUrl = () => {
    if (!transaction?.signature) return null;
    return getExplorerUrl(transaction.signature);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">
            Cargando detalles de transacción...
          </p>
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="max-w-md space-y-4 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-red-600" />
          <h2 className="text-xl font-semibold">Error al cargar transacción</h2>
          <p className="text-muted-foreground">
            {error || "Transacción no encontrada"}
          </p>
          <a
            href="/dashboard/transfer"
            className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          >
            Volver a Transferencias
          </a>
        </div>
      </div>
    );
  }

  const { fromWallet, toWallet, amount } = transaction.metadata;
  const date = new Date(transaction.createdAt);
  const formattedDate = date.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Detalles de Transacción</h1>
          <a
            href="/dashboard/transfer"
            className="text-muted-foreground hover:text-foreground underline"
          >
            ← Volver
          </a>
        </div>

        {/* Status Card */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon(transaction.status)}
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                  transaction.status,
                )}`}
              >
                {getStatusLabel(transaction.status)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {transaction.id}
            </span>
          </div>

          <div className="text-4xl font-bold text-foreground">
            {amount.toFixed(4)} GAPC
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {formattedDate}
          </div>
        </div>

        {/* Transfer Details */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">
            Detalles de la Transferencia
          </h2>

          {/* From Wallet */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              De:
            </label>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <code className="text-sm break-all font-mono">{fromWallet}</code>
              <button
                onClick={() => copyToClipboard(fromWallet, "from")}
                className="p-2 hover:bg-secondary rounded transition-colors"
                title="Copiar"
              >
                <Copy
                  className={`h-4 w-4 ${
                    copied === "from"
                      ? "text-green-600"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center py-2">
            <ArrowRight className="h-6 w-6 text-muted-foreground rotate-90" />
          </div>

          {/* To Wallet */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Para:
            </label>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <code className="text-sm break-all font-mono">{toWallet}</code>
              <button
                onClick={() => copyToClipboard(toWallet, "to")}
                className="p-2 hover:bg-secondary rounded transition-colors"
                title="Copiar"
              >
                <Copy
                  className={`h-4 w-4 ${
                    copied === "to" ? "text-green-600" : "text-muted-foreground"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Cantidad:
            </label>
            <div className="p-3 rounded-lg bg-secondary/50">
              <code className="text-sm font-mono">
                {amount.toFixed(4)} GAPC
              </code>
            </div>
          </div>
        </div>

        {/* Blockchain Details */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">Información de Blockchain</h2>

          {/* Transaction ID */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              ID de Transacción:
            </label>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <code className="text-sm break-all font-mono">
                {transaction.transactionId}
              </code>
              <button
                onClick={() =>
                  copyToClipboard(transaction.transactionId, "txid")
                }
                className="p-2 hover:bg-secondary rounded transition-colors flex-shrink-0"
                title="Copiar"
              >
                <Copy
                  className={`h-4 w-4 ${
                    copied === "txid"
                      ? "text-green-600"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Signature */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Firma:
            </label>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <code className="text-sm break-all font-mono">
                {transaction.signature}
              </code>
              <button
                onClick={() => copyToClipboard(transaction.signature, "sig")}
                className="p-2 hover:bg-secondary rounded transition-colors flex-shrink-0"
                title="Copiar"
              >
                <Copy
                  className={`h-4 w-4 ${
                    copied === "sig"
                      ? "text-green-600"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Explorer Link */}
          {explorerUrl() && (
            <div className="pt-4 border-t border-border">
              <a
                href={explorerUrl()!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <ExternalLink className="h-4 w-4" />
                Ver en Solana Explorer
              </a>
            </div>
          )}
        </div>

        {/* Status Information */}
        {transaction.status === "pending" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-900">
              ⏳ Esta transacción aún está siendo confirmada en la red. Puede
              tardar algunos minutos.
            </p>
          </div>
        )}

        {transaction.status === "failed" && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-900">
              ❌ Esta transacción falló. Verifica los detalles e intenta de
              nuevo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
