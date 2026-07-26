"use client";

import { useState, useEffect } from "react";
import {
  Send,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Search,
  AlertTriangle,
  RotateCw,
  Zap,
  Globe,
} from "lucide-react";
import Swal from "sweetalert2";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { formatNumber } from "@/lib/token-store";
// import { use_address_book } from "@/hooks/use-address-book"; // commented out since not used
import { use_wallet_signer } from "@/hooks/use-wallet-signer";
import { useWallet } from "@/lib/use-wallet";
import { useSolPrice } from "@/hooks/use-sol-price";
import { WalletSearchInput } from "../transfer/wallet-search-input";
import { TransferErrorDisplay } from "../transfer/transfer-error-display";
import {
  getNetworkConfig,
  isTestnet,
  estimateTransferFee,
  formatGasFee,
  getExplorerUrl,
} from "@/lib/network-config";

interface TransferFormData {
  toAddress: string;
  amount: string;
  is_external_wallet: boolean;
}

interface TransferPreview {
  fromBalance: number;
  toBalance: number;
  fee: number;
  totalAmount: number;
}

interface WalletResult {
  id: string;
  username: string;
  wallet: string;
  address: string;
  label: string;
}

export function TransferView() {
  const { user } = useAuth();
  const walletAddress = useWallet();
  // const { add_address, load_addresses } = use_address_book({
  //     wallet_address: walletAddress,
  //     auto_load: true,
  // });
  const { is_signing, sign_transaction } = use_wallet_signer();
  const { price: solPrice } = useSolPrice();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [is_external_address, set_is_external_address] = useState(false);
  const [wallet_search_results, set_wallet_search_results] = useState<
    WalletResult[]
  >([]);
  const [show_wallet_dropdown, set_show_wallet_dropdown] = useState(false);

  const [formData, setFormData] = useState<TransferFormData>({
    toAddress: "",
    amount: "",
    is_external_wallet: false,
  });

  const [lastTransfer, setLastTransfer] = useState<{
    from: string;
    to: string;
    amount: number;
    txId: string;
  } | null>(null);

  // Error recovery state
  const [failedTransfer, setFailedTransfer] = useState<{
    fromWallet: string;
    toWallet: string;
    amount: number;
    transactionId: string;
    signedTransaction: string;
    failureReason: string;
    failureStep: "initiate" | "signing" | "confirm";
    timestamp: number;
  } | null>(null);

  // Retry cooldown to prevent accidental double-submissions
  const [retryRemainingSeconds, setRetryRemainingSeconds] = useState(0);

  // Track if transfer is in progress (disable submit button)
  const [isTransferInProgress, setIsTransferInProgress] = useState(false);

  // Initialize transfer state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem("transferInProgress");
    if (savedState === "true") {
      setIsTransferInProgress(true);
      // Auto-disable after 5 minutes (safety timeout)
      const timeout = setTimeout(
        () => {
          setIsTransferInProgress(false);
          localStorage.removeItem("transferInProgress");
        },
        5 * 60 * 1000,
      );
      return () => clearTimeout(timeout);
    }
  }, []);

  // Persist transfer in progress state to localStorage
  useEffect(() => {
    if (isTransferInProgress) {
      localStorage.setItem("transferInProgress", "true");
    } else {
      localStorage.removeItem("transferInProgress");
    }
  }, [isTransferInProgress]);

  // Input validation
  const validate_transfer_input = (data: TransferFormData): string | null => {
    if (!walletAddress) {
      return "No tienes autenticarte para transferir";
    }

    if (!data.toAddress?.trim()) {
      return "La dirección de destino es requerida";
    }

    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(data.toAddress.trim())) {
      return "Dirección Solana inválida";
    }

    if (walletAddress === data.toAddress.trim()) {
      return "No puedes transferir a la misma dirección";
    }

    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
      return "La cantidad debe ser mayor a 0";
    }

    // Validar que tenga máximo 9 decimales (GAPC tiene 9 decimales)
    const decimalPlaces = (data.amount.toString().split(".")[1] || "").length;
    if (decimalPlaces > 9) {
      return "GAPC solo permite hasta 9 decimales";
    }

    return null;
  };

  // Check if address is registered in the system
  const check_address_status = async (address: string): Promise<boolean> => {
    try {
      const response = await apiClient.get(`/users/check/${address}`);
      return response.extra?.is_registered || false;
    } catch (err) {
      console.error("Error checking address status:", err);
      return false;
    }
  };

  // Search wallets in real-time - case sensitive
  const search_wallets = async (query: string) => {
    if (!query.trim()) {
      set_wallet_search_results([]);
      set_show_wallet_dropdown(false);
      return;
    }

    try {
      const response = await apiClient.get(`/users/wallets`);
      const all_wallets = response.extra?.wallets || [];

      // Map wallets to consistent format
      const mapped_wallets: WalletResult[] = all_wallets.map((w: any) => ({
        id: w.id,
        username: w.username || w.label || "",
        wallet: w.address || w.wallet || "",
        address: w.address || w.wallet || "",
      }));

      // Filter by case-sensitive search (wallet address or username)
      const filtered = mapped_wallets.filter((wallet: WalletResult) => {
        const address_match = wallet.wallet.includes(query);
        const username_match = wallet.username.includes(query);
        return address_match || username_match;
      });

      // Get top 5 results
      const top_results = filtered.slice(0, 5);
      set_wallet_search_results(top_results);
      set_show_wallet_dropdown(top_results.length > 0);
    } catch (err) {
      console.error("Error searching wallets:", err);
      set_wallet_search_results([]);
      set_show_wallet_dropdown(false);
    }
  };

  // Handle wallet selection from dropdown
  const select_wallet = (wallet: WalletResult | any) => {
    const address = wallet.wallet || wallet.address; // Handle both WalletResult and WalletInfo
    setFormData((prev) => ({
      ...prev,
      toAddress: address || "",
    }));
    set_show_wallet_dropdown(false);
    set_wallet_search_results([]);
  };

  // Calculate preview
  const calculate_preview = async () => {
    console.log("calculate_preview called:", {
      toAddress: formData.toAddress,
      amount: formData.amount,
      walletAddress,
    });

    if (
      !formData.toAddress?.trim() ||
      !formData.amount?.trim() ||
      !walletAddress
    ) {
      console.log("Missing required fields, setting preview to null");
      setPreview(null);
      return;
    }

    try {
      const [fromBalanceResponse, toBalanceResponse] = await Promise.all([
        apiClient.get(`/prowallet/balance/${walletAddress}`),
        apiClient.get(`/prowallet/balance/${formData.toAddress}`),
      ]);

      const amount = parseFloat(formData.amount);
      const fee = 0.000005;
      const totalAmount = amount + fee;

      const fromBalance = fromBalanceResponse.extra?.balance || 0;
      const toBalance = toBalanceResponse.extra?.balance || 0;

      console.log("Preview calculation:", {
        fromBalance,
        toBalance,
        amount,
        fee,
        totalAmount,
        hasSufficientBalance: fromBalance >= amount,
      });

      setPreview({
        fromBalance,
        toBalance,
        fee,
        totalAmount,
      });
    } catch (err) {
      console.error("Error calculating preview:", err);
      setPreview(null);
    }
  };

  // Check if external when toAddress changes
  useEffect(() => {
    const check_external = async () => {
      if (!formData.toAddress.trim()) {
        set_is_external_address(false);
        return;
      }

      const is_registered = await check_address_status(
        formData.toAddress.trim(),
      );
      set_is_external_address(!is_registered);
    };

    check_external();
  }, [formData.toAddress]);

  // Search wallets in real-time when user types
  useEffect(() => {
    const search_timeout = setTimeout(() => {
      search_wallets(formData.toAddress);
    }, 300); // Debounce 300ms for performance

    return () => clearTimeout(search_timeout);
  }, [formData.toAddress]);

  // Update preview
  useEffect(() => {
    // Add small delay to ensure formData is updated
    const timer = setTimeout(() => {
      calculate_preview();
    }, 100);

    return () => clearTimeout(timer);
  }, [formData.toAddress, formData.amount, walletAddress]);

  // Handle transfer
  const handle_transfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // CRITICAL: Mark transfer as in progress to prevent duplicate submissions
    setIsTransferInProgress(true);

    if (!walletAddress) {
      setError("No hay wallet vinculada a tu cuenta");
      setIsTransferInProgress(false);
      return;
    }

    const validation = validate_transfer_input(formData);
    if (validation) {
      setError(validation);
      setIsTransferInProgress(false);
      return;
    }

    const amount = parseFloat(formData.amount);
    if (preview && preview.fromBalance < amount) {
      setError("Balance insuficiente");
      setIsTransferInProgress(false);
      return;
    }

    // Show confirmation for external addresses
    if (is_external_address) {
      const result = await Swal.fire({
        title: "⚠️ Dirección No Registrada",
        html: `
          <div style="text-align: left;">
            <p><strong>Esta dirección no está registrada en el sistema.</strong></p>
            <p style="margin-top: 10px; color: #666; font-size: 0.9em;">
              Dirección: <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 4px; word-break: break-all;">${formData.toAddress}</code>
            </p>
            <p style="margin-top: 15px;">¿Estás seguro de confiar en esta dirección?</p>
          </div>
        `,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Sí, transferir",
        cancelButtonText: "Cancelar",
      });

      if (!result.isConfirmed) {
        return;
      }

      // Save external address - commented out since add_address is not available
      // try {
      //   await add_address({
      //     label: `Externo: ${formData.toAddress?.slice(0, 8)}...`,
      //     wallet_address: formData.toAddress,
      //     description: "Dirección externa no registrada",
      //   });
      // } catch (err) {
      //   console.error("Error saving external address:", err);
      // }
    }

    setLoading(true);

    try {
      const initiateResponse = await apiClient.post("/transfer/initiate", {
        fromWallet: walletAddress?.trim() || "",
        toWallet: formData.toAddress?.trim() || "",
        amount: amount,
      });

      if (!initiateResponse.success) {
        setError(initiateResponse.message || "Error al iniciar transferencia");
        return;
      }

      const { transactionId, transaction } = initiateResponse.extra;

      // Show wallet signing prompt
      await Swal.fire({
        title: "Autorizar Transferencia",
        html: `
                    <div class="text-left">
                        <p class="mb-2"><strong>De:</strong> ${walletAddress?.slice(0, 8) || ""}...</p>
                        <p class="mb-2"><strong>Para:</strong> ${formData.toAddress?.slice(0, 8) || ""}...</p>
                        <p class="mb-4"><strong>Cantidad:</strong> ${amount} GAPC</p>
                        <p class="text-sm text-gray-600">Tu wallet solicitará confirmación para firmar la transacción.</p>
                    </div>
                `,
        icon: "info",
        showConfirmButton: false,
        allowOutsideClick: false,
        didOpen: async () => {
          // Sign transaction with wallet
          const signature = await sign_transaction(transaction);

          if (!signature) {
            Swal.close();
            setError("Transacción cancelada o error al firmar");
            return;
          }

          // Close the info dialog
          Swal.close();

          // Send signed transaction to backend
          try {
            const confirmResponse = await apiClient.post(`/transfer/confirm`, {
              signedTransaction: signature,
              fromWallet: walletAddress?.trim() || "",
              toWallet: formData.toAddress?.trim() || "",
              amount: amount,
            });

            if (confirmResponse.success) {
              setLastTransfer({
                from: walletAddress?.trim() || "",
                to: formData.toAddress?.trim() || "",
                amount: amount,
                txId: transactionId,
              });

              setSuccess(true);
              setFormData({
                toAddress: "",
                amount: "",
                is_external_wallet: false,
              });
              setPreview(null);
              set_is_external_address(false);

              // await load_addresses(); // commented out since not available

              await Swal.fire({
                title: "¡Éxito!",
                text: "Transferencia completada exitosamente",
                icon: "success",
                confirmButtonText: "Aceptar",
              });

              setTimeout(() => setSuccess(false), 5000);
            } else {
              const errorMsg =
                confirmResponse.message || "Error al confirmar transferencia";
              setError(errorMsg);
              // Save failed transfer for retry
              setFailedTransfer({
                fromWallet: walletAddress?.trim() || "",
                toWallet: formData.toAddress?.trim() || "",
                amount: amount,
                transactionId,
                signedTransaction: signature,
                failureReason: errorMsg,
                failureStep: "confirm",
                timestamp: Date.now(),
              });
            }
          } catch (err) {
            const errorMessage =
              err instanceof Error
                ? err.message
                : "Error al confirmar transferencia";
            setError(errorMessage);
            // Save failed transfer for retry even on network errors
            setFailedTransfer({
              fromWallet: walletAddress?.trim() || "",
              toWallet: formData.toAddress?.trim() || "",
              amount: amount,
              transactionId,
              signedTransaction: signature,
              failureReason: errorMessage,
              failureStep: "confirm",
              timestamp: Date.now(),
            });
          }
        },
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error de conexión";
      setError(errorMessage);
    } finally {
      setLoading(false);
      // Re-enable submit button when transfer completes (regardless of result)
      setIsTransferInProgress(false);
    }
  };

  const handleInputChange =
    (field: keyof TransferFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  // Retry failed transfer confirmation
  const retry_confirm_transfer = async () => {
    if (!failedTransfer) {
      setError("No hay transferencia para reintentar");
      return;
    }

    // CRITICAL: Prevent accidental double-submission by enforcing cooldown
    if (retryRemainingSeconds > 0) {
      setError(
        `Por favor espera ${retryRemainingSeconds}s antes de reintentar nuevamente`,
      );
      return;
    }

    const timestamp = new Date().toISOString().split("T")[1].slice(0, 12);
    console.log(
      `[${timestamp}] [TRANSFER-RETRY] 🔄 Retrying failed transfer confirmation...`,
    );

    setLoading(true);
    setError(null);

    try {
      const confirmResponse = await apiClient.post(`/transfer/confirm`, {
        signedTransaction: failedTransfer.signedTransaction,
        fromWallet: failedTransfer.fromWallet,
        toWallet: failedTransfer.toWallet,
        amount: failedTransfer.amount,
      });

      console.log(`[${timestamp}] [TRANSFER-RETRY] Response:`, confirmResponse);

      if (confirmResponse.success) {
        console.log(
          `[${timestamp}] [TRANSFER-RETRY] ✅ Confirmation successful!`,
        );

        setLastTransfer({
          from: failedTransfer.fromWallet,
          to: failedTransfer.toWallet,
          amount: failedTransfer.amount,
          txId: failedTransfer.transactionId,
        });

        setSuccess(true);
        setFailedTransfer(null);
        setFormData({
          toAddress: "",
          amount: "",
          is_external_wallet: false,
        });
        setPreview(null);
        set_is_external_address(false);

        await Swal.fire({
          title: "¡Éxito!",
          text: "Transferencia completada exitosamente",
          icon: "success",
          confirmButtonText: "Aceptar",
        });

        setTimeout(() => setSuccess(false), 5000);
      } else {
        const errorMsg =
          confirmResponse.message || "Error al confirmar transferencia";
        console.error(
          `[${timestamp}] [TRANSFER-RETRY] ❌ Confirmation failed:`,
          errorMsg,
        );
        setError(errorMsg);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error al reintentar";
      console.error(
        `[${timestamp}] [TRANSFER-RETRY] ❌ Retry error:`,
        errorMessage,
      );
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border border-yellow-200/50 bg-yellow-50/50 p-6">
          <h3 className="font-semibold text-yellow-900">
            ⚠️ Autenticación Requerida
          </h3>
          <p className="mt-2 text-sm text-yellow-800">
            Necesitas conectar tu wallet para realizar transferencias.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Error Message - Using enhanced error display */}
      {error && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <TransferErrorDisplay
            error={error}
            errorStep={failedTransfer?.failureStep}
            transactionId={failedTransfer?.transactionId}
            retryRemainingSeconds={retryRemainingSeconds}
            onRetry={
              failedTransfer && failedTransfer.failureStep === "confirm"
                ? retry_confirm_transfer
                : undefined
            }
            onDismiss={() => {
              setFailedTransfer(null);
              setError(null);
            }}
          />
        </div>
      )}

      {/* Success Message */}
      {success && lastTransfer && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-xl border border-success/20 bg-success/10 p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-success/20 p-2">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-success">
                ¡Transferencia Exitosa!
              </h3>
              <p className="mt-1 text-sm text-success/80">
                Has transferido{" "}
                <span className="font-semibold">
                  {formatNumber(lastTransfer.amount)} GAPC
                </span>{" "}
                a la dirección {lastTransfer.to.slice(0, 8)}...
                {lastTransfer.to.slice(-8)}
              </p>
              <p className="mt-1 text-sm text-success/60">
                TX ID: {lastTransfer.txId}
              </p>
              <div className="mt-4 flex gap-2">
                <a
                  href={getExplorerUrl(lastTransfer.txId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/20 text-success hover:bg-success/30 transition-colors text-sm font-medium"
                >
                  <Globe className="h-4 w-4" />
                  Ver en Explorer
                </a>
                <a
                  href="/dashboard/transfer/history"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors text-sm font-medium"
                >
                  <ArrowRight className="h-4 w-4" />
                  Ver Historial
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Card */}
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-blue-10 p-3">
              <Send className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Transferir Tokens
              </h2>
              <p className="text-sm text-muted-foreground">
                Envía tokens a cualquier dirección Solana
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handle_transfer} className="space-y-6">
          {/* To Address Input */}
          <div>
            <label
              htmlFor="toAddress"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Hacia (Dirección Solana)
            </label>
            <WalletSearchInput
              value={formData.toAddress || ""}
              onChange={(value) => {
                setFormData((prev) => ({ ...prev, toAddress: value || "" }));
                // Check if external address
                const check_external = async () => {
                  if (!value?.trim()) {
                    set_is_external_address(false);
                    return;
                  }
                  try {
                    const is_registered = await apiClient.get(
                      `/users/check/${value.trim()}`,
                    );
                    set_is_external_address(
                      !is_registered.extra?.is_registered,
                    );
                  } catch (err) {
                    set_is_external_address(true); // Assume external if check fails
                  }
                };
                check_external();
              }}
              onSelect={(wallet) => {
                select_wallet(wallet);
              }}
              placeholder="Dirección Solana de destino"
            />
            {is_external_address && formData.toAddress && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  Esta dirección no está registrada en el sistema. Se te pedirá
                  confirmación antes de transferir.
                </p>
              </div>
            )}
          </div>

          {/* Amount Input */}
          <div>
            <label
              htmlFor="amount"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Cantidad
            </label>
            <div className="relative">
              <input
                id="amount"
                type="number"
                min="0"
                step="0.000000001"
                value={formData.amount}
                onChange={handleInputChange("amount")}
                placeholder="0.000000000"
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground text-lg placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                GAPC
              </span>
            </div>
          </div>

          {/* Transfer Preview */}
          {preview && parseFloat(formData.amount) > 0 && (
            <div className="rounded-xl bg-secondary/50 p-6">
              <h4 className="font-medium mb-4">
                Vista Previa de Transferencia
              </h4>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Mi balance:</span>
                  <span className="font-medium">
                    {formatNumber(preview.fromBalance)} GAPC
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Balance destino:
                  </span>
                  <span className="font-medium">
                    {formatNumber(preview.toBalance)} GAPC
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Cantidad a transferir:
                  </span>
                  <span className="font-medium">
                    {formatNumber(parseFloat(formData.amount))} GAPC
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fee de red:</span>
                  <span className="font-medium">
                    {preview.fee.toFixed(6)} SOL
                    {solPrice && (
                      <span className="text-muted-foreground ml-1">
                        (~${(preview.fee * solPrice).toFixed(4)})
                      </span>
                    )}
                  </span>
                </div>

                <div className="border-t pt-3">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <span className="text-sm">Mi nuevo balance:</span>
                    <span className="font-medium text-foreground">
                      {formatNumber(
                        preview.fromBalance - parseFloat(formData.amount),
                      )}{" "}
                      GAPC
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-muted-foreground mt-1">
                    <span className="text-sm">Nuevo balance destino:</span>
                    <span className="font-medium text-foreground">
                      {formatNumber(
                        preview.toBalance + parseFloat(formData.amount),
                      )}{" "}
                      GAPC
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={(() => {
              const hasToAddress = !!formData.toAddress?.trim();
              const hasAmount = !!formData.amount?.trim();
              const amountValid =
                !isNaN(parseFloat(formData.amount)) &&
                parseFloat(formData.amount) > 0;
              const hasBalance =
                preview &&
                !isNaN(preview.fromBalance) &&
                preview.fromBalance >= parseFloat(formData.amount);

              const isDisabled =
                !hasToAddress ||
                !hasAmount ||
                !amountValid ||
                !hasBalance ||
                loading ||
                is_signing ||
                isTransferInProgress; // CRITICAL: Prevent duplicate submissions

              console.log("Button validation:", {
                hasToAddress,
                hasAmount,
                amount: formData.amount,
                amountValid,
                preview,
                hasBalance,
                loading,
                is_signing,
                isDisabled,
              });

              return isDisabled;
            })()}
            className="w-full rounded-xl bg-blue-600 py-4 text-lg font-semibold text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading || is_signing || isTransferInProgress ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                {is_signing
                  ? "Firmando transacción..."
                  : isTransferInProgress
                    ? "Verificando transferencia..."
                    : "Procesando..."}
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                Confirmar Transferencia
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
