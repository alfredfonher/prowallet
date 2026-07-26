"use client";

import { useToken } from "@/components/token-provider";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatNumber } from "@/lib/token-store";
import {
  TrendingUp,
  Coins,
  CircleDollarSign,
  Users,
  ArrowRight,
} from "lucide-react";

interface DashboardViewProps {
  onNavigate: (view: "trade" | "transfer" | "history" | "balances") => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const { user } = useAuth();
  const { tokenInfo, transactions } = useToken();

  const getHoldersCount = () => {
    const h = (tokenInfo as any)?.holders;
    if (h == null) return 0;
    if (typeof h === "number") return h;
    if (typeof h === "object") return Object.keys(h).length;
    return 0;
  };

  // Vista pública: Usuario no autenticado
  if (!user) {
    const price = tokenInfo.price || 0.01;
    const marketCap = tokenInfo.circulatingSupply * price;

    return (
      <div className="space-y-6">
        {/* Información Pública del Token */}
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-xl font-bold text-blue-600">
              {tokenInfo.symbol?.[0] || "T"}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {tokenInfo.name || "ProWallet"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {tokenInfo.symbol || "GAPC"}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(price)}
            </p>
            <p className="text-xs text-muted-foreground">Precio actual</p>
          </div>
        </div>

        {/* Estadísticas Públicas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "Capitalización",
              value: formatCurrency(marketCap),
              icon: CircleDollarSign,
            },
            {
              label: "Suministro Total",
              value: formatNumber(tokenInfo.totalSupply),
              icon: Coins,
            },
            {
              label: "En Circulación",
              value: formatNumber(tokenInfo.circulatingSupply),
              icon: TrendingUp,
            },
            {
              label: "Tenedores",
              value: getHoldersCount(),
              icon: Users,
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <stat.icon className="h-4 w-4" />
                <span className="text-xs">{stat.label}</span>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Llamada a Acción */}
        <div className="rounded-xl border border-amber-200/50 bg-amber-50/50 p-8 text-center">
          <h3 className="text-xl font-semibold text-amber-900 mb-2">
            🔐 Conecta tu Wallet para Comenzar
          </h3>
          <p className="text-sm text-amber-800 mb-4">
            Autentica con tu wallet de Solana para acceder a compra, venta,
            transferencias y tu historial.
          </p>
          <p className="text-xs text-amber-700 mb-4">
            Tus datos personales (balance, historial de transacciones) solo
            serán visibles tras autenticarte.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={() => onNavigate("trade")}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Ver Operaciones
            </button>
          </div>
        </div>
      </div>
    );
  }

  const price = tokenInfo.price || 0.01;
  const marketCap = tokenInfo.circulatingSupply * price;

  return (
    <div className="space-y-6">
      {/* Token Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
          <span className="text-xl font-bold text-primary-foreground">T</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {tokenInfo.name}
          </h2>
          <p className="text-sm text-muted-foreground">{tokenInfo.symbol}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(price)}
          </p>
          <p className="text-xs text-muted-foreground">Precio actual</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Capitalización",
            value: formatCurrency(marketCap),
            icon: CircleDollarSign,
          },
          {
            label: "Suministro Total",
            value: formatNumber(tokenInfo.totalSupply),
            icon: Coins,
          },
          {
            label: "En Circulación",
            value: formatNumber(tokenInfo.circulatingSupply),
            icon: TrendingUp,
          },
          {
            label: "Tenedores",
            value: getHoldersCount(),
            icon: Users,
          },
        ].map((stat, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <stat.icon className="h-4 w-4" />
              <span className="text-xs">{stat.label}</span>
            </div>
            <p className="text-lg font-semibold text-foreground">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Trade CTA */}
      <button
        onClick={() => onNavigate("trade")}
        className="w-full rounded-xl bg-primary p-5 text-left hover:bg-primary/90 transition-colors group"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-primary-foreground">
              Comprar o Vender {tokenInfo.symbol}
            </p>
            <p className="text-sm text-primary-foreground/70 mt-1">
              Intercambio instantáneo sin comisiones
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-primary-foreground group-hover:translate-x-1 transition-transform" />
        </div>
      </button>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Actividad Reciente
          </h3>
          <button
            onClick={() => onNavigate("history")}
            className="text-xs text-primary hover:underline"
          >
            Ver todo
          </button>
        </div>
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          {transactions.slice(0, 4).map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between p-3.5"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    tx.type === "BUY"
                      ? "bg-emerald-500/10 text-emerald-500"
                      : tx.type === "SELL"
                        ? "bg-rose-500/10 text-rose-500"
                        : "bg-primary/10 text-primary"
                  }`}
                >
                  {tx.type === "BUY" ? "C" : tx.type === "SELL" ? "V" : "T"}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {tx.type === "BUY"
                      ? "Compra"
                      : tx.type === "SELL"
                        ? "Venta"
                        : "Transferencia"}
                  </p>
                  <p className="text-xs text-muted-foreground">{tx.holder}</p>
                </div>
              </div>
              <div className="text-right">
                <p
                  className={`text-sm font-medium ${
                    tx.type === "BUY"
                      ? "text-emerald-500"
                      : tx.type === "SELL"
                        ? "text-rose-500"
                        : "text-foreground"
                  }`}
                >
                  {tx.type === "BUY" ? "+" : tx.type === "SELL" ? "-" : ""}
                  {formatNumber(tx.tokenAmount)} {tokenInfo.symbol}
                </p>
                {tx.fiatAmount && (
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(tx.fiatAmount)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
