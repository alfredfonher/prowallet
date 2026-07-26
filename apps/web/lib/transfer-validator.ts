import { TransferFormData } from "@/hooks/use-transfer-form";

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function validate_transfer_input(data: TransferFormData): string | null {
  if (!data.from_holder.trim()) {
    return "Selecciona un holder de origen";
  }

  if (!data.to_address.trim()) {
    return "La dirección de destino es requerida";
  }

  if (!SOLANA_ADDRESS_REGEX.test(data.to_address.trim())) {
    return "Dirección Solana inválida";
  }

  if (data.from_holder.trim() === data.to_address.trim()) {
    return "No puedes transferir a la misma dirección";
  }

  const amount = parseFloat(data.amount);
  if (isNaN(amount) || amount <= 0) {
    return "La cantidad debe ser mayor a 0";
  }

  return null;
}

export function validate_sufficient_balance(
  holder_balance: number,
  transfer_amount: number,
): boolean {
  return holder_balance >= transfer_amount;
}
