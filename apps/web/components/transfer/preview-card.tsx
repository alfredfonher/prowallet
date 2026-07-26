import { formatNumber } from "@/lib/token-store";
import { TransferPreview } from "@/lib/transfer-calculator";

interface TransferPreviewProps {
  preview: TransferPreview;
  transfer_amount: number;
}

export function TransferPreviewCard({
  preview,
  transfer_amount,
}: TransferPreviewProps) {
  if (transfer_amount <= 0) {
    return null;
  }

  const new_from_balance = preview.from_balance - transfer_amount;
  const new_to_balance = preview.to_balance + transfer_amount;

  return (
    <div className="rounded-xl bg-secondary/50 p-6">
      <h4 className="font-medium mb-4">Vista Previa de Transferencia</h4>

      <div className="space-y-3">
        <PreviewRow
          label="Balance origen:"
          value={`${formatNumber(preview.from_balance)} GAPC`}
        />

        <PreviewRow
          label="Balance destino:"
          value={`${formatNumber(preview.to_balance)} GAPC`}
        />

        <PreviewRow
          label="Cantidad a transferir:"
          value={`${formatNumber(transfer_amount)} GAPC`}
        />

        <PreviewRow
          label="Fee de red:"
          value={`${preview.fee.toFixed(6)} SOL`}
        />

        <div className="border-t pt-3">
          <PreviewRow
            label="Nuevo balance origen:"
            value={`${formatNumber(new_from_balance)} GAPC`}
            highlight
          />

          <PreviewRow
            label="Nuevo balance destino:"
            value={`${formatNumber(new_to_balance)} GAPC`}
            highlight
          />
        </div>
      </div>
    </div>
  );
}

interface PreviewRowProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function PreviewRow({ label, value, highlight = false }: PreviewRowProps) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={highlight ? "font-medium text-foreground" : "font-medium"}
      >
        {value}
      </span>
    </div>
  );
}
