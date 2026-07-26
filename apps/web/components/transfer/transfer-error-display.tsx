"use client";

import { AlertCircle, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import { getExplorerUrl } from "@/lib/network-config";

interface ErrorDisplayProps {
  error: string | null;
  errorStep?:
    | "validation"
    | "initiate"
    | "signing"
    | "confirm"
    | "confirmation_wait";
  transactionId?: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  retryRemainingSeconds?: number;
}

export function TransferErrorDisplay({
  error,
  errorStep,
  transactionId,
  onDismiss,
  onRetry,
  retryRemainingSeconds,
}: ErrorDisplayProps) {
  if (!error) return null;

  // Categorize errors and provide helpful suggestions
  const getErrorInfo = () => {
    const lowerError = error.toLowerCase();

    // Network errors
    if (lowerError.includes("network") || lowerError.includes("connection")) {
      return {
        icon: AlertCircle,
        title: "❌ Error de Conexión",
        message:
          "No pudimos conectar con el servidor. Verifica tu conexión a internet.",
        suggestion: "Intenta de nuevo en unos segundos.",
        severity: "warning" as const,
      };
    }

    // Wallet errors
    if (lowerError.includes("wallet") || lowerError.includes("phantom")) {
      return {
        icon: AlertTriangle,
        title: "👛 Error con la Billetera",
        message: "Phantom no respondió correctamente.",
        suggestion: "Asegúrate de que Phantom esté abierta y autorizada.",
        severity: "error" as const,
      };
    }

    // Insufficient balance
    if (lowerError.includes("insufficient") || lowerError.includes("balance")) {
      return {
        icon: AlertCircle,
        title: "💰 Balance Insuficiente",
        message: "No tienes suficientes tokens para esta transferencia.",
        suggestion: "Compra más tokens o reduce el monto de transferencia.",
        severity: "warning" as const,
      };
    }

    // Invalid address
    if (lowerError.includes("address") || lowerError.includes("wallet")) {
      return {
        icon: XCircle,
        title: "❌ Dirección Inválida",
        message: "La dirección del destinatario no es válida.",
        suggestion: "Verifica que copiaste correctamente la dirección.",
        severity: "error" as const,
      };
    }

    // Signing errors
    if (
      errorStep === "signing" ||
      lowerError.includes("sign") ||
      lowerError.includes("rejected")
    ) {
      return {
        icon: AlertTriangle,
        title: "✍️ Error al Firmar",
        message: "No pudimos firmar la transacción.",
        suggestion: "Asegúrate de aprobarlo en Phantom.",
        severity: "warning" as const,
      };
    }

    // Timeout/confirmation errors
    if (
      lowerError.includes("timeout") ||
      lowerError.includes("not confirmed") ||
      errorStep === "confirmation_wait"
    ) {
      return {
        icon: HelpCircle,
        title: "⏳ Transacción Pendiente",
        message: "La transacción está en la red pero aún no se confirma.",
        suggestion: `Puede verificarse en Solana Explorer con ID: ${transactionId}`,
        severity: "info" as const,
      };
    }

    // Default error
    return {
      icon: AlertCircle,
      title: "❌ Error en Transferencia",
      message: error,
      suggestion: "Intenta de nuevo o contacta con soporte.",
      severity: "error" as const,
    };
  };

  const errorInfo = getErrorInfo();
  const IconComponent = errorInfo.icon;

  const bgColors = {
    error: "bg-destructive/10 border-destructive/30",
    warning: "bg-amber-500/10 border-amber-500/30",
    info: "bg-blue-500/10 border-blue-500/30",
  };

  const textColors = {
    error: "text-destructive",
    warning: "text-amber-600",
    info: "text-blue-600",
  };

  return (
    <div className={`rounded-lg border p-4 ${bgColors[errorInfo.severity]}`}>
      <div className="flex gap-3">
        <IconComponent
          className={`h-5 w-5 flex-shrink-0 mt-0.5 ${textColors[errorInfo.severity]}`}
        />
        <div className="flex-1 min-w-0">
          <h4
            className={`font-semibold ${textColors[errorInfo.severity]} mb-1`}
          >
            {errorInfo.title}
          </h4>
          <p className="text-sm text-foreground/90 mb-2">{errorInfo.message}</p>
          <p className="text-xs text-muted-foreground mb-3">
            {errorInfo.suggestion}
          </p>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {onRetry && (
              <button
                onClick={onRetry}
                disabled={(retryRemainingSeconds ?? 0) > 0}
                className="inline-flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🔄{" "}
                {(retryRemainingSeconds ?? 0) > 0
                  ? `Reintentar en ${retryRemainingSeconds}s`
                  : "Reintentar"}
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="inline-flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                ✕ Descartar
              </button>
            )}
            {transactionId && errorInfo.severity === "info" && (
              <a
                href={getExplorerUrl(transactionId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium bg-blue-500/20 text-blue-600 hover:bg-blue-500/30 transition-colors"
              >
                🔍 Ver en Blockchain
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
