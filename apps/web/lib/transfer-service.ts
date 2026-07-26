import { apiClient } from "@/lib/api-client";
import { TransferFormData } from "@/hooks/use-transfer-form";

export interface TransferInitiateResponse {
  success: boolean;
  transaction_id: string;
  message?: string;
}

export interface TransferConfirmResponse {
  success: boolean;
  tx_id: string;
  message?: string;
}

export async function initiate_transfer(
  form_data: TransferFormData,
): Promise<TransferInitiateResponse> {
  const response = await apiClient.post("/transfer/initiate", {
    fromWallet: form_data.from_holder.trim(),
    toWallet: form_data.to_address.trim(),
    amount: parseFloat(form_data.amount),
  });

  return {
    success: response.success || false,
    transaction_id: response.extra?.transactionId || "",
    message: response.message,
  };
}

export async function confirm_transfer(
  transaction_id: string,
  signature: string,
): Promise<TransferConfirmResponse> {
  const response = await apiClient.post("/transfer/confirm", {
    signedTransaction: signature,
    fromWallet: transaction_id, // Backend necesita fromWallet para logging/validación
  });

  return {
    success: response.success || false,
    tx_id: response.extra?.transactionId || "",
    message: response.message,
  };
}

export async function execute_transfer(
  form_data: TransferFormData,
  signature: string = "demo_signature",
): Promise<{
  success: boolean;
  tx_id: string;
  error?: string;
}> {
  try {
    const initiate_result = await initiate_transfer(form_data);

    if (!initiate_result.success) {
      return {
        success: false,
        tx_id: "",
        error: initiate_result.message || "Error al iniciar transferencia",
      };
    }

    const confirm_result = await confirm_transfer(
      initiate_result.transaction_id,
      signature,
    );

    if (!confirm_result.success) {
      return {
        success: false,
        tx_id: "",
        error: confirm_result.message || "Error al confirmar transferencia",
      };
    }

    return {
      success: true,
      tx_id: confirm_result.tx_id,
    };
  } catch (error) {
    const error_message =
      error instanceof Error ? error.message : "Error de conexión";
    return {
      success: false,
      tx_id: "",
      error: error_message,
    };
  }
}
