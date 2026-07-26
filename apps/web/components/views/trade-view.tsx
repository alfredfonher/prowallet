"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useToken } from "@/components/token-provider";
import { useAuth } from "@/lib/auth-context";
import { useWallet } from "@/lib/use-wallet";
import { authService } from "@/lib/auth-service";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatNumber } from "@/lib/token-store";
import { CheckCircle2 } from "lucide-react";
import { TransactionConfirmationModal } from "@/components/transaction-confirmation-modal";
import { PurchaseEvents } from "@/lib/purchase-events";

// Constantes de fees (deben coincidir con backend en purchase-service.ts)
// SOLO COSTO DE GAS - Sin comisión de plataforma
const GAS_FEE_SOL = 0.000005;
const PLATFORM_FEE_SOL = 0; // Eliminada - 0
const TOTAL_FEES_SOL = GAS_FEE_SOL + PLATFORM_FEE_SOL;
const BALANCE_BUFFER_SOL = 0.00001; // Safety buffer para network volatility (sync con backend)

// Función para obtener balance de SOL (con API, NO RPC directo)
const fetchSolBalance = async (walletAddress: string) => {
  try {
    // Obtener desde API backend primero (sin CORS issues)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      console.warn(
        "⚠️ NEXT_PUBLIC_API_URL no configurada, intentando fallback",
      );
    }

    const response = await fetch(
      `${apiUrl || "https://servicioshilda.orioncaribe.com/api/v1"}/exchange/getBalance/${walletAddress}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
    );

    if (response.ok) {
      const data = await response.json();
      const balance = data?.extra?.balance;
      if (balance !== undefined && balance !== null) {
        console.log("✅ Balance from API:", balance, "SOL");
        return balance;
      }
    }

    // Si llegamos aquí, la API no devolvió balance válido
    console.error("⚠️ API returned invalid balance data");
    return null;
  } catch (error) {
    console.error("❌ Error obteniendo balance de SOL:", error);
    return null;
  }
};

export function TradeView() {
  const { user } = useAuth();
  const walletAddress = useWallet(); // ✅ Hook reactivo para la wallet
  const { tokenInfo, buyTokens, isLoading, error } = useToken();

  // ✅ TODOS LOS HOOKS AL INICIO - siempre en el mismo orden
  const [prowalletAmount, setProwalletAmount] = useState("");
  const [success, setSuccess] = useState(false);
  const [lastTrade, setLastTrade] = useState<{
    mode: "buy";
    tokens: number;
    sol: number;
    transactionId?: string;
  } | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<{
    mode: "buy";
    amount: number;
  } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [reconnectInfo, setReconnectInfo] = useState<{
    connected?: string;
    expected?: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  // Refs para el toast y transactionId pendientes (permiten cerrarlos desde SSE)
  const pendingToastRef = useRef<string | null>(null);
  const pendingTxIdRef = useRef<string | null>(null);

  // Actualizar balance de SOL cuando cambia la wallet
  useEffect(() => {
    const updateBalance = async () => {
      if (walletAddress) {
        const balance = await fetchSolBalance(walletAddress);
        setSolBalance(balance);
      } else {
        setSolBalance(null);
      }
    };

    updateBalance();

    // Actualizar balance cada 10 segundos para detectar cambios
    const interval = setInterval(updateBalance, 10000);

    return () => clearInterval(interval);
  }, [walletAddress]);

  // Actualizar balance después de transacciones exitosas
  useEffect(() => {
    if (success && walletAddress) {
      // Pequeño delay para que la transacción se confirme en blockchain
      const timeout = setTimeout(async () => {
        const balance = await fetchSolBalance(walletAddress);
        setSolBalance(balance);
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [success, walletAddress]);

  // Vista pública: Usuario no autenticado
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Información Pública del Token */}
        <div className="rounded-xl border border-blue-200/50 bg-blue-50/50 p-6">
          <h3 className="font-semibold text-blue-900">
            📊 Información Pública del Token
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-blue-700/70">Token</p>
              <p className="font-semibold text-blue-900">
                {tokenInfo.symbol || "GAPC"}
              </p>
            </div>
            <div>
              <p className="text-blue-700/70">Precio</p>
              <p className="font-semibold text-blue-900">
                {tokenInfo.price
                  ? `$${tokenInfo.price.toFixed(6)}`
                  : "Variable"}
              </p>
            </div>
            <div>
              <p className="text-blue-700/70">Holders</p>
              <p className="font-semibold text-blue-900">
                {typeof tokenInfo.holders === "number"
                  ? tokenInfo.holders
                  : Object.keys(tokenInfo.holders).length}
              </p>
            </div>
            <div>
              <p className="text-blue-700/70">Supply</p>
              <p className="font-semibold text-blue-900">
                {tokenInfo.totalSupply
                  ? formatNumber(tokenInfo.totalSupply)
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Llamada a Acción */}
        <div className="rounded-xl border border-amber-200/50 bg-amber-50/50 p-6">
          <h3 className="font-semibold text-amber-900">
            🔐 Conecta tu Wallet para Comprar
          </h3>
          <p className="mt-2 text-sm text-amber-800">
            Debes autenticarte con tu wallet de Solana para ver tu balance y
            realizar operaciones.
          </p>
          <p className="mt-2 text-xs text-amber-700">
            Tus datos sensibles (balance, historial) solo serán visibles después
            de autenticarte.
          </p>
        </div>
      </div>
    );
  }

  // ✅ Si no hay wallet vinculada, mostrar advertencia pero permitir comprar
  // El backend creará automáticamente la ATA cuando se compre
  const hasWalletLinked = walletAddress && walletAddress.trim().length > 0;

  const numericTokenAmount = Number.parseFloat(prowalletAmount) || 0; // Cantidad de GAPC tokens
  const solPriceUsd = tokenInfo.solPriceUsd ?? null; // Precio SOL/USD desde TokenProvider
  const tokenPriceInUsd = tokenInfo.price ?? null; // Precio del token en USD ($0.01 fijo)

  // ✅ VALIDACIÓN: Ahora siempre tenemos precios válidos (con defaults)
  const hasValidPrices = true; // Siempre true ya que TokenProvider garantiza valores válidos

  // Convertir a SOL solo para el cálculo de pago
  // GAPC siempre cuesta $0.01 USD, se convierte a SOL al momento de pagar
  const tokenPriceInSol = hasValidPrices ? tokenPriceInUsd / solPriceUsd : 0; // Precio del token en SOL
  const totalTokenCostInSol = numericTokenAmount * tokenPriceInSol; // Costo total en SOL
  const totalInSol = totalTokenCostInSol + TOTAL_FEES_SOL; // Con fees

  // Debug logging
  if (numericTokenAmount > 0) {
    console.log("💰 DEBUG Conversión:", {
      numericTokenAmount,
      solPriceUsd,
      tokenPriceInUsd,
      tokenPriceInSol,
      totalTokenCostInSol,
      totalInSol,
      TOTAL_FEES_SOL,
      hasValidPrices,
    });
  }

  // Cálculos
  const buyCalc = {
    tokenAmount: numericTokenAmount,
    solAmount: totalTokenCostInSol,
    totalFees: TOTAL_FEES_SOL,
    totalToPay: totalInSol,
  };

  // Calcular si hay suficiente balance para la transacción (con buffer de seguridad)
  const requiredSolWithBuffer = totalInSol + BALANCE_BUFFER_SOL;
  const hasEnoughBalance =
    solBalance !== null && solBalance >= requiredSolWithBuffer;

  const canSubmit = numericTokenAmount > 0 && hasEnoughBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!canSubmit) return;

    // Mostrar modal de confirmación en lugar de ejecutar directamente
    setPendingTransaction({
      mode: "buy",
      amount: numericTokenAmount, // Pasar cantidad de TOKENS
    });
    setShowConfirmationModal(true);
  };

  const handleConfirmTransaction = async () => {
    if (!pendingTransaction) return;

    setIsProcessing(true);
    let txId: string | undefined;
    try {
      if (pendingTransaction.mode === "buy") {
        // ✅ RE-VALIDAR PRECIO JUSTO ANTES DE COMPRAR
        // Esto evita discrepancias si el supply cambió mientras estábamos en el modal
        try {
          const latestPriceResp =
            await apiClient.get<any>("/exchange/getPrice");
          const latestTokenPrice = latestPriceResp?.extra?.price;
          const latestSolPrice = latestPriceResp?.extra?.solPrice;

          if (
            latestTokenPrice &&
            latestSolPrice &&
            latestTokenPrice > 0 &&
            latestSolPrice > 0
          ) {
            const latestTokenPriceInSol = latestTokenPrice / latestSolPrice;
            const latestTotalCost =
              pendingTransaction.amount * latestTokenPriceInSol +
              TOTAL_FEES_SOL;

            // Si el precio subió más de 5%, advertir al usuario
            const priceDiff = Math.abs(latestTotalCost - buyCalc.totalToPay);
            const percentDiff = (priceDiff / buyCalc.totalToPay) * 100;

            console.log("💰 Validación de precio pre-compra:", {
              precioCalculado: buyCalc.totalToPay.toFixed(9),
              precioActual: latestTotalCost.toFixed(9),
              cambioPercent: percentDiff.toFixed(2),
            });

            if (percentDiff > 0.05) {
              // Diferencia > 5%
              toast.error(
                `⚠️ El precio cambió ${percentDiff.toFixed(2)}%. Nuevo costo: ${latestTotalCost.toFixed(6)} SOL`,
              );
              setIsProcessing(false);
              return; // No proceder con la compra
            }
          }
        } catch (priceCheckErr) {
          console.warn("⚠️ Error al re-validar precio:", priceCheckErr);
          // Continuar de todas formas, pero informar al usuario
          toast.error(
            "No se pudo verificar precio actual. Procediendo con caución...",
          );
        }

        // Pasar la cantidad de ProWallet a comprar, no los fees
        txId = await buyTokens(walletAddress, pendingTransaction.amount);

        // Guardar txId pendiente para que el listener SSE lo pueda reconocer
        pendingTxIdRef.current = txId || null;

        // Actualizar actividad de sesión
        authService.updateActivity();

        // ❌ REMOVIDO: Modal se cierra automáticamente con evento PURCHASE_CONFIRMED

        setLastTrade({
          mode: "buy",
          tokens: pendingTransaction.amount,
          sol: buyCalc.totalToPay,
          transactionId: txId,
        });
        // Limpiar refs ya que manejamos éxito localmente
        pendingToastRef.current = null;
        pendingTxIdRef.current = null;

      setSuccess(true);
      setProwalletAmount("");
      // ✅ DEMORAR limpieza de pendingTransaction para que el modal pueda cerrarse primero
      setTimeout(() => {
        setPendingTransaction(null);
      }, 100);

      // Mostrar toast de éxito breve después de cerrar el modal
      setTimeout(() => {
        const amount = pendingTransaction?.amount || 0;
        toast.success(
          `✅ ¡Compra exitosa!\n${formatNumber(amount)} ${tokenInfo.symbol}\nPagado: ${formatCurrency(buyCalc.totalToPay)} SOL`,
          { duration: 3000 },
        );
        setSuccess(false);
      }, 500);
    } catch (err: any) {
      const errorMsg =
        err?.message || "Ocurrió un error al procesar la operación";
      setLocalError(errorMsg);

      // Si tenemos txId, verificar estado remoto: a veces el POST /confirm hace timeout
      // pero el backend procesa la compra y marca minted=true. En ese caso, cerrar modal.
      if (txId) {
        try {
          console.log("⚙️ Intentando verificar estado remoto para txId:", txId);
          const statusResp = await apiClient.get<any>(
            `/purchase/status/${txId}`,
          );

          const minted = statusResp?.minted || statusResp?.extra?.minted;

          if (minted) {
            // Tratar como éxito: cerrar modal y mostrar success
            toast.dismiss();

            setSuccess(true);
            setProwalletAmount("");
            setPendingTransaction(null);
            setShowConfirmationModal(false);

            // Mostrar toast de éxito breve
            setTimeout(() => {
              toast.success(
                `✅ ¡Compra finalizada! Se detectó mint en backend. TransactionId: ${txId}`,
                { duration: 3000 },
              );
              setSuccess(false);
            }, 500);
            return;
          }
        } catch (statusErr) {
          console.warn("⚠️ Error comprobando /purchase/status:", statusErr);
        }
      }

      // Si no se confirmó en backend, mostrar error normal
      // Descartar todos los toasts y cerrar modal
      toast.dismiss();
      setShowConfirmationModal(false);

      setTimeout(() => {
        toast.error(errorMsg, { duration: 5000 });
      }, 300);
    } finally {
      // Asegurar siempre limpiar el toast de loading para no dejarlo pegado
      if (pendingToastRef.current) {
        try {
          toast.dismiss(pendingToastRef.current);
        } catch (e) {
          // fallback: dismiss all
          toast.dismiss();
        }
        pendingToastRef.current = null;
      }
      pendingTxIdRef.current = null;
      // ✅ SIEMPRE DETENER isProcessing cuando termine
      setIsProcessing(false);
    }
  };

  const handleMaxClick = () => {
    // Nota: En el nuevo diseño no hay "Max" porque no tenemos balance local
    // El backend validará si hay suficientes tokens
  };

  // Listener global para eventos de compra completada (emitidos por TokenProvider via SSE)
  useEffect(() => {
    // Listener para evento cuando la compra se inicia y ya existe transactionId
    const onPurchaseStarted = (ev: Event) => {
      try {
        const custom = ev as CustomEvent<any>;
        const detail = custom.detail || {};
        const txId = detail.transactionId;
        if (txId) {
          pendingTxIdRef.current = txId;
          console.log(
            "TradeView: pendingTxIdRef set from purchase.started ->",
            txId,
          );
        }
      } catch (e) {
          console.warn("Error handling prowallet:purchase.started", e);
      }
    };

    window.addEventListener(
      "prowallet:purchase.started",
      onPurchaseStarted as EventListener,
    );

    // Clean up listener when effect unmounts (below)
    // Listener para solicitudes de reconexión desde TokenProvider
    const onReconnectRequested = (ev: Event) => {
      try {
        const custom = ev as CustomEvent<any>;
        const detail = custom.detail || {};
        setReconnectInfo({
          connected: detail.connected,
          expected: detail.expected,
        });
      } catch (e) {
        console.warn("Error parsing reconnect event", e);
      }
    };

    window.addEventListener(
      "prowallet:wallet.reconnect_required",
      onReconnectRequested as EventListener,
    );

    // Limpiar al desmontar
    const cleanupReconnect = () =>
      window.removeEventListener(
        "prowallet:wallet.reconnect_required",
        onReconnectRequested as EventListener,
      );

    // Registrar cleanup al desmontar el effect principal abajo
    const onPurchaseCompleted = (ev: Event) => {
      try {
        const custom = ev as CustomEvent<any>;
        const payload = custom.detail;
        const txId = payload?.transactionId;

        console.log(
          "TradeView: received prowallet:purchase.completed ->",
          payload,
        );

        if (txId && pendingTxIdRef.current && pendingTxIdRef.current === txId) {
          // ✅ MODIFICADO: No cerrar modal inmediatamente
          // El modal se cerrará automáticamente con el evento PURCHASE_CONFIRMED
          console.log(
            "📡 SSE purchase.completed recibido, esperando PURCHASE_CONFIRMED para cerrar modal",
          );

          // Mantener el toast de loading hasta que se confirme
          // No cerrar modal aquí - esperar al evento PURCHASE_CONFIRMED

          // Limpiar refs pero mantener modal abierto
          pendingToastRef.current = null;
          pendingTxIdRef.current = null;
          return;
        }

        // Fallback: si no hay txId coincidente, cerrar la modal si la notificación
        // indica que la compra fue mintada para la wallet actual.
        const payloadWallet = payload?.walletAddress;
        const minted = Boolean(payload?.minted);
        const payloadAmount =
          typeof payload?.tokenAmount === "number"
            ? payload.tokenAmount
            : undefined;

        if (
          minted &&
          payloadWallet &&
          walletAddress &&
          payloadWallet === walletAddress &&
          pendingTransaction &&
          (payloadAmount === undefined ||
            payloadAmount === pendingTransaction.amount)
        ) {
          // ✅ MODIFICADO: No cerrar modal inmediatamente por SSE
          // El modal se cerrará automáticamente con el evento PURCHASE_CONFIRMED
          console.log(
            "📡 SSE minted=true recibido, esperando PURCHASE_CONFIRMED para cerrar modal",
          );

          // Mantener el toast de loading hasta que se confirme
          // No cerrar modal aquí - esperar al evento PURCHASE_CONFIRMED

          // Limpiar refs pero mantener modal abierto
          pendingToastRef.current = null;
          pendingTxIdRef.current = null;
        }
      } catch (e) {
        console.warn(
          "Error handling prowallet:purchase.completed in TradeView",
          e,
        );
      }
    };

    window.addEventListener(
      "prowallet:purchase.completed",
      onPurchaseCompleted as EventListener,
    );

    // Listener para PURCHASE_CONFIRMED - descartar toast cuando el modal se cierra
    const onPurchaseConfirmed = () => {
      console.log(
        "🎉 TradeView: PURCHASE_CONFIRMED recibido, descartando toast",
      );
      if (pendingToastRef.current) {
        try {
          toast.dismiss(pendingToastRef.current);
          console.log("✅ Toast descartado exitosamente");
        } catch (e) {
          console.warn("⚠️ Error descartando toast:", e);
        }
        pendingToastRef.current = null;
      }
    };

    const unsubscribePurchaseConfirmed =
      PurchaseEvents.onConfirmed(onPurchaseConfirmed);

    return () => {
      window.removeEventListener(
        "prowallet:purchase.completed",
        onPurchaseCompleted as EventListener,
      );
      window.removeEventListener(
        "prowallet:purchase.started",
        onPurchaseStarted as EventListener,
      );
      cleanupReconnect();
      unsubscribePurchaseConfirmed();
    };
  }, [walletAddress, pendingTransaction]);

  // Handler para el botón de reconectar (se ejecuta en gesto de usuario)
  const handleReconnectWallet = async () => {
    try {
      const w = window as any;
      const candidates = [
        w.phantom?.solana,
        w.solflare,
        w.solana,
        w.magicEden?.solana,
        w.brave?.solana,
        w.slope,
        w.coin98?.solana,
        w.ledger?.solana,
      ];

      const provider = candidates.find((c) => c);
      if (!provider) {
        setLocalError(
          "No se encontró ningún proveedor de wallet en la página.",
        );
        return;
      }

      // Intentar conectar (esto debe ser un gesto de usuario para evitar bloqueo de popup)
      await provider.connect();
      toast.success("Wallet reconectada. Intenta confirmar de nuevo.");
      setReconnectInfo(null);
    } catch (e: any) {
      console.warn("Reconnect failed", e);
      setLocalError(`Reconexión fallida: ${e?.message || String(e)}`);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      {/* Success Toast */}
      {success && lastTrade && (
        <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                Compra exitosa
              </span>
              <span className="text-muted-foreground">
                {" "}
                - {formatNumber(lastTrade.tokens)} {tokenInfo.symbol}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Trade Card */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="border-b border-border py-4 text-center">
          <span className="text-sm font-semibold text-emerald-500">Comprar</span>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Wallet Address Info */}
          {walletAddress && (
            <div className="rounded-lg border border-blue-200/50 bg-blue-50/50 dark:border-blue-500/20 dark:bg-blue-500/5 p-3">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <span className="font-semibold">Wallet:</span>{" "}
                {walletAddress.slice(0, 8)}...
                {walletAddress.slice(-8)}
              </p>
              {solBalance !== null && (
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  <span className="font-semibold">Balance SOL:</span>{" "}
                  {solBalance.toFixed(4)} SOL
                  {numericTokenAmount > 0 && (
                    <span
                      className={`ml-2 ${hasEnoughBalance ? "text-green-600" : "text-red-600"}`}
                    >
                      ({hasEnoughBalance ? "✓ Suficiente" : "✗ Insuficiente"})
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* GAPC Tokens Input */}
          <div className="rounded-xl border border-border bg-secondary/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">
                GAPC a comprar
              </span>
              <span className="text-xs text-muted-foreground">
                {numericTokenAmount > 0
                  ? `${totalTokenCostInSol.toFixed(9)} SOL`
                  : "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]{0,9}"
                value={prowalletAmount}
                onChange={(e) => {
                  const value = e.target.value;
                  // Validar: solo números y punto decimal, máximo 9 decimales
                  if (value === "" || /^\d*\.?\d{0,9}$/.test(value)) {
                    setProwalletAmount(value);
                  }
                }}
                placeholder="0"
                className="flex-1 bg-transparent text-2xl font-semibold text-foreground placeholder:text-muted-foreground/50 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <div className="flex items-center gap-1 rounded-lg bg-background px-3 py-2 border border-border whitespace-nowrap">
                <div className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold text-white bg-primary">
                  G
                </div>
                <span className="text-sm font-medium text-foreground">
                  {tokenInfo.symbol}
                </span>
              </div>
            </div>
          </div>

          {/* USD Price Display */}
          {numericTokenAmount > 0 && (
            <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Precio por token
                </span>
                <span className="text-sm font-semibold text-foreground">
                  ${tokenPriceInUsd.toFixed(4)} USD
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Subtotal en USD ({numericTokenAmount} tokens)
                </span>
                <span className="text-lg font-semibold text-amber-600">
                  ${(numericTokenAmount * tokenPriceInUsd).toFixed(2)} USD
                </span>
              </div>
              <div className="border-t border-border pt-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Costo en SOL (a pagar)
                </span>
                <span
                  className="text-lg font-semibold text-emerald-600"
                >
                  {buyCalc.totalToPay.toFixed(9)} SOL
                </span>
              </div>
            </div>
          )}

          {/* SOL Input - Total a Pagar/Recibir (OLD - REMOVING) */}
          {numericTokenAmount <= 0 && (
            <div className="rounded-xl border border-border bg-secondary/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">
                  Total a pagar
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 text-2xl font-semibold text-muted-foreground">
                  —
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-background px-3 py-2 border border-border whitespace-nowrap">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold text-white bg-emerald-500"
                  >
                    ◎
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    SOL
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {(localError || error) && (
            <p className="text-xs text-rose-500">
              {localError || (error as string)}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!canSubmit || isProcessing}
            className="w-full rounded-xl py-4 text-base font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            {!walletAddress
              ? "Conecta tu wallet"
              : numericTokenAmount <= 0
                ? "Ingresa cantidad de tokens"
                : !hasEnoughBalance
                  ? `Balance insuficiente (${solBalance?.toFixed(4) || 0} SOL, necesitas ${totalInSol.toFixed(4)} SOL)`
                  : isProcessing
                    ? `Procesando...`
                    : `Comprar ${formatNumber(numericTokenAmount)} ${tokenInfo.symbol}`}
          </button>
        </form>
      </div>

      {/* Info Footer */}
      <p className="text-center text-xs text-muted-foreground mt-4">
        Transacción segura en Solana
      </p>

      {/* Confirmation Modal */}
      {pendingTransaction && (
        <TransactionConfirmationModal
          isOpen={showConfirmationModal}
          transactionType="BUY"
          tokenSymbol={tokenInfo.symbol}
          tokenAmount={pendingTransaction.amount}
          fiatAmount={0}
          fees={TOTAL_FEES_SOL}
          totalCost={buyCalc.totalToPay}
          walletAddress={walletAddress}
          onConfirm={handleConfirmTransaction}
          onCancel={() => {
            setShowConfirmationModal(false);
            setPendingTransaction(null);
          }}
        />
      )}

      {/* Banner de reconexión cuando la wallet no coincide */}
      {reconnectInfo && pendingTransaction && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-800">
                Wallet conectada diferente a la esperada
              </p>
              <p className="text-xs text-amber-700">
                Conectada: {reconnectInfo.connected || "(desconocida)"}
                {" — "}
                Esperada: {reconnectInfo.expected || "(desconocida)"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReconnectWallet}
                className="rounded-md bg-amber-500 px-3 py-2 text-white"
              >
                Reconectar wallet
              </button>
              <button
                onClick={() => setReconnectInfo(null)}
                className="rounded-md border px-3 py-2"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
