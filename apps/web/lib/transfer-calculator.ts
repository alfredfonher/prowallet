export interface TransferPreview {
  from_balance: number;
  to_balance: number;
  fee: number;
  total_amount: number;
}

const TRANSFER_FEE_SOL = 0.000005;

export function calculate_transfer_preview(
  from_balance: number,
  to_balance: number,
  transfer_amount: number,
): TransferPreview {
  return {
    from_balance,
    to_balance,
    fee: TRANSFER_FEE_SOL,
    total_amount: transfer_amount + TRANSFER_FEE_SOL,
  };
}

export function calculate_new_from_balance(
  preview: TransferPreview,
  transfer_amount: number,
): number {
  return preview.from_balance - transfer_amount;
}

export function calculate_new_to_balance(
  preview: TransferPreview,
  transfer_amount: number,
): number {
  return preview.to_balance + transfer_amount;
}
