"use client";

import { useToken } from "@/components/token-provider";
import { useAuth } from "@/lib/auth-context";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useMarketStats } from "@/hooks/use-market-stats";
import { formatNumber, formatCurrency } from "@/lib/token-store";
import { Wallet, TrendingUp, RefreshCw, AlertCircle } from "lucide-react";

export function BalancesView() {
  const { tokenInfo, isLoading: tokenLoading, error: tokenError } = useToken();
  const { user } = useAuth();
  const {
    gapcBalance,
    solBalance,
    solBalanceFormatted,
    balanceUsd,
    isLoading: balanceLoading,
    refresh,
  } = useTokenBalance();
  const { marketData, isLoading: marketLoading } = useMarketStats();

  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <p className="text-sm text-amber-600">
            Por favor autentícate primero
          </p>
        </div>
      </div>
    );
  }

  const isLoading = tokenLoading || balanceLoading || marketLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-6 animate-pulse h-32"
            >
              <div className="bg-muted rounded h-full w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const tokenError_msg = tokenError
    ? typeof tokenError === "string"
      ? tokenError
      : "Error cargando datos"
    : null;

  if (tokenError_msg) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-500 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-900">Error</p>
              <p className="text-sm text-rose-700 mt-1">{tokenError_msg}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* GAPC Balance */}
        <div className="rounded-xl border border-border bg-card p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Balance GAPC</p>
              <p className="text-3xl font-bold text-foreground">
                {formatNumber(gapcBalance)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {tokenInfo.symbol || "GAPC"}
              </p>
            </div>
            <div className="rounded-lg bg-blue-500/10 p-3">
              <Wallet className="h-6 w-6 text-blue-500" />
            </div>
          </div>
        </div>

        {/* SOL Balance */}
        <div className="rounded-xl border border-border bg-card p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Balance SOL</p>
              <p className="text-3xl font-bold text-foreground">
                {solBalanceFormatted}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                ≈ ${formatNumber(balanceUsd, 2)}
              </p>
            </div>
            <div className="rounded-lg bg-amber-500/10 p-3">
              <Wallet className="h-6 w-6 text-amber-500" />
            </div>
          </div>
        </div>

        {/* Price Card */}
        <div className="rounded-xl border border-border bg-card p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Precio GAPC</p>
              <p className="text-3xl font-bold text-foreground">
                ${marketData?.currentPrice.toFixed(6) || "—"}
              </p>
              <p
                className={`text-xs mt-2 ${marketData && marketData.priceChangePercent24h >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {marketData?.priceChangePercent24h.toFixed(2)}% (24h)
              </p>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-3">
              <TrendingUp className="h-6 w-6 text-emerald-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/50">
          <h3 className="font-semibold text-foreground">
            Estadísticas Detalladas
          </h3>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-lg hover:bg-secondary disabled:opacity-50 transition-colors"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            <span className="sr-only">Refrescar</span>
          </button>
        </div>

        <div className="divide-y divide-border">
          {/* Precio Actual */}
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-sm text-muted-foreground">
              Precio Actual (USD)
            </span>
            <span className="font-medium text-foreground">
              ${marketData?.currentPrice.toFixed(8) || "—"}
            </span>
          </div>

          {/* Market Cap */}
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-sm text-muted-foreground">Market Cap</span>
            <span className="font-medium text-foreground">
              ${formatNumber(marketData?.marketCap || 0, 0)}
            </span>
          </div>

          {/* Volumen 24h */}
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-sm text-muted-foreground">Volumen 24h</span>
            <span className="font-medium text-foreground">
              ${formatNumber(marketData?.volume24h || 0, 0)}
            </span>
          </div>

          {/* Supply */}
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-sm text-muted-foreground">
              Suministro Circulante
            </span>
            <span className="font-medium text-foreground">
              {formatNumber(marketData?.circulatingSupply || 0, 0)}
            </span>
          </div>

          {/* High/Low */}
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-sm text-muted-foreground">
              Alto 24h / Bajo 24h
            </span>
            <span className="font-medium text-foreground">
              ${marketData?.high24h.toFixed(8) || "—"} / $
              {marketData?.low24h.toFixed(8) || "—"}
            </span>
          </div>

          {/* All Time High/Low */}
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-sm text-muted-foreground">ATH / ATL</span>
            <span className="font-medium text-foreground">
              ${marketData?.ath.toFixed(8) || "—"} / $
              {marketData?.atl.toFixed(8) || "—"}
            </span>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-secondary/50">
          <h3 className="font-semibold text-foreground">
            Información de Cuenta
          </h3>
        </div>
        <div className="divide-y divide-border">
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-sm text-muted-foreground">Usuario</span>
            <span className="font-medium text-foreground">
              {user.email || user.username}
            </span>
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-sm text-muted-foreground">
              Tokens Poseídos
            </span>
            <span className="font-medium text-foreground">
              {formatNumber(gapcBalance)} GAPC
            </span>
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-sm text-muted-foreground">
              Valor en USD (SOL)
            </span>
            <span className="font-medium text-foreground">
              ${formatNumber(balanceUsd, 2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
